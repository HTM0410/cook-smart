import axios from 'axios';
import requestCache from '../utils/requestCache';

import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface RatingStats {
  averageRating: number;
  ratingCount: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
  userRating: number | null;
}

export interface UserRating {
  id: number;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RatingSubmitResponse {
  success: boolean;
  data: {
    rating: UserRating;
    stats: RatingStats;
    status: 'created' | 'updated';
  };
  message: string;
}

export interface RatingStatsResponse {
  success: boolean;
  data: RatingStats;
}

export interface UserRatingResponse {
  success: boolean;
  data: {
    userRating: UserRating | null;
    hasRated: boolean;
  };
}

export const ratingService = {
  /**
   * Submit or update rating for a recipe
   */
  async submitRating(recipeId: number, rating: number, comment?: string): Promise<RatingSubmitResponse> {
    const response = await api.post(`/api/recipes/${recipeId}/rating`, {
      rating,
      comment,
    });
    
    // Invalidate cache
    requestCache.invalidate(`rating:stats:${recipeId}`);
    requestCache.invalidate(`rating:user:${recipeId}`);
    
    return response.data;
  },

  /**
   * Get rating statistics for a recipe
   */
  async getRatingStats(recipeId: number): Promise<RatingStatsResponse> {
    const cacheKey = `rating:stats:${recipeId}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get(`/api/recipes/${recipeId}/rating/stats`);
        return response.data;
      },
      30000 // Cache 30 seconds
    );
  },

  /**
   * Get user's rating for a recipe
   */
  async getUserRating(recipeId: number): Promise<UserRatingResponse> {
    const cacheKey = `rating:user:${recipeId}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get(`/api/recipes/${recipeId}/rating/user`);
        return response.data;
      },
      15000 // Cache 15 seconds
    );
  },

  /**
   * Delete user's rating
   */
  async deleteRating(recipeId: number): Promise<{ success: boolean; data: { stats: RatingStats }; message: string }> {
    const response = await api.delete(`/api/recipes/${recipeId}/rating`);
    
    // Invalidate cache
    requestCache.invalidate(`rating:stats:${recipeId}`);
    requestCache.invalidate(`rating:user:${recipeId}`);
    
    return response.data;
  },

  /**
   * Get all ratings for a recipe (paginated)
   */
  async getRecipeRatings(recipeId: number, page = 1, limit = 10) {
    const response = await api.get(`/api/recipes/${recipeId}/ratings`, {
      params: { page, limit },
    });
    return response.data;
  },
};

export default ratingService;

