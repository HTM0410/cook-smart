import dotenv from 'dotenv';

dotenv.config();

export const yoloConfig = {
  // YOLO Service URLs
  localUrl: process.env.YOLO_SERVICE_URL || 'http://localhost:8000',
  cloudUrl: process.env.YOLO_SERVICE_CLOUD_URL || '',
  
  // Timeout settings (in milliseconds)
  timeout: parseInt(process.env.YOLO_TIMEOUT || '30000', 10),
  
  // Retry settings
  maxRetries: parseInt(process.env.YOLO_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.YOLO_RETRY_DELAY || '1000', 10),
  
  // Confidence threshold for detection
  defaultConfidence: parseFloat(process.env.YOLO_DEFAULT_CONFIDENCE || '0.25'),
  
  // Health check interval (in milliseconds)
  healthCheckInterval: parseInt(process.env.YOLO_HEALTH_CHECK_INTERVAL || '60000', 10),
  
  // Cache settings
  enableHealthCache: process.env.YOLO_ENABLE_HEALTH_CACHE !== 'false',
  healthCacheTTL: parseInt(process.env.YOLO_HEALTH_CACHE_TTL || '30000', 10),
};

export function getYoloServiceUrl(): string {
  // Use cloud URL in production, local in development
  if (process.env.NODE_ENV === 'production' && yoloConfig.cloudUrl) {
    return yoloConfig.cloudUrl;
  }
  return yoloConfig.localUrl;
}

export default yoloConfig;
