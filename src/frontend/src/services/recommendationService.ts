import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import requestCache from '../utils/requestCache';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface RecommendedRecipe {
  id: number;
  recipeName: string;
  description?: string | null;
  imageUrl?: string | null;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  averageRating: number;
  reviewCount: number;
  totalViews: number;
  totalFavorites: number;
  categories: Array<{
    id: number;
    categoryName: string;
    categoryType: 'cuisine' | 'course' | 'tag';
  }>;
  score: {
    recipeId: number;
    contentScore: number;
    collaborativeScore: number;
    popularityScore: number;
    finalScore: number;
  };
  reason: 'personalized' | 'similar_to_favorites' | 'similar_to_history' | 'popular' | 'trending' | 'new_recipe' | 'cold_start_fallback';
}

export interface RecommendationMetadata {
  generatedAt: string;
  algorithm: string;
  weightsUsed?: {
    content: number;
    collaborative: number;
    popularity: number;
  };
  userProfile?: {
    interactionCount: number;
    isColdStart: boolean;
  };
}

export interface RecommendationResponse {
  success: boolean;
  message: string;
  data: {
    recipes: RecommendedRecipe[];
    pagination?: {
      total: number;
      limit: number;
      offset: number;
    };
    metadata?: RecommendationMetadata;
  };
}

export interface PopularRecipesResponse {
  success: boolean;
  message: string;
  data: {
    recipes: RecommendedRecipe[];
    pagination?: {
      total: number;
      limit: number;
      offset: number;
    };
  };
}

export interface TrendingRecipesResponse {
  success: boolean;
  message: string;
  data: {
    recipes: RecommendedRecipe[];
    period: string;
  };
}

/**
 * Check if user is logged in
 */
export const isUserLoggedIn = (): boolean => {
  const token = localStorage.getItem('token');
  return !!token;
};

/**
 * Get current user ID from localStorage
 */
export const getCurrentUserId = (): number | null => {
  const userId = localStorage.getItem('userId');
  return userId ? parseInt(userId, 10) : null;
};

export const recommendationService = {
  /**
   * Get personalized recommendations for a logged-in user
   */
  async getPersonalizedRecommendations(
    userId: number,
    limit: number = 10,
    options?: {
      categoryFilter?: string;
      difficultyFilter?: ('easy' | 'medium' | 'hard')[];
      maxPrepTime?: number;
    }
  ): Promise<RecommendationResponse> {
    const cacheKey = `personalized:${userId}:${limit}`;

    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const params: Record<string, any> = { limit };
        if (options?.categoryFilter) params.categoryFilter = options.categoryFilter;
        if (options?.difficultyFilter) params.difficultyFilter = options.difficultyFilter;
        if (options?.maxPrepTime) params.maxPrepTime = options.maxPrepTime;

        const response = await api.get('/api/recommendations', {
          params,
          headers: {
            'x-user-id': userId.toString(),
          },
        });
        return response.data;
      },
      5 * 60 * 1000 // Cache 5 minutes
    );
  },

  /**
   * Get popular recipes (for guest users)
   */
  async getPopularRecipes(limit: number = 10): Promise<PopularRecipesResponse> {
    const cacheKey = `popular:${limit}`;

    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get('/api/recommendations/popular', {
          params: { limit },
        });
        return response.data;
      },
      10 * 60 * 1000 // Cache 10 minutes
    );
  },

  /**
   * Get trending recipes (for guest users)
   */
  async getTrendingRecipes(
    limit: number = 10,
    days: number = 7
  ): Promise<TrendingRecipesResponse> {
    const cacheKey = `trending:${days}:${limit}`;

    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get('/api/recommendations/trending', {
          params: { limit, days },
        });
        return response.data;
      },
      10 * 60 * 1000 // Cache 10 minutes
    );
  },

  /**
   * Get similar recipes for a specific recipe
   */
  async getSimilarRecipes(
    recipeId: number,
    limit: number = 10,
    excludeRecipeIds: number[] = []
  ): Promise<RecommendationResponse> {
    const excludeStr = excludeRecipeIds.length > 0 ? excludeRecipeIds.join(',') : undefined;

    return requestCache.getOrFetch(
      `similar:${recipeId}:${limit}:${excludeStr || 'none'}`,
      async () => {
        const response = await api.get(`/api/recommendations/similar/${recipeId}`, {
          params: { limit, excludeRecipeIds: excludeStr },
        });
        return response.data;
      },
      30 * 60 * 1000 // Cache 30 minutes
    );
  },

  /**
   * Get recommendations for homepage based on user login status
   */
  async getHomepageRecommendations(limit: number = 10) {
    const userId = getCurrentUserId();

    if (userId && isUserLoggedIn()) {
      try {
        // User is logged in - get personalized recommendations
        const response = await this.getPersonalizedRecommendations(userId, limit);
        return {
          recipes: response.data?.recipes || [],
          isPersonalized: true,
          userId,
          metadata: response.data?.metadata,
        };
      } catch (error) {
        console.error('Failed to get personalized recommendations:', error);
        // Fallback to popular recipes on error
      }
    }

    // Guest user or fallback - get popular + trending
    try {
      const [popularResponse, trendingResponse] = await Promise.all([
        this.getPopularRecipes(limit),
        this.getTrendingRecipes(limit, 7),
      ]);

      // Combine and deduplicate recipes
      const seenIds = new Set<number>();
      const combinedRecipes: RecommendedRecipe[] = [];

      // Add trending first (higher priority)
      for (const recipe of trendingResponse.data?.recipes || []) {
        if (!seenIds.has(recipe.id)) {
          seenIds.add(recipe.id);
          combinedRecipes.push(recipe);
        }
      }

      // Add popular recipes that aren't in trending
      for (const recipe of popularResponse.data?.recipes || []) {
        if (!seenIds.has(recipe.id) && combinedRecipes.length < limit) {
          seenIds.add(recipe.id);
          combinedRecipes.push(recipe);
        }
      }

      return {
        recipes: combinedRecipes.slice(0, limit),
        isPersonalized: false,
        metadata: {
          trending: trendingResponse.data?.period || '7d',
        },
      };
    } catch (error) {
      console.error('Failed to get homepage recommendations:', error);
      return {
        recipes: [],
        isPersonalized: false,
        error: 'Failed to load recommendations',
      };
    }
  },
};

export default recommendationService;
