import { Response } from 'express';
import compression from 'compression';

// Response interfaces
export interface SuccessResponse<T = any> {
  success: true;
  message?: string;
  data: T;
  meta?: {
    timestamp: string;
    [key: string]: any;
  };
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T = any> {
  success: true;
  message?: string;
  data: T[];
  pagination: PaginationMeta;
  meta?: {
    timestamp: string;
    [key: string]: any;
  };
}

// Success response helper
export const sendSuccess = <T = any>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: any
): void => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };

  if (message) {
    response.message = message;
  }

  res.status(statusCode).json(response);
};

// Created response helper (201)
export const sendCreated = <T = any>(
  res: Response,
  data: T,
  message: string = 'Resource created successfully',
  meta?: any
): void => {
  sendSuccess(res, data, message, 201, meta);
};

// Paginated response helper
export const sendPaginated = <T = any>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
  message?: string,
  meta?: any
): void => {
  const response: PaginatedResponse<T> = {
    success: true,
    data,
    pagination,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };

  if (message) {
    response.message = message;
  }

  res.status(200).json(response);
};

// No content response helper (204)
export const sendNoContent = (res: Response): void => {
  res.status(204).send();
};

// Calculate pagination metadata
export const calculatePagination = (
  page: number,
  limit: number,
  totalItems: number
): PaginationMeta => {
  const totalPages = Math.ceil(totalItems / limit);
  
  return {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
};

// Compression configuration
export const compressionMiddleware = compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9, 6 is default)
  threshold: 1024, // Only compress responses larger than 1KB
});

// Response headers middleware
export const responseHeadersMiddleware = (req: any, res: Response, next: any) => {
  // API versioning
  res.setHeader('X-API-Version', '1.0.0');
  // Explicitly enable ETag for better client-side caching (Express enables by default, this is explicit)
  res.setHeader('ETag-Enabled', 'true');
  
  // Response time tracking
  const start = Date.now();
  
  // Override res.json to add response time before sending
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const duration = Date.now() - start;
    res.setHeader('X-Response-Time', `${duration}ms`);
    return originalJson(body);
  };
  
  next();
};

// Cache-Control middleware factory
export type CachePrivacy = 'public' | 'private';

export const setCacheControl = (
  seconds: number,
  privacy: CachePrivacy = 'public',
  extras: string[] = []
) => {
  return (_req: any, res: Response, next: any) => {
    const directives = [`max-age=${seconds}`, privacy, 'must-revalidate', ...extras];
    res.setHeader('Cache-Control', directives.join(', '));
    next();
  };
};

// Format response with consistent structure
export const formatResponse = {
  success: sendSuccess,
  created: sendCreated,
  paginated: sendPaginated,
  noContent: sendNoContent
};

// Simple response helpers for controllers
export const successResponse = <T = any>(message: string, data?: T) => ({
  success: true,
  message,
  data: data || {}
});

export const errorResponse = (message: string, error?: any) => ({
  success: false,
  message,
  error: error || {}
});

// Lightweight payload helpers used by controllers that set the HTTP status
// themselves before calling res.json().
export const success = <T = any>(data: T, message?: string) => ({
  success: true,
  ...(message ? { message } : {}),
  data,
});

export const error = (message: string, details?: any) => ({
  success: false,
  message,
  ...(details !== undefined ? { error: details } : {}),
});

