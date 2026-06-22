/**
 * Content-Based Filtering Service
 * Gợi ý dựa trên độ tương đồng nội dung giữa các công thức
 * Sử dụng vector embeddings và cosine similarity
 */

import { Op } from 'sequelize';
import { Recipe, RecipeIngredient, Ingredient, RecipeCategory, RecipeEmbedding, UserView, UserFavorite, RecipeReview } from '../../models';
import { embeddingService } from './embeddingService';
import {
  SimilarityResult,
  UserPreferenceProfile,
  RecommendationScore,
} from '../../types/recommendation';

class ContentBasedService {
  /**
   * Xây dựng user preference profile từ lịch sử tương tác
   */
  async buildUserPreferenceProfile(userId: number): Promise<UserPreferenceProfile> {
    // Lấy các công thức user đã tương tác
    const [views, favorites, ratings] = await Promise.all([
      UserView.findAll({
        where: { userId },
        include: [{
          model: Recipe,
          as: 'recipe',
          include: [
            { model: RecipeIngredient, as: 'ingredients', include: [{ model: Ingredient, as: 'ingredient' }] },
            { model: RecipeCategory, as: 'categories' },
          ],
        }],
        order: [['lastViewedAt', 'DESC']],
        limit: 50,
      }),
      UserFavorite.findAll({
        where: { userId },
        include: [{
          model: Recipe,
          as: 'recipe',
          include: [
            { model: RecipeIngredient, as: 'ingredients', include: [{ model: Ingredient, as: 'ingredient' }] },
            { model: RecipeCategory, as: 'categories' },
          ],
        }],
        order: [['createdAt', 'DESC']],
        limit: 50,
      }),
      RecipeReview.findAll({
        where: { userId, isActive: true },
        include: [{
          model: Recipe,
          as: 'recipe',
          include: [
            { model: RecipeIngredient, as: 'ingredients', include: [{ model: Ingredient, as: 'ingredient' }] },
            { model: RecipeCategory, as: 'categories' },
          ],
        }],
        order: [['rating', 'DESC']],
        limit: 50,
      }),
    ]);

    // Tổng hợp preferences
    const preferenceProfile: UserPreferenceProfile = {
      preferredCategories: [],
      preferredDifficulties: [],
      preferredIngredients: [],
      avgPrepTime: 0,
      avgCookTime: 0,
    };

    const categoryCount = new Map<string, number>();
    const difficultyCount = new Map<string, number>();
    const ingredientCount = new Map<string, number>();
    let totalPrepTime = 0;
    let totalCookTime = 0;
    let recipeCount = 0;

    // Helper function để extract recipe từ interaction
    const processRecipe = (recipe: any, weight: number = 1) => {
      if (!recipe) return;

      // Categories
      if (recipe.categories) {
        recipe.categories.forEach((cat: any) => {
          const name = cat.categoryName || cat.category_name;
          categoryCount.set(name, (categoryCount.get(name) || 0) + weight);
        });
      }

      // Difficulty
      if (recipe.difficulty) {
        difficultyCount.set(recipe.difficulty, (difficultyCount.get(recipe.difficulty) || 0) + weight);
      }

      // Ingredients
      if (recipe.ingredients) {
        recipe.ingredients.forEach((ing: any) => {
          const name = ing.ingredient?.ingredientName || ing.ingredient?.ingredient_name || ing.ingredientName;
          if (name) {
            ingredientCount.set(name, (ingredientCount.get(name) || 0) + weight);
          }
        });
      }

      // Time
      totalPrepTime += (recipe.prepTime || 0) * weight;
      totalCookTime += (recipe.cookTime || 0) * weight;
      recipeCount += weight;
    };

    // Process views (weight = view count)
    views.forEach((view) => {
      const recipe = (view as any).recipe;
      if (recipe) {
        processRecipe(recipe, Math.min(view.viewCount, 5)); // Cap weight at 5
      }
    });

    // Process favorites (high weight)
    favorites.forEach(() => {
      const recipe = (favorites as any).find((f: any) => f.recipeId === recipe.id)?.recipe;
      if (recipe) {
        processRecipe(recipe, 3); // High weight for favorites
      }
    });

    // Process ratings (weight = rating)
    ratings.forEach((review) => {
      const recipe = (review as any).recipe;
      if (recipe) {
        processRecipe(recipe, review.rating);
      }
    });

    // Calculate averages
    if (recipeCount > 0) {
      preferenceProfile.avgPrepTime = totalPrepTime / recipeCount;
      preferenceProfile.avgCookTime = totalCookTime / recipeCount;
    }

    // Get top preferences
    preferenceProfile.preferredCategories = this.getTopItems(categoryCount, 10);
    preferenceProfile.preferredDifficulties = this.getTopItems(difficultyCount, 3) as ('easy' | 'medium' | 'hard')[];
    preferenceProfile.preferredIngredients = this.getTopItems(ingredientCount, 20);

    return preferenceProfile;
  }

