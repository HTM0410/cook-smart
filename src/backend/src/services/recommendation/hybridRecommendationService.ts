/**
 * Hybrid Recommendation Service
 * Kết hợp Content-Based, Collaborative Filtering và Popularity
 * Để tạo ra danh sách gợi ý personalized cho người dùng
 */

import { Op } from 'sequelize';
import { Recipe, RecipeCategory, RecipeIngredient, Ingredient, RecipeReview, UserView, UserFavorite, sequelize } from '../../models';
import { contentBasedService } from './contentBasedService';
import { collaborativeFilteringService } from './collaborativeFilteringService';
import { popularityService } from './popularityService';
import { embeddingService } from './embeddingService';
import {
  RecommendationScore,
  RecommendedRecipe,
  RecommendationReason,
  HybridWeights,
  DEFAULT_HYBRID_WEIGHTS,
  COLD_START_WEIGHTS,
  GetRecommendationsRequest,
  RecommendationsResponse,
} from '../../types/recommendation';

class HybridRecommendationService {
  private readonly SVD_K = 20;
  private readonly DEFAULT_LIMIT = 10;
  private readonly MAX_LIMIT = 50;

  /**
   * Lấy danh sách gợi ý cho user
   */
  async getRecommendations(
    request: GetRecommendationsRequest
  ): Promise<RecommendationsResponse> {
    const {
      userId,
      limit = this.DEFAULT_LIMIT,
      excludeRecipeIds = [],
      categoryFilter,
      difficultyFilter,
      maxPrepTime,
      includeReason = true,
    } = request;

    const effectiveLimit = Math.min(limit, this.MAX_LIMIT);

    // 1. Lấy user profile để xác định cold-start status
    const userProfile = await collaborativeFilteringService.getUserProfile(userId);
    const isColdStart = userProfile.isColdStart;

    // 2. Xác định hybrid weights dựa trên user profile
    const weights = isColdStart ? COLD_START_WEIGHTS : DEFAULT_HYBRID_WEIGHTS;

    // 3. Lấy candidate recipes (visible recipes không nằm trong exclude list)
    const candidateRecipes = await this.getCandidateRecipes(
      excludeRecipeIds,
      categoryFilter,
      difficultyFilter,
      maxPrepTime,
      effectiveLimit * 3 // Lấy nhiều hơn để có buffer sau khi filter
    );

    if (candidateRecipes.length === 0) {
      return {
        recipes: [],
        pagination: { total: 0, limit: effectiveLimit, offset: 0 },
        metadata: {
          generatedAt: new Date().toISOString(),
          algorithm: 'hybrid',
          weightsUsed: weights,
          userProfile: {
            interactionCount: userProfile.interactionCount,
            isColdStart,
          },
        },
      };
    }

    const candidateIds = candidateRecipes.map(r => r.id);

    // 4. Tính scores từ 3 signals
    const [contentScores, collabScores, popularityScores] = await Promise.all([
      isColdStart || weights.content === 0
        ? new Map<number, number>()
        : contentBasedService.scoreRecipesForUser(candidateIds, userId),
      weights.collaborative === 0
        ? new Map<number, number>()
        : collaborativeFilteringService.scoreRecipesForUser(userId, candidateIds, this.SVD_K),
      popularityService.getPopularityScores(candidateIds),
    ]);

    // Normalize popularity scores
    const normalizedPopularity = popularityService.normalizeScores(popularityScores);

    // 5. Kết hợp scores
    const hybridScores = await this.combineScores(
      candidateIds,
      contentScores,
      collabScores,
      normalizedPopularity,
      weights
    );

    // 6. Sort và lấy top N
    const sortedScores = Array.from(hybridScores.entries())
      .sort((a, b) => b[1].finalScore - a[1].finalScore)
      .slice(0, effectiveLimit);

    // 7. Enrich với recipe details
    const recommendations = await this.enrichRecommendations(
      sortedScores,
      userProfile,
      isColdStart,
      includeReason
    );

    return {
      recipes: recommendations,
      pagination: {
        total: candidateRecipes.length,
        limit: effectiveLimit,
        offset: 0,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        algorithm: 'hybrid',
        weightsUsed: weights,
        userProfile: {
          interactionCount: userProfile.interactionCount,
          isColdStart,
        },
      },
    };
  }

