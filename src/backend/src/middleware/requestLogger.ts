import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Middleware to log all incoming requests
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  // Log request
  logger.http({
    message: 'Incoming request',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'http';

    logger.log(logLevel, {
      message: 'Request completed',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
};

/**
 * Middleware to log errors
 */
export const errorLogger = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({
    message: err.message || 'Internal Server Error',
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    statusCode: err.statusCode || 500,
    ip: req.ip,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  next(err);
};