  /**
   * Tính content-based score cho một công thức
   */
  async scoreRecipeForUser(
    recipeId: number,
    userId: number,
    userPreferenceProfile?: UserPreferenceProfile
  ): Promise<number> {
    try {
      // Lấy user preference profile nếu chưa có
      const profile = userPreferenceProfile || (await this.buildUserPreferenceProfile(userId));

      // Lấy embedding của recipe
      const recipeEmbedding = await embeddingService.getRecipeEmbedding(recipeId);
      if (!recipeEmbedding) {
        return 0; // Không có embedding = không thể tính content score
      }

      // Tạo embedding cho user preference
      const preferenceText = this.buildPreferenceText(profile);
      const preferenceEmbedding = await embeddingService.embedText([preferenceText]);
      if (!preferenceEmbedding || preferenceEmbedding.length === 0) {
        return 0;
      }

      // Tính cosine similarity
      const similarity = embeddingService.cosineSimilarity(
        recipeEmbedding.embedding,
        preferenceEmbedding[0]
      );

      // Normalize score to 0-1 range
      // Cosine similarity is already between -1 and 1, normalize to 0-1
      return (similarity + 1) / 2;
    } catch (error: any) {
      console.error(`[ContentBasedService] Failed to score recipe ${recipeId}:`, error.message);
      return 0;
    }
  }

  /**
   * Tính content scores cho nhiều công thức
   */
  async scoreRecipesForUser(
    recipeIds: number[],
    userId: number
  ): Promise<Map<number, number>> {
    const profile = await this.buildUserPreferenceProfile(userId);
    const preferenceText = this.buildPreferenceText(profile);
    
    let preferenceEmbedding: number[][] = [];
    try {
      preferenceEmbedding = await embeddingService.embedText([preferenceText]);
    } catch (error) {
      console.error('[ContentBasedService] Failed to embed preferences, using zero scores');
      return new Map(recipeIds.map(id => [id, 0]));
    }

    if (!preferenceEmbedding || preferenceEmbedding.length === 0) {
      return new Map(recipeIds.map(id => [id, 0]));
    }

    const embeddings = await embeddingService.getRecipeEmbeddings(recipeIds);
    const scores = new Map<number, number>();

    for (const recipeId of recipeIds) {
      const embedding = embeddings.get(recipeId);
      if (embedding) {
        const similarity = embeddingService.cosineSimilarity(embedding, preferenceEmbedding[0]);
        scores.set(recipeId, (similarity + 1) / 2);
      } else {
        scores.set(recipeId, 0);
      }
    }

    return scores;
  }

