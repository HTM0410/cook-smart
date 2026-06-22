import axios from 'axios';
import {
  Recipe,
  RecipeResponse,
  RecipesResponse,
  SearchRecipesRequest,
  SearchRecipesResponse,
  AutocompleteResponse,
  KeywordSearchResponse,
  IngredientMatchRecipe,
} from '../types/recipe';
import requestCache from '../utils/requestCache';

// Vite import.meta.env typing is provided via vite-env.d.ts
import { API_BASE_URL } from '../config/api';

// Create axios instance
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

export const recipeService = {
  // Get all recipes with pagination (with caching)
  async getRecipes(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
  }): Promise<RecipesResponse> {
    const cacheKey = `recipes:${JSON.stringify(params || {})}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get('/api/recipes', { params });
        return response.data;
      },
      30000 // Cache 30 seconds
    );
  },

  // Get recipe by ID (with caching)
  async getRecipeById(id: number): Promise<RecipeResponse> {
    const cacheKey = `recipe:${id}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get(`/api/recipes/${id}`);
        return response.data;
      },
      60000 // Cache 1 minute
    );
  },

  // Search recipes by ingredients
  async searchRecipesByIngredients(searchData: SearchRecipesRequest): Promise<SearchRecipesResponse> {
    const response = await api.post('/api/recipes/by-ingredients', searchData);
    return response.data;
  },

  async searchRecipesByKeyword(params: {
    keyword?: string;
    difficulty?: string[];
    min_time?: number;
    max_time?: number;
    servings?: number;
    cuisine?: string;
    course?: string;
    tags?: string[];
    page?: number;
    limit?: number;
  }): Promise<KeywordSearchResponse> {
    const searchParams: any = { ...params };
    if (searchParams.tags && Array.isArray(searchParams.tags)) {
      searchParams.tags = searchParams.tags.join(',');
    }
    const response = await api.get('/api/recipes/search', { params: searchParams });
    return response.data;
  },

  // Tìm kiếm thông minh: tự động phát hiện và tìm kiếm cả tên món và nguyên liệu
  async searchRecipesSmartly(query: string, options?: {
    difficulty?: string[];
    prepTimeMax?: number;
    cookTimeMax?: number;
    servingsMin?: number;
    servingsMax?: number;
    cuisine?: string;
    course?: string;
    tags?: string[];
    page?: number;
    limit?: number;
  }): Promise<{
    recipes: Recipe[];
    searchType: 'keyword' | 'ingredients' | 'combined';
    keywordResults?: Recipe[];
    ingredientResults?: IngredientMatchRecipe[];
  }> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return { recipes: [], searchType: 'keyword' };
    }

    // Phân tích query: nếu có dấu phẩy, coi như nhiều nguyên liệu
    const hasComma = trimmedQuery.includes(',');
    const parts = trimmedQuery.split(',').map(p => p.trim()).filter(Boolean);

    // Nếu có dấu phẩy hoặc nhiều từ, coi như nguyên liệu
    if (hasComma || parts.length > 1) {
      try {
        const ingredientResponse = await this.searchRecipesByIngredients({
          ingredients: parts,
          difficulty: options?.difficulty,
          prepTimeMax: options?.prepTimeMax,
          cookTimeMax: options?.cookTimeMax,
          servingsMin: options?.servingsMin,
          servingsMax: options?.servingsMax,
          cuisine: options?.cuisine,
          course: options?.course,
          tags: options?.tags,
          page: options?.page || 1,
          limit: options?.limit || 20,
        });
        
        const ingredientRecipes = ingredientResponse.data?.recipes || [];
        return {
          recipes: ingredientRecipes as any,
          searchType: 'ingredients',
          ingredientResults: ingredientRecipes,
        };
      } catch (error) {
        console.error('Ingredient search error:', error);
        // Fallback to keyword search
      }
    }

    // Tìm kiếm theo tên món
    try {
      const keywordResponse = await this.searchRecipesByKeyword({
        keyword: trimmedQuery,
        difficulty: options?.difficulty,
        min_time: options?.cookTimeMax,
        max_time: options?.cookTimeMax,
        servings: options?.servingsMin || options?.servingsMax,
        cuisine: options?.cuisine,
        course: options?.course,
        tags: options?.tags,
        page: options?.page || 1,
        limit: options?.limit || 20,
      });

      const keywordRecipes = keywordResponse.data?.recipes || [];

      // Tạm thời bỏ qua việc tự động tìm thêm theo ingredients để tránh quá nhiều requests
      // Người dùng có thể tự thêm ingredients vào filter nếu muốn

      return {
        recipes: keywordRecipes,
        searchType: 'keyword',
        keywordResults: keywordRecipes,
      };
    } catch (error) {
      console.error('Keyword search error:', error);
      return { recipes: [], searchType: 'keyword' };
    }
  },

  // Autocomplete ingredients (with caching)
  async autocompleteIngredients(query: string, limit: number = 10): Promise<AutocompleteResponse> {
    const cacheKey = `autocomplete:${query}:${limit}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get('/api/search/ingredients/autocomplete', {
          params: { q: query, limit },
        });
        // Nếu không có suggestions, không cache (để retry lần sau)
        if (!response.data?.data?.suggestions?.length) {
          throw new Error('NO_CACHE');
        }
        return response.data;
      },
      30000 // Cache 30 giây
    ).catch(() => {
      // Nếu cache fail hoặc không có kết quả, call trực tiếp
      return api.get('/api/search/ingredients/autocomplete', {
        params: { q: query, limit },
      }).then(res => res.data);
    });
  },

  // Get all ingredients
  async getIngredients(params?: {
    page?: number;
    limit?: number;
    search?: string;
    categoryId?: number;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
  }) {
    const response = await api.get('/api/ingredients', { params });
    return response.data;
  },

  // Get ingredient categories
  async getIngredientCategories() {
    const response = await api.get('/api/ingredients/categories/all');
    return response.data;
  },

  // Track search keyword
  async trackSearchKeyword(keyword: string): Promise<void> {
    try {
      await api.post('/api/search-keywords/track', { keyword });
    } catch (error) {
      // Silent fail - không ảnh hưởng đến UX nếu tracking fail
      console.warn('Failed to track search keyword:', error);
    }
  },

  // Get trending keywords
  async getTrendingKeywords(limit: number = 10, days: number = 30): Promise<string[]> {
    try {
      const response = await api.get('/api/search-keywords/trending', {
        params: { limit, days },
      });
      return response.data?.data?.keywords?.map((k: any) => k.keyword) || [];
    } catch (error: any) {
      // Silently fail if endpoint doesn't exist (feature may be disabled)
      if (error?.response?.status === 404) {
        return [];
      }
      console.error('Failed to fetch trending keywords:', error);
      return [];
    }
  },
};

export default recipeService;
