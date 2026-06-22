import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface DetectedIngredient {
  yoloLabel: string;
  name: string;
  confidence: number;
  bbox?: number[];
}

export interface DbMatchedIngredient {
  id: number | null;
  name: string;
  inDatabase: boolean;
  categoryId?: number;
  categoryName?: string;
}

export interface DetectionResult {
  success: boolean;
  detected: boolean;
  ingredients: DetectedIngredient[];
  dbMatched: DbMatchedIngredient[];
  missing: string[];
  totalDetected: number;
  totalInDatabase: number;
}

export interface YoloHealth {
  available: boolean;
  modelLoaded: boolean;
  modelPath?: string;
  modelMetadata?: Record<string, any>;
  timestamp?: string;
}

export interface YoloInfo {
  available: boolean;
  modelLoaded: boolean;
  modelPath?: string;
  classCount?: number;
  classNames?: string[];
  supportedLabels?: number;
}

export interface YoloLabel {
  yolo_label: string;
  vietnamese_name?: string;
  name?: string;
  category?: string;
}

// Create axios instance for YOLO API
const yoloApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token if available
yoloApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const yoloService = {
  /**
   * Check YOLO service health
   */
  async checkHealth(refresh = false): Promise<YoloHealth> {
    const response = await yoloApi.get('/api/yolo/health', {
      params: { refresh },
    });
    return response.data.data;
  },

  /**
   * Get detailed YOLO service info
   */
  async getInfo(): Promise<YoloInfo> {
    const response = await yoloApi.get('/api/yolo/info');
    return response.data.data;
  },

  /**
   * Get all supported labels
   */
  async getLabels(): Promise<{ labels: YoloLabel[]; totalCount: number }> {
    const response = await yoloApi.get('/api/yolo/labels');
    return response.data.data;
  },

  /**
   * Detect ingredients from base64 image
   */
  async detectIngredients(
    imageBase64: string,
    options?: {
      mimeType?: string;
      minConfidence?: number;
    }
  ): Promise<DetectionResult> {
    const response = await yoloApi.post('/api/yolo/detect', {
      imageBase64,
      mimeType: options?.mimeType,
      minConfidence: options?.minConfidence,
    });
    return response.data.data;
  },

  /**
   * Detect ingredients and search for recipes
   */
  async searchRecipesByDetection(
    imageBase64: string,
    options?: {
      mimeType?: string;
      minConfidence?: number;
    }
  ): Promise<{
    detected: boolean;
    ingredients: DetectedIngredient[];
    matchedIngredients: Array<{ id: number; ingredientName: string }>;
    missingIngredients: string[];
    totalDetected: number;
    totalMatched: number;
  }> {
    const response = await yoloApi.post('/api/yolo/search-recipes', {
      imageBase64,
      mimeType: options?.mimeType,
      minConfidence: options?.minConfidence,
    });
    return response.data.data;
  },
};

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix if present
      const base64 = result.replace(/^data:image\/\w+;base64,/, '');
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get MIME type from file
 */
export function getMimeType(file: File): string {
  return file.type || 'image/jpeg';
}

/**
 * Compress image client-side before uploading
 * Reduces bandwidth and optimizes response time to 1-3 seconds
 */
export async function compressImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: string;
  } = {}
): Promise<{ base64: string; width: number; height: number; size: number }> {
  const { maxWidth = 800, maxHeight = 800, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Calculate new dimensions maintaining aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG
        const mimeType = options.mimeType || 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

        // Calculate size in bytes
        const size = Math.round((base64.length * 3) / 4);

        resolve({
          base64,
          width,
          height,
          size,
        });
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Validate image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  if (!validTypes.includes(file.type)) {
    return { valid: false, error: 'Ảnh không hợp lệ. Vui lòng chọn ảnh có định dạng JPG, PNG, hoặc WebP.' };
  }

  // Max 10MB
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 10MB.' };
  }

  return { valid: true };
}

/**
 * Create image hash for tracking (simple hash based on size and name)
 */
export function createImageHash(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString(36);
}

export interface DetectionHistory {
  id?: number;
  imageHash: string;
  originalIngredients: string[];
  finalIngredients: string[];
  wasModified: boolean;
  submittedBy?: number;
  createdAt?: Date;
}

export interface SaveDetectionHistoryRequest {
  imageHash: string;
  originalIngredients: string[];
  finalIngredients: string[];
  wasModified: boolean;
}

/**
 * Save detection history to backend
 */
export async function saveDetectionHistory(
  data: SaveDetectionHistoryRequest
): Promise<{ success: boolean; pendingId?: number }> {
  try {
    const response = await yoloApi.post('/api/yolo/save-history', data);
    return response.data.data;
  } catch (error) {
    console.error('[yoloService] Failed to save detection history:', error);
    return { success: false };
  }
}

export default yoloService;
