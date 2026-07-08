import requestCache from '../utils/requestCache';
import api from '../config/api';

export interface Favorite {
  id: number;
  recipeId: number;
  createdAt: string;
  recipe?: {
    id: number;
    recipeName: string;
    description?: string;
    imageUrl?: string;
    cookTime: number;
    prepTime: number;
    servings: number;
    difficulty: string;
    createdAt: string;
  };
}

export interface FavoritesResponse {
  success: boolean;
  message: string;
  data: {
    favorites: Favorite[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface FavoriteStatusResponse {
  success: boolean;
  message: string;
  data: {
    favorited: boolean;
    favorite?: Favorite | null;
  };
}

export interface FavoriteCountResponse {
  success: boolean;
  message: string;
  data: {
    recipeId: number;
    count: number;
  };
}

export interface FavoriteActionResponse {
  success: boolean;
  message: string;
  data: {
    favorite?: Favorite;
    favorited: boolean;
  };
}

export const favoriteService = {
  // Get all user favorites (with caching)
  async getUserFavorites(page = 1, limit = 20): Promise<FavoritesResponse> {
    const cacheKey = `favorites:user:${page}:${limit}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get('/api/favorites', {
          params: { page, limit }
        });
        return response.data;
      },
      30000 // Cache 30 seconds
    );
  },

  // Check if recipe is favorited (with caching)
  async checkFavoriteStatus(recipeId: number): Promise<FavoriteStatusResponse> {
    const cacheKey = `favorite:status:${recipeId}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get(`/api/favorites/check/${recipeId}`);
        return response.data;
      },
      10000 // Cache 10 seconds
    );
  },

  // Get favorite count for a recipe (with caching)
  async getFavoriteCount(recipeId: number): Promise<FavoriteCountResponse> {
    const cacheKey = `favorite:count:${recipeId}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get(`/api/favorites/count/${recipeId}`);
        return response.data;
      },
      15000 // Cache 15 seconds
    );
  },

  // Add recipe to favorites
  async addFavorite(recipeId: number): Promise<FavoriteActionResponse> {
    const response = await api.post(`/api/favorites/${recipeId}`);
    
    // Invalidate cache
    requestCache.invalidate(/^favorites:/); // Clear all favorite caches
    requestCache.invalidate(`favorite:status:${recipeId}`);
    requestCache.invalidate(`favorite:count:${recipeId}`);
    
    return response.data;
  },

  // Remove recipe from favorites
  async removeFavorite(recipeId: number): Promise<FavoriteActionResponse> {
    const response = await api.delete(`/api/favorites/${recipeId}`);
    
    // Invalidate cache
    requestCache.invalidate(/^favorites:/);
    requestCache.invalidate(`favorite:status:${recipeId}`);
    requestCache.invalidate(`favorite:count:${recipeId}`);
    
    return response.data;
  },

  // Toggle favorite (convenience method)
  async toggleFavorite(recipeId: number, currentState: boolean): Promise<FavoriteActionResponse> {
    return currentState 
      ? this.removeFavorite(recipeId)
      : this.addFavorite(recipeId);
  }
};

export default favoriteService;