  /**
   * Lấy công thức tương tự với một công thức
   */
  async getSimilarRecipes(
    recipeId: number,
    limit: number = 10,
    excludeRecipeIds: number[] = []
  ): Promise<RecommendedRecipe[]> {
    const effectiveLimit = Math.min(limit, this.MAX_LIMIT);
    const excludeIds = [recipeId, ...excludeRecipeIds];

    // Tìm similar recipes từ content-based
    const contentSimilar = await contentBasedService.findSimilarRecipes(
      recipeId,
      effectiveLimit,
      excludeIds
    );

    // Tìm similar recipes từ collaborative filtering
    const collabSimilar = await collaborativeFilteringService.findSimilarRecipesByCollab(
      recipeId,
      effectiveLimit
    );

    // Kết hợp kết quả
    const recipeScores = new Map<number, { contentScore: number; collabScore: number; finalScore: number }>();

    for (const item of contentSimilar) {
      recipeScores.set(item.recipeId, { contentScore: item.score, collabScore: 0, finalScore: item.score * 0.6 });
    }

    for (const item of collabSimilar) {
      const existing = recipeScores.get(item.recipeId);
      if (existing) {
        existing.collabScore = item.similarity;
        existing.finalScore = existing.contentScore * 0.6 + item.similarity * 0.4;
      } else {
        recipeScores.set(item.recipeId, { contentScore: 0, collabScore: item.similarity, finalScore: item.similarity * 0.4 });
      }
    }

    // Sort và lấy top N
    const sortedRecipes = Array.from(recipeScores.entries())
      .sort((a, b) => b[1].finalScore - a[1].finalScore)
      .slice(0, effectiveLimit);

    // Enrich với recipe details
    const recipeIds = sortedRecipes.map(([id]) => id);
    const recipes = await Recipe.findAll({
      where: { id: { [Op.in]: recipeIds } },
      include: [
        { model: RecipeCategory, as: 'categories', through: { attributes: [] } },
        { model: RecipeReview, as: 'reviews', where: { isActive: true }, required: false },
        { model: UserView, as: 'views', attributes: [] },
        { model: UserFavorite, as: 'favoritedBy', attributes: [] },
      ],
    });

    // Map recipe details
    const recipeMap = new Map(recipes.map(r => [r.id, r]));

    return sortedRecipes.map(([id, scores]) => {
      const recipe = recipeMap.get(id);
      if (!recipe) return null;

      const reviews = (recipe as any).reviews || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
        : 0;

      return this.formatRecommendedRecipe(recipe, scores.finalScore, 'similar_to_history');
    }).filter(Boolean) as RecommendedRecipe[];
  }

  /**
   * Lấy công thức phổ biến
   */
  async getPopularRecipes(limit: number = 10): Promise<RecommendedRecipe[]> {
    const effectiveLimit = Math.min(limit, this.MAX_LIMIT);

    const popularRecipes = await popularityService.getPopularRecipes(effectiveLimit);
    const recipeIds = popularRecipes.map(p => p.recipeId);

    const recipes = await Recipe.findAll({
      where: { id: { [Op.in]: recipeIds } },
      include: [
        { model: RecipeCategory, as: 'categories', through: { attributes: [] } },
      ],
    });

    const recipeMap = new Map(recipes.map(r => [r.id, r]));
    const popularityMap = new Map(popularRecipes.map(p => [p.recipeId, p]));

    return popularRecipes.map(pop => {
      const recipe = recipeMap.get(pop.recipeId);
      if (!recipe) return null;

      return this.formatRecommendedRecipe(recipe, pop.popularityScore, 'popular');
    }).filter(Boolean) as RecommendedRecipe[];
  }

  /**
   * Kết hợp scores từ 3 signals
   */
  private async combineScores(
    recipeIds: number[],
    contentScores: Map<number, number>,
    collabScores: Map<number, number>,
    popularityScores: Map<number, number>,
    weights: HybridWeights
  ): Promise<Map<number, RecommendationScore>> {
    const result = new Map<number, RecommendationScore>();

    // Calculate max values for normalization
    const maxContent = Math.max(...Array.from(contentScores.values()), 0.001);
    const maxCollab = Math.max(...Array.from(collabScores.values()), 0.001);
    const maxPopularity = Math.max(...Array.from(popularityScores.values()), 0.001);

    for (const recipeId of recipeIds) {
      const contentScore = (contentScores.get(recipeId) || 0) / maxContent;
      const collabScore = (collabScores.get(recipeId) || 0) / maxCollab;
      const popularityScore = (popularityScores.get(recipeId) || 0) / maxPopularity;

      // Weighted combination
      const finalScore =
        weights.content * contentScore +
        weights.collaborative * collabScore +
        weights.popularity * popularityScore;

      result.set(recipeId, {
        recipeId,
        contentScore,
        collaborativeScore: collabScore,
        popularityScore,
        finalScore,
        breakdown: {
          weights,
          signals: {
            views: 0,
            favorites: 0,
            ratings: 0,
            similarity: contentScore,
          },
        },
      });
    }

    return result;
  }

