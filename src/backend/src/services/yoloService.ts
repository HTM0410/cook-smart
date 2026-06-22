import axios, { AxiosInstance, AxiosError } from 'axios';
import { yoloConfig, getYoloServiceUrl } from '../config/yolo';
import { yoloServiceAvailable } from '../middleware/monitoring';

export interface DetectedIngredient {
  yoloLabel: string;
  name: string;
  confidence: number;
  bbox?: number[];
}

export interface DetectIngredientsResponse {
  success: boolean;
  detected: boolean;
  ingredients: DetectedIngredient[];
  count: number;
  confidence_threshold?: number;
  timestamp: string;
}

export interface YoloHealthResponse {
  ok: boolean;
  model_loaded: boolean;
  embedding_model_loaded?: boolean;
  mlops_enabled?: boolean;
  model_path?: string;
  model_metadata?: Record<string, any>;
  class_count?: number;
  class_names?: string[];
  confidence_threshold?: number;
  timestamp?: string;
}

export interface YoloLabel {
  yolo_label: string;
  vietnamese_name: string;
}

export interface YoloLabelsResponse {
  labels: YoloLabel[];
  total_count: number;
}

class YoloService {
  private client: AxiosInstance;
  private healthCache: {
    data: YoloHealthResponse | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0,
  };

  constructor() {
    this.client = axios.create({
      baseURL: getYoloServiceUrl(),
      timeout: yoloConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const config = error.config as any;
        
        // Retry logic
        if (config && config._retryCount === undefined) {
          config._retryCount = 0;
        }
        
        if (
          config &&
          config._retryCount < yoloConfig.maxRetries &&
          this.isRetryableError(error)
        ) {
          config._retryCount += 1;
          
          await this.delay(yoloConfig.retryDelay * config._retryCount);
          console.log(`[YoloService] Retrying request (attempt ${config._retryCount}/${yoloConfig.maxRetries})`);
          
          return this.client(config);
        }
        
        throw error;
      }
    );
  }

  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
      // Network error or timeout
      return true;
    }
    
    // Retry on 5xx errors or 429 (rate limit)
    const status = error.response.status;
    return status >= 500 || status === 429;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getCachedHealth(): YoloHealthResponse | null {
    if (!yoloConfig.enableHealthCache || !this.healthCache.data) {
      return null;
    }
    
    const now = Date.now();
    if (now - this.healthCache.timestamp > yoloConfig.healthCacheTTL) {
      return null;
    }
    
    return this.healthCache.data;
  }

  private setHealthCache(data: YoloHealthResponse): void {
    if (yoloConfig.enableHealthCache) {
      this.healthCache = {
        data,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Update the base URL for the client
   */
  updateBaseUrl(url: string): void {
    this.client.defaults.baseURL = url;
    // Clear health cache when URL changes
    this.healthCache = { data: null, timestamp: 0 };
  }

  /**
   * Check if YOLO service is available and healthy
   */
  async checkHealth(forceRefresh = false): Promise<YoloHealthResponse> {
    // Return cached health if available
    if (!forceRefresh) {
      const cached = this.getCachedHealth();
      if (cached) {
        console.log('[YoloService] Returning cached health status');
        return cached;
      }
    }

    try {
      const response = await this.client.get<YoloHealthResponse>('/health');
      const healthData = response.data;
      yoloServiceAvailable.set(healthData.ok && healthData.model_loaded ? 1 : 0);
      this.setHealthCache(healthData);
      return healthData;
    } catch (error) {
      yoloServiceAvailable.set(0);
      console.error('[YoloService] Health check failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get detailed health information including model metadata
   */
  async getDetailedHealth(): Promise<YoloHealthResponse> {
    try {
      const response = await this.client.get<YoloHealthResponse>('/health/detailed');
      return response.data;
    } catch (error) {
      console.error('[YoloService] Detailed health check failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Detect ingredients from a base64-encoded image
   */
  async detectIngredients(
    imageBase64: string,
    mimeType?: string,
    minConfidence?: number
  ): Promise<DetectIngredientsResponse> {
    try {
      const response = await this.client.post<DetectIngredientsResponse>('/detect-ingredients', {
        imageBase64,
        mimeType,
        minConfidence: minConfidence ?? yoloConfig.defaultConfidence,
      });
      return response.data;
    } catch (error) {
      console.error('[YoloService] Ingredient detection failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get all supported labels from the YOLO service
   */
  async getLabels(): Promise<YoloLabelsResponse> {
    try {
      const response = await this.client.get<YoloLabelsResponse>('/labels');
      return response.data;
    } catch (error) {
      console.error('[YoloService] Get labels failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get service root information
   */
  async getServiceInfo(): Promise<any> {
    try {
      const response = await this.client.get('/');
      return response.data;
    } catch (error) {
      console.error('[YoloService] Get service info failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Convert image file to base64
   */
  static async fileToBase64(file: Buffer | ArrayBuffer | string): Promise<string> {
    if (typeof file === 'string') {
      // Already a base64 string, just remove data URL prefix if present
      return file.replace(/^data:image\/\w+;base64,/, '');
    }
    
    // Convert Buffer or ArrayBuffer to base64
    const buffer = Buffer.isBuffer(file) ? file : Buffer.from(file);
    return buffer.toString('base64');
  }

  /**
   * Get MIME type from filename or default to jpeg
   */
  static getMimeType(filename?: string): string {
    if (!filename) return 'image/jpeg';
    
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
    };
    
    return mimeTypes[ext || ''] || 'image/jpeg';
  }

  private handleError(error: any): Error {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.response) {
        // Server responded with error
        const status = axiosError.response.status;
        const data = axiosError.response.data;
        
        if (status === 503) {
          return new Error('YOLO service is not available. Model may not be loaded.');
        }
        if (status === 400) {
          return new Error(`Invalid request: ${((data as any)?.detail) || 'Bad request'}`);
        }
        
        return new Error(`YOLO service error (${status}): ${((data as any)?.detail) || error.message}`);
      }
      
      if (axiosError.code === 'ECONNABORTED') {
        return new Error('YOLO service request timed out');
      }
      
      if (axiosError.code === 'ECONNREFUSED') {
        return new Error('Cannot connect to YOLO service. Please ensure the service is running.');
      }
    }
    
    return new Error(`YOLO service error: ${error.message}`);
  }
}

// Export singleton instance
export const yoloService = new YoloService();

export default yoloService;

