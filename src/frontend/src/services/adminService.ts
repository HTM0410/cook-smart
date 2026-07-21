import axios from 'axios';

import { API_BASE_URL } from '../config/api';

// Mock data cho Model Registry — dùng khi backend route chưa có hoặc đang dev
const MOCK_REGISTRY_MODELS: RegistryModel[] = [
  {
    version: 'v12-yolov8m-finetune',
    filename: 'best.pt',
    createdAt: '2026-07-12T10:23:00Z',
    trainedAt: '2026-07-12T08:00:00Z',
    metrics: {
      precision: 0.842,
      recall: 0.798,
      mAP50: 0.851,
      mAP50_95: 0.673,
    },
    aliases: ['production', 'current'],
    sha256: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
    size: 52428800,
    notes: 'Baseline production - yolov8m finetuned trên 12k ảnh VN food',
    baseModel: 'yolov8m.pt',
    classes: 120,
    exists: true,
    filePath: 's3://cooksmart-models/yolo/v12/best.pt',
  },
  {
    version: 'v11-yolov8s-baseline',
    filename: 'best.pt',
    createdAt: '2026-06-20T14:15:00Z',
    trainedAt: '2026-06-20T11:00:00Z',
    metrics: {
      precision: 0.793,
      recall: 0.751,
      mAP50: 0.802,
      mAP50_95: 0.612,
    },
    aliases: ['staging'],
    sha256: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
    size: 22544384,
    notes: 'YOLOv8s baseline - nhỏ hơn, nhanh hơn, accuracy thấp hơn v12',
    baseModel: 'yolov8s.pt',
    classes: 120,
    exists: true,
    filePath: 's3://cooksmart-models/yolo/v11/best.pt',
  },
  {
    version: 'v10-yolov8l-experiment',
    filename: 'best.pt',
    createdAt: '2026-05-30T09:45:00Z',
    trainedAt: '2026-05-30T03:00:00Z',
    metrics: {
      precision: 0.871,
      recall: 0.823,
      mAP50: 0.879,
      mAP50_95: 0.701,
    },
    aliases: [],
    sha256: 'c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890',
    size: 87344384,
    notes: 'YOLOv8l experiment - accuracy cao nhất nhưng chậm, chưa promote',
    baseModel: 'yolov8l.pt',
    classes: 120,
    exists: false,
    filePath: 's3://cooksmart-models/yolo/v10/best.pt',
  },
  {
    version: 'v9-yolov8m-drift-fix',
    filename: 'best.pt',
    createdAt: '2026-05-10T16:20:00Z',
    trainedAt: '2026-05-10T12:00:00Z',
    metrics: {
      precision: 0.825,
      recall: 0.782,
      mAP50: 0.838,
      mAP50_95: 0.654,
    },
    aliases: ['archived'],
    sha256: 'd4e5f6789012345678901234567890abcdef1234567890abcdef123456789012',
    size: 52428800,
    notes: 'Drift fix version - retrained với feedback data từ production',
    baseModel: 'yolov8m.pt',
    classes: 120,
    exists: true,
    filePath: 's3://cooksmart-models/yolo/v9/best.pt',
  },
];

const MOCK_REGISTRY_OVERVIEW: RegistryOverview = {
  active: 'v12-yolov8m-finetune',
  models: MOCK_REGISTRY_MODELS,
};

// Bật mock khi env flag được set hoặc khi route /api/admin/models trả 404
const USE_MOCK_REGISTRY =
  import.meta.env.VITE_USE_MOCK_REGISTRY === 'true' ||
  import.meta.env.DEV === true;

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
    classMappings: Array<{
      yoloLabel: string;
      vietnameseName: string | null;
      category: string | null;
      isMapped: boolean;
    }>;
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

// ====================================================================
// Model Registry Types
// ====================================================================