  /**
   * Tìm công thức tương tự với một công thức
   */
  async findSimilarRecipes(
    recipeId: number,
    limit: number = 10,
    excludeRecipeIds: number[] = []
  ): Promise<SimilarityResult[]> {
    try {
      // Lấy embedding của recipe gốc
      const sourceEmbedding = await embeddingService.getRecipeEmbedding(recipeId);
      if (!sourceEmbedding) {
        return [];
      }

      // Tìm tất cả recipes có embedding
      const excludeIds = [recipeId, ...excludeRecipeIds];
      const candidates = await Recipe.findAll({
        where: {
          status: 'visible',
          ...(excludeIds.length > 0 && {
            id: { [Op.notIn]: excludeIds },
          }),
        },
        attributes: ['id'],
      });

      const candidateIds = candidates.map(r => r.id);
      if (candidateIds.length === 0) {
        return [];
      }

      // Tính similarities
      const similarities = await embeddingService.findSimilarRecipes(
        sourceEmbedding.embedding,
        candidateIds,
        limit
      );

      return similarities.map(item => ({
        recipeId: item.recipeId,
        score: item.similarity,
      }));
    } catch (error: any) {
      console.error(`[ContentBasedService] Failed to find similar recipes for ${recipeId}:`, error.message);
      return [];
    }
  }

  /**
   * Xây dựng preference text từ profile
   */
  private buildPreferenceText(profile: UserPreferenceProfile): string {
    const parts: string[] = [];

    if (profile.preferredCategories.length > 0) {
      parts.push(`Tôi thích các món: ${profile.preferredCategories.join(', ')}`);
    }

    if (profile.preferredIngredients.length > 0) {
      parts.push(`Nguyên liệu tôi thường dùng: ${profile.preferredIngredients.slice(0, 10).join(', ')}`);
    }

    if (profile.preferredDifficulties.length > 0) {
      parts.push(`Độ khó tôi thích: ${profile.preferredDifficulties.join(', ')}`);
    }

    if (profile.avgPrepTime > 0) {
      parts.push(`Thời gian chuẩn bị trung bình: ${Math.round(profile.avgPrepTime)} phút`);
    }

    if (profile.avgCookTime > 0) {
      parts.push(`Thời gian nấu trung bình: ${Math.round(profile.avgCookTime)} phút`);
    }

    return parts.join('. ');
  }

  /**
   * Lấy top items từ count map
   */
  private getTopItems(countMap: Map<string, number>, limit: number): string[] {
    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item]) => item);
  }

  /**
   * Tạo user embedding vector từ liked recipes
   * (Simplified approach - average of liked recipe embeddings)
   */
  async createUserEmbeddingFromLikes(userId: number): Promise<number[] | null> {
    try {
      // Lấy embeddings của các công thức user đã favorite
      const favorites = await UserFavorite.findAll({
        where: { userId },
        include: [{ model: RecipeEmbedding, as: 'recipe' }],
        limit: 50,
      });

      const recipeEmbeddings: number[][] = [];
      for (const fav of favorites) {
        const recipeId = (fav as any).recipeId;
        const embedding = await embeddingService.getRecipeEmbedding(recipeId);
        if (embedding) {
          recipeEmbeddings.push(embedding.embedding);
        }
      }

      if (recipeEmbeddings.length === 0) {
        return null;
      }

      // Tính trung bình (mean pooling)
      const dim = recipeEmbeddings[0].length;
      const userEmbedding = new Array(dim).fill(0);

      for (const emb of recipeEmbeddings) {
        for (let i = 0; i < dim; i++) {
          userEmbedding[i] += emb[i];
        }
      }

      // Normalize
      const norm = Math.sqrt(userEmbedding.reduce((sum, val) => sum + val * val, 0));
      if (norm > 0) {
        return userEmbedding.map(v => v / norm);
      }

      return userEmbedding;
    } catch (error: any) {
      console.error(`[ContentBasedService] Failed to create user embedding for ${userId}:`, error.message);
      return null;
    }
  }
}

export const contentBasedService = new ContentBasedService();
export default contentBasedService;
