import axios, { AxiosInstance, AxiosError } from 'axios';
import { yoloConfig, getYoloServiceUrl, isYoloAvailable } from '../config/yolo';
import { yoloServiceAvailable } from '../middleware/monitoring';

const UNAVAILABLE_HEALTH: import('./yoloService').YoloHealthResponse = {
  ok: false,
  model_loaded: false,
  timestamp: new Date().toISOString(),
};

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
  default_confidence_threshold?: number;
  runtime_confidence_threshold?: number;
  threshold_overridden?: boolean;
  timestamp?: string;
}

export interface YoloThresholdResponse {
  confidence_threshold: number;
  default_confidence_threshold: number;
  runtime_confidence_threshold: number;
  threshold_overridden: boolean;
  min: number;
  max: number;
  updated_at?: string | null;
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
  private inferenceClient: AxiosInstance;
  private healthCache: {
    data: YoloHealthResponse | null;
    timestamp: number;
  } = {
    data: null,
    timestamp: 0,
  };

  constructor() {
    const baseURL = getYoloServiceUrl();
    if (!baseURL) {
      console.warn(
        '[YoloService] YOLO base URL is not configured. Service will fail-fast on all calls.'
      );
    }
    this.client = axios.create({
      baseURL: baseURL || 'http://yolo.invalid',
      timeout: yoloConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Separate client for heavy inference endpoints (detect-ingredients) so
    // they get the larger 30s budget instead of the 6s used for control plane.
    this.inferenceClient = axios.create({
      baseURL: baseURL || 'http://yolo.invalid',
      timeout: yoloConfig.inferenceTimeout,
      headers: {
        'Content-Type': 'application/json',
      },
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        return this.handleRetryableError(error, this.client);
      }
    );
    this.inferenceClient.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        return this.handleRetryableError(error, this.inferenceClient);
      }
    );
  }

  private async handleRetryableError(error: AxiosError, client: AxiosInstance): Promise<any> {
    const config = error.config as any;

    if (config && config._retryCount === undefined) {
      config._retryCount = 0;
    }

    if (
      config &&
      config._retryCount < yoloConfig.maxRetries &&
      this.isRetryableError(error)
    ) {
      config._retryCount += 1;

      const backoffMs = yoloConfig.retryDelay * config._retryCount;
      await this.delay(backoffMs);
      console.log(
        `[YoloService] Retrying ${config.method?.toUpperCase()} ${config.url} ` +
          `(attempt ${config._retryCount}/${yoloConfig.maxRetries}, ` +
          `backoff ${backoffMs}ms)`
      );

      return client(config);
    }

    throw error;
  }

  private isRetryableError(error: AxiosError): boolean {
    // ECONNABORTED with timeout=true means we exceeded our own timeout; the
    // downstream service may simply be slow on this call. Retry with fresh
    // budget so the user doesn't see a hard 500 on the first cold-start.
    const isOwnTimeout =
      error.code === 'ECONNABORTED' &&
      (error.message?.includes('timeout') || (error as any).timeout);

    if (isOwnTimeout) {
      return true;
    }

    if (!error.response) {
      // Network error (DNS, connection refused, reset): retry once.
      return true;
    }

    // Retry on 5xx errors or 429 (rate limit).
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
    this.inferenceClient.defaults.baseURL = url;
    // Clear health cache when URL changes
    this.healthCache = { data: null, timestamp: 0 };
  }

  /**
   * Check if YOLO service is available and healthy
   */
  async checkHealth(forceRefresh = false): Promise<YoloHealthResponse> {
    if (!isYoloAvailable()) {
      yoloServiceAvailable.set(0);
      return UNAVAILABLE_HEALTH;
    }
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
    if (!isYoloAvailable()) return UNAVAILABLE_HEALTH;
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
    if (!isYoloAvailable()) {
      throw new Error('YOLO service is not available');
    }
    try {
      const response = await this.inferenceClient.post<DetectIngredientsResponse>(
        '/detect-ingredients',
        {
          imageBase64,
          mimeType,
          minConfidence: minConfidence ?? yoloConfig.defaultConfidence,
        }
      );
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
    if (!isYoloAvailable()) return { labels: [], total_count: 0 };
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
    if (!isYoloAvailable()) return null;
    try {
      const response = await this.client.get('/');
      return response.data;
    } catch (error) {
      console.error('[YoloService] Get service info failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Read the current runtime confidence threshold from the YOLO service.
   */
  async getRuntimeThreshold(): Promise<YoloThresholdResponse> {
    if (!isYoloAvailable()) {
      throw new Error('YOLO service is not available');
    }
    try {
      const response = await this.client.get<YoloThresholdResponse>('/config/threshold');
      return response.data;
    } catch (error) {
      console.error('[YoloService] Get runtime threshold failed:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update the runtime confidence threshold. Value is clamped to [0, 1] by
   * the YOLO service and persisted to disk so changes survive restarts.
   */
  async updateRuntimeThreshold(confidenceThreshold: number): Promise<YoloThresholdResponse> {
    if (!isYoloAvailable()) {
      throw new Error('YOLO service is not available');
    }
    const value = Number(confidenceThreshold);
    if (!Number.isFinite(value)) {
      throw new Error('Confidence threshold phải là số hợp lệ.');
    }
    if (value < 0 || value > 1) {
      throw new Error('Confidence threshold phải nằm trong khoảng [0, 1].');
    }
    try {
      const response = await this.client.put<YoloThresholdResponse>('/config/threshold', {
        confidence_threshold: value,
      });
      // Clear health cache so the next overview reads the new value
      this.healthCache = { data: null, timestamp: 0 };
      return response.data;
    } catch (error) {
      console.error('[YoloService] Update runtime threshold failed:', error);
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