export interface RegistryModel {
  version: string;
  filename: string;
  createdAt: string;
  trainedAt: string;
  metrics: {
    precision?: number;
    recall?: number;
    mAP50?: number;
    mAP50_95?: number;
  };
  aliases: string[];
  sha256: string;
  size: number;
  notes?: string;
  baseModel?: string;
  classes?: number;
  exists: boolean;
  filePath: string;
}

export interface RegistryOverview {
  active: string;
  models: RegistryModel[];
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
    const res = await api.get('/api/admin/dashboard/stats');
    return res.data;
  },

  async getMlopsOverview(): Promise<MlopsOverview> {
    const res = await api.get('/api/admin/mlops/overview');
    return res.data.data;
  },

  // Users Management
  async getUsers(params?: { page?: number; limit?: number; search?: string; status?: string; role?: string }) {
    const res = await api.get('/api/admin/users', { params });
    return res.data;
  },

  async updateUserStatus(userId: number, status: 'active' | 'banned') {
    const res = await api.put(`/api/admin/users/${userId}/status`, { status });
    return res.data;
  },

  async batchUpdateUsers(userIds: number[], action: string, value?: string) {
    const res = await api.post('/api/admin/users/batch', { userIds, action, value });
    return res.data;
  },

  // Recipes Management
  async getRecipes(params?: { page?: number; limit?: number; search?: string; status?: string; difficulty?: string }) {
    const res = await api.get('/api/admin/recipes', { params });
    return res.data;
  },

  async updateRecipeStatus(recipeId: number, status: 'visible' | 'hidden' | 'pending') {
    const res = await api.put(`/api/admin/recipes/${recipeId}/status`, { status });
    return res.data;
  },

  async updateRecipe(recipeId: number, data: any) {
    const res = await api.put(`/api/admin/recipes/${recipeId}`, data);
    return res.data;
  },

  async deleteRecipe(recipeId: number) {
    const res = await api.delete(`/api/admin/recipes/${recipeId}`);
    return res.data;
  },

  async batchUpdateRecipes(recipeIds: number[], action: string, value?: string) {
    const res = await api.post('/api/admin/recipes/batch', { recipeIds, action, value });
    return res.data;
  },

  // Ingredients Management
  async getIngredients(params?: { page?: number; limit?: number; search?: string; category?: string }) {
    const res = await api.get('/api/admin/ingredients', { params });
    return res.data;
  },

  async getIngredientCategories() {
    const res = await api.get('/api/ingredients/categories/all');
    return res.data;
  },

  async createIngredientCategory(data: { categoryName: string }) {
    const res = await api.post('/api/ingredients/categories', data);
    return res.data;
  },

  async updateIngredientCategory(id: number, data: { categoryName: string }) {
    const res = await api.put(`/api/ingredients/categories/${id}`, data);
    return res.data;
  },

  async deleteIngredientCategory(id: number) {
    const res = await api.delete(`/api/ingredients/categories/${id}`);
    return res.data;
  },

  // Comments Management
  async getComments(params?: { page?: number; limit?: number; search?: string; recipeId?: number; userId?: number }) {
    const res = await api.get('/api/admin/comments', { params });
    return res.data;
  },

  async deleteComment(commentId: number) {
    const res = await api.delete(`/api/admin/comments/${commentId}`);
    return res.data;
  },

  // ====================================================================
  // MLOps feedback review endpoints
  // ====================================================================

  async getFeedbackQueue(params?: { status?: 'pending' | 'approved' | 'rejected'; limit?: number }) {
    const res = await api.get('/api/admin/mlops/feedback/queue', { params });
    return res.data;
  },

  async getFeedbackStats() {
    const res = await api.get('/api/admin/mlops/feedback/stats');
    return res.data;
  },

  async decideFeedback(correctionId: number, status: 'approved' | 'rejected', notes?: string) {
    const res = await api.post(`/api/admin/mlops/feedback/${correctionId}/decision`, {
      status,
      notes,
    });
    return res.data;
  },

  async exportFeedback(payload: { approvedOnly?: boolean; maxCount?: number; tag?: string }) {
    const res = await api.post('/api/admin/mlops/feedback/export', payload);
    return res.data;
  },

  async syncFeedback() {
    const res = await api.post('/api/admin/mlops/feedback/sync');
    return res.data;
  },

  async releaseToPipeline() {
    const res = await api.post('/api/admin/mlops/release-to-pipeline', {});
    return res.data;
  },

  async getConfidenceThreshold() {
    const res = await api.get('/api/admin/mlops/threshold');
    return res.data;
  },

  async updateConfidenceThreshold(confidenceThreshold: number) {
    const res = await api.put('/api/admin/mlops/threshold', { confidenceThreshold });
    return res.data;
  },

  // ====================================================================
  // Model Registry endpoints
  // ====================================================================

  async getModelRegistry(): Promise<RegistryOverview> {
    if (USE_MOCK_REGISTRY) return MOCK_REGISTRY_OVERVIEW;
    try {
      const res = await api.get('/api/admin/models');
      return res.data.data;
    } catch (err: any) {
      if (err?.response?.status === 404) return MOCK_REGISTRY_OVERVIEW;
      throw err;
    }
  },

  async getModel(version: string): Promise<RegistryModel> {
    if (USE_MOCK_REGISTRY) {
      const m = MOCK_REGISTRY_MODELS.find(x => x.version === version);
      if (!m) throw new Error(`Model ${version} not found in mock`);
      return m;
    }
    const res = await api.get(`/api/admin/models/${version}`);
    return res.data.data;
  },

  async uploadModel(formData: FormData): Promise<any> {
    if (USE_MOCK_REGISTRY) {
      console.warn('[mock] uploadModel', formData.get('version'));
      return { success: true, mock: true };
    }
    const res = await api.post('/api/admin/models/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  async updateModel(version: string, updates: Partial<RegistryModel>): Promise<RegistryModel> {
    if (USE_MOCK_REGISTRY) {
      const i = MOCK_REGISTRY_MODELS.findIndex(x => x.version === version);
      if (i === -1) throw new Error(`Model ${version} not found in mock`);
      MOCK_REGISTRY_MODELS[i] = { ...MOCK_REGISTRY_MODELS[i], ...updates };
      return MOCK_REGISTRY_MODELS[i];
    }
    const res = await api.put(`/api/admin/models/${version}`, updates);
    return res.data.data;
  },

  async deleteModel(version: string): Promise<void> {
    if (USE_MOCK_REGISTRY) {
      const i = MOCK_REGISTRY_MODELS.findIndex(x => x.version === version);
      if (i >= 0) MOCK_REGISTRY_MODELS.splice(i, 1);
      return;
    }
    const res = await api.delete(`/api/admin/models/${version}`);
    return res.data;
  },

  async setActiveModel(version: string): Promise<void> {
    if (USE_MOCK_REGISTRY) {
      MOCK_REGISTRY_OVERVIEW.active = version;
      return;
    }
    const res = await api.post(`/api/admin/models/${version}/set-active`);
    return res.data;
  },

  async addModelAlias(version: string, alias: string): Promise<void> {
    if (USE_MOCK_REGISTRY) {
      const m = MOCK_REGISTRY_MODELS.find(x => x.version === version);
      if (m && !m.aliases.includes(alias)) m.aliases.push(alias);
      return;
    }
    const res = await api.post(`/api/admin/models/${version}/aliases`, { alias });
    return res.data;
  },

  async removeModelAlias(version: string, alias: string): Promise<void> {
    if (USE_MOCK_REGISTRY) {
      const m = MOCK_REGISTRY_MODELS.find(x => x.version === version);
      if (m) m.aliases = m.aliases.filter(a => a !== alias);
      return;
    }
    const res = await api.delete(`/api/admin/models/${version}/aliases/${alias}`);
    return res.data;
  },
};

export default adminService;

