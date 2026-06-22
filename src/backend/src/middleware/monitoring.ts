import { NextFunction, Request, Response } from 'express';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'cooksmart_',
});

const httpRequests = new Counter({
  name: 'cooksmart_http_requests_total',
  help: 'Total HTTP requests received by the CookSmart backend.',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

const httpDuration = new Histogram({
  name: 'cooksmart_http_request_duration_seconds',
  help: 'CookSmart backend HTTP request duration in seconds.',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const yoloServiceAvailable = new Gauge({
  name: 'cooksmart_yolo_service_available',
  help: 'Whether the upstream YOLO service is available (1) or unavailable (0).',
  registers: [metricsRegistry],
});

function normalizedRoute(req: Request): string {
  if (req.route?.path) {
    return `${req.baseUrl || ''}${req.route.path}`;
  }
  return (req.path || 'unknown')
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:uuid');
}

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === '/metrics') {
    next();
    return;
  }

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const duration = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const labels = {
      method: req.method,
      route: normalizedRoute(req),
      status_code: String(res.statusCode),
    };
    httpRequests.inc(labels);
    httpDuration.observe(labels, duration);
  });
  next();
};

export const metricsHandler = async (req: Request, res: Response): Promise<void> => {
  const token = process.env.METRICS_TOKEN;
  if (token && req.header('Authorization') !== `Bearer ${token}`) {
    res.status(401).json({ success: false, message: 'Invalid metrics token' });
    return;
  }

  res.setHeader('Content-Type', metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
};
