/**
 * Collaborative Filtering Service
 * Gợi ý dựa trên sự tương đồng giữa người dùng và công thức
 * Sử dụng Matrix Factorization (SVD) để dự đoán ratings
 */

import { Op } from 'sequelize';
import { UserView, UserFavorite, RecipeReview, Recipe, sequelize } from '../../models';
import { matrixService } from './matrixService';
import {
  InteractionMatrix,
  SVDFactors,
  UserProfile,
  PredictedRating,
  INTERACTION_WEIGHTS,
} from '../../types/recommendation';

interface InteractionRecord {
  userId: number;
  recipeId: number;
  score: number;
}

class CollaborativeFilteringService {
  private svdFactors: SVDFactors | null = null;
  private interactionMatrix: InteractionMatrix | null = null;
  private rowMeans: number[] = [];
  private lastUpdated: Date | null = null;
  private readonly CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

  /**
   * Kiểm tra cache có còn valid không
   */
  private isCacheValid(): boolean {
    if (!this.lastUpdated || !this.svdFactors) {
      return false;
    }
    return Date.now() - this.lastUpdated.getTime() < this.CACHE_TTL_MS;
  }

  /**
   * Lấy user profile từ lịch sử tương tác
   */
  async getUserProfile(userId: number): Promise<UserProfile> {
    const [views, favorites, ratings] = await Promise.all([
      UserView.findAll({
        where: { userId },
        attributes: ['recipeId', 'viewCount'],
      }),
      UserFavorite.findAll({
        where: { userId },
        attributes: ['recipeId'],
      }),
      RecipeReview.findAll({
        where: { userId, isActive: true },
        attributes: ['recipeId', 'rating'],
      }),
    ]);

    const viewedRecipeIds = views.map(v => v.recipeId);
    const favoritedRecipeIds = favorites.map(f => f.recipeId);
    const ratedRecipeIds = ratings.map(r => r.recipeId);
    const ratingCount = ratings.length;
    const avgRatingGiven = ratingCount > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratingCount
      : 0;

    const interactionCount = views.length + favorites.length + ratings.length;
    const isColdStart = interactionCount < 3;

    return {
      userId,
      interactionCount,
      favoriteCount: favorites.length,
      ratingCount,
      avgRatingGiven,
      viewedRecipeIds,
      favoritedRecipeIds,
      ratedRecipeIds,
      isColdStart,
    };
  }

  /**
   * Tổng hợp tất cả interactions thành ma trận
   */
  async buildInteractionMatrix(): Promise<InteractionMatrix> {
    // Lấy tất cả user IDs và recipe IDs có tương tác
    const [userResult, recipeResult] = await Promise.all([
      sequelize.query(`
        SELECT DISTINCT user_id FROM (
          SELECT user_id FROM user_views
          UNION SELECT user_id FROM user_favorites
          UNION SELECT user_id FROM recipe_reviews WHERE is_active = true
        ) AS users
      `, { type: 'SELECT' }),

      sequelize.query(`
        SELECT DISTINCT id FROM recipes WHERE status = 'visible'
      `, { type: 'SELECT' }),
    ]);

    const users = userResult as unknown as { user_id: number }[];
    const recipes = recipeResult as unknown as { id: number }[];

    const userIds = users.map(u => u.user_id);
    const recipeIds = recipes.map(r => r.id);

    // Lấy raw interactions
    const interactions: Map<string, number> = new Map();

    // Views
    const views = await UserView.findAll({
      attributes: ['userId', 'recipeId', 'viewCount'],
    });
    views.forEach(v => {
      const key = `${v.userId},${v.recipeId}`;
      const current = interactions.get(key) || 0;
      interactions.set(key, current + v.viewCount * INTERACTION_WEIGHTS.view);
    });

    // Favorites
    const favorites = await UserFavorite.findAll({
      attributes: ['userId', 'recipeId'],
    });
    favorites.forEach(f => {
      const key = `${f.userId},${f.recipeId}`;
      const current = interactions.get(key) || 0;
      interactions.set(key, current + INTERACTION_WEIGHTS.favorite);
    });

    // Ratings
    const ratings = await RecipeReview.findAll({
      where: { isActive: true },
      attributes: ['userId', 'recipeId', 'rating'],
    });
    ratings.forEach(r => {
      const key = `${r.userId},${r.recipeId}`;
      const current = interactions.get(key) || 0;
      interactions.set(key, current + r.rating);
    });

    return matrixService.buildInteractionMatrix(userIds, recipeIds, interactions);
  }

