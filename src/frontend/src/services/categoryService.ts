import axios from 'axios';

import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface RecipeCategory {
  id: number;
  categoryName: string;
  categoryType: 'cuisine' | 'course' | 'tag';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  recipeCount?: number;
}

export interface CategoriesResponse {
  success: boolean;
  message: string;
  data: {
    categories: RecipeCategory[];
  };
}

export interface CategoryResponse {
  success: boolean;
  message: string;
  data: {
    category: RecipeCategory;
  };
}

export interface RecipeCategoriesResponse {
  success: boolean;
  message: string;
  data: {
    recipeId: number;
    categories: RecipeCategory[];
  };
}

export const categoryService = {
  /**
   * Get all categories with optional type filter
   */
  async getAllCategories(type?: 'cuisine' | 'course' | 'tag'): Promise<CategoriesResponse> {
    const params = type ? { type } : {};
    const response = await api.get('/api/categories', { params });
    return response.data;
  },

  /**
   * Get category by ID
   */
  async getCategoryById(id: number): Promise<CategoryResponse> {
    const response = await api.get(`/api/categories/${id}`);
    return response.data;
  },

  /**
   * Get categories for a recipe
   */
  async getRecipeCategories(recipeId: number): Promise<RecipeCategoriesResponse> {
    const response = await api.get(`/api/recipes/${recipeId}/categories`);
    return response.data;
  },

  /**
   * Search recipes by category filters
   */
  async searchRecipesByCategory(params: {
    cuisine?: string;
    course?: string;
    tags?: string[];
    keyword?: string;
    difficulty?: string[];
    minTime?: number;
    maxTime?: number;
    servings?: number;
    page?: number;
    limit?: number;
  }, signal?: AbortSignal) {
    const searchParams: any = {};
    if (params.cuisine) searchParams.cuisine = params.cuisine;
    if (params.course) searchParams.course = params.course;
    if (params.tags && params.tags.length > 0) searchParams.tags = params.tags.join(',');
    if (params.keyword) searchParams.keyword = params.keyword;
    if (params.difficulty) searchParams.difficulty = params.difficulty.join(',');
    if (params.minTime) searchParams.min_time = params.minTime;
    if (params.maxTime) searchParams.max_time = params.maxTime;
    if (params.servings) searchParams.servings = params.servings;
    if (params.page) searchParams.page = params.page;
    if (params.limit) searchParams.limit = params.limit;

    const response = await api.get('/api/recipes/search', { 
      params: searchParams,
      signal,
    });
    return response.data;
  },
};

export default categoryService;