  /**
   * Lấy candidate recipes với filters
   */
  private async getCandidateRecipes(
    excludeRecipeIds: number[],
    categoryFilter?: string,
    difficultyFilter?: ('easy' | 'medium' | 'hard')[],
    maxPrepTime?: number,
    limit?: number
  ): Promise<Recipe[]> {
    const whereClause: any = {
      status: 'visible',
    };

    if (excludeRecipeIds.length > 0) {
      whereClause.id = { [Op.notIn]: excludeRecipeIds };
    }

    if (difficultyFilter && difficultyFilter.length > 0) {
      whereClause.difficulty = { [Op.in]: difficultyFilter };
    }

    if (maxPrepTime) {
      whereClause.prepTime = { [Op.lte]: maxPrepTime };
    }

    const includeClause: any[] = [];

    if (categoryFilter) {
      includeClause.push({
        model: RecipeCategory,
        as: 'categories',
        through: { attributes: [] },
        where: {
          categoryName: { [Op.iLike]: `%${categoryFilter}%` },
        },
        required: true,
      });
    }

    return Recipe.findAll({
      where: whereClause,
      include: includeClause.length > 0 ? includeClause : [
        { model: RecipeCategory, as: 'categories', through: { attributes: [] } },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  /**
   * Enrich recommendations với recipe details
   */
  private async enrichRecommendations(
    sortedScores: [number, RecommendationScore][],
    userProfile: any,
    isColdStart: boolean,
    includeReason: boolean
  ): Promise<RecommendedRecipe[]> {
    const recipeIds = sortedScores.map(([id]) => id);

    const recipes = await Recipe.findAll({
      where: { id: { [Op.in]: recipeIds } },
      include: [
        { model: RecipeCategory, as: 'categories', through: { attributes: [] } },
        { model: RecipeReview, as: 'reviews', where: { isActive: true }, required: false },
        { model: UserView, as: 'views', attributes: [] },
        { model: UserFavorite, as: 'favoritedBy', attributes: [] },
      ],
    });

    const recipeMap = new Map(recipes.map(r => [r.id, r]));

    return sortedScores.map(([recipeId, score]) => {
      const recipe = recipeMap.get(recipeId);
      if (!recipe) return null;

      const reviews = (recipe as any).reviews || [];
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
        : 0;

      // Determine recommendation reason
      let reason: RecommendationReason = 'personalized';
      if (isColdStart) {
        reason = score.popularityScore > score.contentScore ? 'popular' : 'cold_start_fallback';
      } else if (userProfile.favoritedRecipeIds.includes(recipeId)) {
        reason = 'similar_to_favorites';
      } else if (userProfile.viewedRecipeIds.includes(recipeId)) {
        reason = 'similar_to_history';
      }

      return this.formatRecommendedRecipe(recipe, score.finalScore, reason);
    }).filter(Boolean) as RecommendedRecipe[];
  }

  /**
   * Format recipe thành RecommendedRecipe
   */
  private formatRecommendedRecipe(
    recipe: Recipe,
    score: number,
    reason: RecommendationReason
  ): RecommendedRecipe {
    const reviews = (recipe as any).reviews || [];
    const views = (recipe as any).views || [];
    const favorites = (recipe as any).favoritedBy || [];
    const categories = (recipe as any).categories || [];

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
      : 0;

    return {
      id: recipe.id,
      recipeName: recipe.recipeName,
      description: recipe.description ?? null,
      imageUrl: recipe.imageUrl ?? null,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      servings: recipe.servings,
      difficulty: recipe.difficulty,
      averageRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
      totalViews: views.length,
      totalFavorites: favorites.length,
      categories: categories.map((cat: any) => ({
        id: cat.id,
        categoryName: cat.categoryName,
        categoryType: cat.categoryType,
      })),
      score: {
        recipeId: recipe.id,
        contentScore: 0,
        collaborativeScore: 0,
        popularityScore: 0,
        finalScore: score,
      },
      reason,
    };
  }

  /**
   * Refresh recommendation model (retrain)
   */
  async refreshModel(): Promise<void> {
    console.log('[HybridRecService] Refreshing recommendation model...');
    collaborativeFilteringService.invalidateCache();
    await collaborativeFilteringService.getOrTrainModel(this.SVD_K);
    console.log('[HybridRecService] Model refresh completed');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ embedding: boolean; collab: boolean; popularity: boolean }> {
    const [embeddingHealth, collabInfo, popularityHealth] = await Promise.all([
      embeddingService.healthCheck(),
      Promise.resolve(collaborativeFilteringService.getModelInfo()),
      Promise.resolve(true),
    ]);

    return {
      embedding: embeddingHealth,
      collab: collabInfo.isTrained,
      popularity: popularityHealth,
    };
  }
}

export const hybridRecommendationService = new HybridRecommendationService();
export default hybridRecommendationService;
