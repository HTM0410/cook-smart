import axios from 'axios';

import { API_BASE_URL } from '../config/api';

export interface MlopsFeedbackItem {
  id: number;
  imageHash: string;
  originalIngredients: string[];
  finalIngredients: string[];
  addedIngredients: string[];
  removedIngredients: string[];
  createdAt: string;
  submitter: {
    id: number;
    fullName: string;
    email: string;
  } | null;
}

export interface MlopsOverview {
  generatedAt: string;
  service: {
    available: boolean;
    ok: boolean;
    modelLoaded: boolean;
    embeddingModelLoaded: boolean;
    mlopsEnabled: boolean;
    modelPath: string | null;
    confidenceThreshold: number | null;
    timestamp: string | null;
    error: string | null;
  };
  model: {
    source: string;
    artifact: string | null;
    artifactVersion: string | null;
    runId: string | null;
    runUrl: string | null;
    gitRevision: string | null;
    createdAt: string | null;
    sha256: string | null;
    baseModel: string | null;
    classCount: number;
    classNames: string[];
    metrics: Record<string, number>;
  };
  schema: {
    compatible: boolean;
    mappedClassCount: number;
    missingMappings: string[];
    unusedMappings: string[];
  };
  feedback: {
    total: number;
    modified: number;
    last24Hours: number;
    modificationRate: number;
    recent: MlopsFeedbackItem[];
  };
  monitoring?: {
    grafanaUrl: string | null;
  };
  warnings: string[];
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const adminService = {
  // Dashboard Stats
  async getDashboardStats() {
    const res = await api.get('/admin/dashboard/stats');
    return res.data;
  },

  async getMlopsOverview(): Promise<MlopsOverview> {
    const res = await api.get('/admin/mlops/overview');
    return res.data.data;
  },

  // Users Management
  async getUsers(params?: { page?: number; limit?: number; search?: string; status?: string; role?: string }) {
    const res = await api.get('/admin/users', { params });
    return res.data;
  },

  async updateUserStatus(userId: number, status: 'active' | 'banned') {
    const res = await api.put(`/admin/users/${userId}/status`, { status });
    return res.data;
  },

  async batchUpdateUsers(userIds: number[], action: string, value?: string) {
    const res = await api.post('/admin/users/batch', { userIds, action, value });
    return res.data;
  },

  // Recipes Management
  async getRecipes(params?: { page?: number; limit?: number; search?: string; status?: string; difficulty?: string }) {
    const res = await api.get('/admin/recipes', { params });
    return res.data;
  },

  async updateRecipeStatus(recipeId: number, status: 'visible' | 'hidden' | 'pending') {
    const res = await api.put(`/admin/recipes/${recipeId}/status`, { status });
    return res.data;
  },

  async updateRecipe(recipeId: number, data: any) {
    const res = await api.put(`/admin/recipes/${recipeId}`, data);
    return res.data;
  },

  async deleteRecipe(recipeId: number) {
    const res = await api.delete(`/admin/recipes/${recipeId}`);
    return res.data;
  },

  async batchUpdateRecipes(recipeIds: number[], action: string, value?: string) {
    const res = await api.post('/admin/recipes/batch', { recipeIds, action, value });
    return res.data;
  },

  // Ingredients Management
  async getIngredients(params?: { page?: number; limit?: number; search?: string; category?: string }) {
    const res = await api.get('/admin/ingredients', { params });
    return res.data;
  },

  async getIngredientCategories() {
    const res = await api.get('/ingredients/categories/all');
    return res.data;
  },

  async createIngredientCategory(data: { categoryName: string }) {
    const res = await api.post('/ingredients/categories', data);
    return res.data;
  },

  async updateIngredientCategory(id: number, data: { categoryName: string }) {
    const res = await api.put(`/ingredients/categories/${id}`, data);
    return res.data;
  },

  async deleteIngredientCategory(id: number) {
    const res = await api.delete(`/ingredients/categories/${id}`);
    return res.data;
  },

  // Comments Management
  async getComments(params?: { page?: number; limit?: number; search?: string; recipeId?: number; userId?: number }) {
    const res = await api.get('/admin/comments', { params });
    return res.data;
  },

  async deleteComment(commentId: number) {
    const res = await api.delete(`/admin/comments/${commentId}`);
    return res.data;
  },
};

export default adminService;

