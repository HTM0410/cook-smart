import dotenv from 'dotenv';

dotenv.config();

// Production-grade timeouts:
// - Health/light endpoints (health, info, labels, config/threshold, model_metadata):
//   6s is enough; YOLO inside VPC responds in <500ms normally.
// - Heavy endpoints (detect-ingredients with model inference):
//   30s accommodates cold-start model load on first call after container start,
//   and large image uploads.
const FALLBACK_TIMEOUT_HEALTH_MS = 6000;
const FALLBACK_TIMEOUT_INFERENCE_MS = 30000;

function parseInt10(value: string | undefined, fallback: number): number {
  const n = parseInt(value || '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseFloat01(value: string | undefined, fallback: number): number {
  const n = parseFloat(value || '');
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

export const yoloConfig = {
  localUrl: process.env.YOLO_SERVICE_URL || 'http://localhost:8000',
  // CLOUD URL must be provided via runtime env (ECS task definition env var).
  // Empty string means "YOLO service not deployed; gracefully fail-fast".
  cloudUrl: process.env.YOLO_SERVICE_CLOUD_URL || '',

  // Timeouts: separate budget for "control plane" (health/info/labels/config)
  // vs "inference" (detect-ingredients). Inference can take 20s+ on cold model.
  timeout: parseInt10(process.env.YOLO_TIMEOUT, FALLBACK_TIMEOUT_HEALTH_MS),
  inferenceTimeout: parseInt10(
    process.env.YOLO_INFERENCE_TIMEOUT,
    FALLBACK_TIMEOUT_INFERENCE_MS
  ),
  maxRetries: parseInt10(process.env.YOLO_MAX_RETRIES, 2),
  retryDelay: parseInt10(process.env.YOLO_RETRY_DELAY, 1500),

  defaultConfidence: parseFloat01(process.env.YOLO_DEFAULT_CONFIDENCE, 0.25),

  healthCheckInterval: parseInt10(process.env.YOLO_HEALTH_CHECK_INTERVAL, 60000),

  enableHealthCache: process.env.YOLO_ENABLE_HEALTH_CACHE !== 'false',
  healthCacheTTL: parseInt10(process.env.YOLO_HEALTH_CACHE_TTL, 30000),
};

export function getYoloServiceUrl(): string {
  if (process.env.NODE_ENV === 'production') {
    if (!yoloConfig.cloudUrl) {
      console.warn(
        '[yolo.config] YOLO_SERVICE_CLOUD_URL is not set in production. YOLO endpoints will fail-fast.'
      );
      return '';
    }
    return yoloConfig.cloudUrl;
  }
  return yoloConfig.localUrl;
}

export function isYoloAvailable(): boolean {
  return Boolean(getYoloServiceUrl());
}

export default yoloConfig;