  /**
   * Train SVD model và lưu vào cache
   */
  async trainModel(k: number = 20): Promise<SVDFactors> {
    console.log('[CollabFilterService] Building interaction matrix...');
    const matrixData = await this.buildInteractionMatrix();
    this.interactionMatrix = matrixData;

    console.log(`[CollabFilterService] Matrix size: ${matrixData.matrix.length}x${matrixData.matrix[0].length}`);
    console.log('[CollabFilterService] Normalizing matrix...');
    const { normalized, rowMeans } = matrixService.normalizeMatrix(matrixData.matrix);
    this.rowMeans = rowMeans;

    console.log(`[CollabFilterService] Training SVD with k=${k}...`);
    const factors = matrixService.performSVD(normalized, k);
    this.svdFactors = factors;
    this.lastUpdated = new Date();

    console.log('[CollabFilterService] Model training completed');
    return factors;
  }

  /**
   * Lấy hoặc train model nếu cần
   */
  async getOrTrainModel(k: number = 20): Promise<SVDFactors> {
    if (!this.isCacheValid()) {
      await this.trainModel(k);
    }
    return this.svdFactors!;
  }

  /**
   * Dự đoán điểm cho một user-recipe pair
   */
  async predictScore(userId: number, recipeId: number): Promise<PredictedRating> {
    if (!this.interactionMatrix || !this.svdFactors) {
      await this.getOrTrainModel();
    }

    return matrixService.predictRating(
      userId,
      recipeId,
      this.svdFactors!,
      this.interactionMatrix!.users,
      this.interactionMatrix!.recipes,
      this.rowMeans
    );
  }

  /**
   * Tính collaborative filtering scores cho nhiều công thức
   */
  async scoreRecipesForUser(
    userId: number,
    candidateRecipeIds: number[],
    k: number = 20
  ): Promise<Map<number, number>> {
    await this.getOrTrainModel(k);

    const rankedItems = matrixService.rankItemsForUser(
      userId,
      candidateRecipeIds,
      this.svdFactors!,
      this.interactionMatrix!.users,
      this.interactionMatrix!.recipes,
      this.rowMeans
    );

    const scores = new Map<number, number>();
    rankedItems.forEach(item => {
      scores.set(item.recipeId, item.score);
    });

    return scores;
  }

