import axios from 'axios';
import {
  MealPlan,
  CreateMealPlanRequest,
  AddRecipeToMealPlanRequest,
  UpdateMealPlanItemRequest,
  GroceryList,
  IngredientConflict,
} from '../types/mealPlan';
import { API_BASE_URL } from '../config/api';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error('Không thể kết nối server. Vui lòng kiểm tra kết nối internet.');
    } else if (error.response.status === 401) {
      toast.error('Vui lòng đăng nhập lại.');
    }
    return Promise.reject(error);
  }
);

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export const mealPlanService = {
  async createMealPlan(data: CreateMealPlanRequest): Promise<ApiResponse<MealPlan>> {
    const response = await api.post('/api/meal-plans', data);
    return response.data;
  },

  async getMealPlans(): Promise<ApiResponse<MealPlan[]>> {
    const response = await api.get('/api/meal-plans');
    return response.data;
  },

  async getMealPlanById(id: number): Promise<ApiResponse<MealPlan>> {
    const response = await api.get(`/api/meal-plans/${id}`);
    return response.data;
  },

  async addRecipeToMealPlan(
    mealPlanId: number,
    data: AddRecipeToMealPlanRequest
  ): Promise<ApiResponse<{ item: any; conflicts: IngredientConflict[] }>> {
    const response = await api.post(`/api/meal-plans/${mealPlanId}/items`, data);
    return response.data;
  },

  async removeRecipeFromMealPlan(
    mealPlanId: number,
    itemId: number
  ): Promise<ApiResponse<{ success: boolean; conflicts: IngredientConflict[] }>> {
    const response = await api.delete(`/api/meal-plans/${mealPlanId}/items/${itemId}`);
    return response.data;
  },

  async updateMealPlanItem(
    mealPlanId: number,
    itemId: number,
    data: UpdateMealPlanItemRequest
  ): Promise<ApiResponse<{ item: any; conflicts: IngredientConflict[] }>> {
    const response = await api.patch(`/api/meal-plans/${mealPlanId}/items/${itemId}`, data);
    return response.data;
  },

  async deleteMealPlan(id: number): Promise<ApiResponse<{ success: boolean }>> {
    const response = await api.delete(`/api/meal-plans/${id}`);
    return response.data;
  },

  async updateMealPlanStatus(
    id: number,
    status: 'active' | 'completed' | 'archived'
  ): Promise<ApiResponse<MealPlan>> {
    const response = await api.patch(`/api/meal-plans/${id}/status`, { status });
    return response.data;
  },

  async getGroceryList(
    mealPlanId: number,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<GroceryList>> {
    const params: any = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    const response = await api.get(`/api/meal-plans/${mealPlanId}/grocery-list`, { params });
    return response.data;
  },
};

export default mealPlanService;