  /**
   * Tìm users tương tự với một user
   */
  async findSimilarUsers(
    userId: number,
    limit: number = 10
  ): Promise<{ userId: number; similarity: number }[]> {
    await this.getOrTrainModel();

    const userIdx = this.interactionMatrix!.users.get(userId);
    if (userIdx === undefined) {
      return []; // User không có trong ma trận
    }

    const userFactor = this.svdFactors!.userFactors[userIdx];
    const similarities: { userId: number; similarity: number }[] = [];

    // Tính similarity với tất cả users
    for (const [otherUserId, otherIdx] of this.interactionMatrix!.users) {
      if (otherUserId === userId) continue;

      const otherFactor = this.svdFactors!.userFactors[otherIdx];
      const similarity = matrixService.cosineSimilarity(userFactor, otherFactor);
      similarities.push({ userId: otherUserId, similarity });
    }

    // Sort và return top-K
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, limit);
  }

  /**
   * Tìm công thức tương tự dựa trên collaborative filtering
   */
  async findSimilarRecipesByCollab(
    recipeId: number,
    limit: number = 10
  ): Promise<{ recipeId: number; similarity: number }[]> {
    await this.getOrTrainModel();

    const recipeIdx = this.interactionMatrix!.recipes.get(recipeId);
    if (recipeIdx === undefined) {
      return []; // Recipe không có trong ma trận
    }

    const recipeFactor = this.svdFactors!.recipeFactors[recipeIdx];
    const similarities: { recipeId: number; similarity: number }[] = [];

    // Tính similarity với tất cả recipes
    for (const [otherRecipeId, otherIdx] of this.interactionMatrix!.recipes) {
      if (otherRecipeId === recipeId) continue;

      const otherFactor = this.svdFactors!.recipeFactors[otherIdx];
      const similarity = matrixService.cosineSimilarity(recipeFactor, otherFactor);
      similarities.push({ recipeId: otherRecipeId, similarity });
    }

    // Sort và return top-K
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, limit);
  }

  /**
   * Gợi ý công thức cho user dựa trên users tương tự
   */
  async getRecommendationsFromSimilarUsers(
    userId: number,
    limit: number = 10,
    excludeRecipeIds: number[] = []
  ): Promise<{ recipeId: number; score: number; reason: string }[]> {
    await this.getOrTrainModel();

    // Tìm similar users
    const similarUsers = await this.findSimilarUsers(userId, 10);

    if (similarUsers.length === 0) {
      return [];
    }

    // Lấy recipes mà similar users thích nhưng user hiện tại chưa xem
    const userProfile = await this.getUserProfile(userId);
    const excludeIds = new Set([...userProfile.viewedRecipeIds, ...userProfile.favoritedRecipeIds, ...excludeRecipeIds]);

    // Lấy recipes từ similar users
    const recommendations: { recipeId: number; score: number; reason: string }[] = [];
    const scoredRecipes = new Map<number, { totalScore: number; count: number }>();

    for (const { userId: similarUserId, similarity } of similarUsers) {
      const similarProfile = await this.getUserProfile(similarUserId);

      // Lấy top favorites từ similar user
      const topRecipes = await RecipeReview.findAll({
        where: {
          userId: similarUserId,
          isActive: true,
          rating: { [Op.gte]: 4 },
        },
        order: [['rating', 'DESC']],
        limit: 20,
      });

      for (const review of topRecipes) {
        if (excludeIds.has(review.recipeId)) continue;

        const existing = scoredRecipes.get(review.recipeId) || { totalScore: 0, count: 0 };
        existing.totalScore += similarity * review.rating;
        existing.count += 1;
        scoredRecipes.set(review.recipeId, existing);
      }
    }

    // Tính average score và sort
    scoredRecipes.forEach(({ totalScore, count }, recipeId) => {
      recommendations.push({
        recipeId,
        score: totalScore / count,
        reason: 'similar_users_liked',
      });
    });

    recommendations.sort((a, b) => b.score - a.score);
    return recommendations.slice(0, limit);
  }

  /**
   * Invalidate cache để train lại model
   */
  invalidateCache(): void {
    this.svdFactors = null;
    this.interactionMatrix = null;
    this.lastUpdated = null;
    console.log('[CollabFilterService] Cache invalidated');
  }

  /**
   * Lấy thông tin model
   */
  getModelInfo(): { isTrained: boolean; lastUpdated: Date | null; matrixSize: string } {
    return {
      isTrained: this.svdFactors !== null,
      lastUpdated: this.lastUpdated,
      matrixSize: this.interactionMatrix
        ? `${this.interactionMatrix.matrix.length}x${this.interactionMatrix.matrix[0].length}`
        : 'N/A',
    };
  }
}

export const collaborativeFilteringService = new CollaborativeFilteringService();
export default collaborativeFilteringService;
