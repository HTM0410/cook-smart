import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

interface ErrorResponse {
  success: false;
  message: string;
  error?: {
    code?: string;
    details?: any;
    stack?: string;
  };
}

// Format error response
const formatErrorResponse = (err: AppError, includeStack: boolean = false): ErrorResponse => {
  const response: ErrorResponse = {
    success: false,
    message: err.message || 'An error occurred',
  };

  if (err.code || err.isOperational || includeStack) {
    response.error = {};
    
    if (err.code) {
      response.error.code = err.code;
    }

    if ((err as any).errors) {
      response.error.details = (err as any).errors;
    }

    if (includeStack && err.stack) {
      response.error.stack = err.stack;
    }
  }

  return response;
};

// Handle Sequelize Validation Errors
const handleSequelizeValidationError = (err: any): AppError => {
  const errors = err.errors?.map((e: any) => ({
    field: e.path,
    message: e.message,
    value: e.value
  })) || [];

  const customError = new AppError('Validation failed', 422, 'VALIDATION_ERROR');
  (customError as any).errors = errors;
  return customError;
};

// Handle Sequelize Unique Constraint Errors
const handleSequelizeUniqueConstraintError = (err: any): AppError => {
  const field = err.errors?.[0]?.path || 'field';
  const value = err.errors?.[0]?.value || 'value';
  
  return new AppError(
    `${field} '${value}' already exists`,
    409,
    'UNIQUE_CONSTRAINT_ERROR'
  );
};

// Handle Sequelize Foreign Key Constraint Errors
const handleSequelizeForeignKeyConstraintError = (err: any): AppError => {
  return new AppError(
    'Referenced resource does not exist',
    400,
    'FOREIGN_KEY_CONSTRAINT_ERROR'
  );
};

// Handle Sequelize Database Errors
const handleSequelizeDatabaseError = (err: any): AppError => {
  // Check for specific database error codes
  if (err.parent?.code === 'ER_DUP_ENTRY') {
    return new AppError('Duplicate entry', 409, 'DUPLICATE_ENTRY');
  }

  if (err.parent?.code === 'ER_NO_REFERENCED_ROW_2') {
    return new AppError('Referenced resource does not exist', 400, 'INVALID_REFERENCE');
  }

  return new AppError('Database error occurred', 500, 'DATABASE_ERROR');
};

// Handle JWT Errors
const handleJWTError = (): AppError => {
  return new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');
};

const handleJWTExpiredError = (): AppError => {
  return new AppError('Token expired. Please log in again.', 401, 'TOKEN_EXPIRED');
};

// Main Error Handler Middleware
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  // Log error for debugging
  console.error('Error occurred:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Convert known errors to AppError
  if (err.name === 'SequelizeValidationError') {
    error = handleSequelizeValidationError(err);
  } else if (err.name === 'SequelizeUniqueConstraintError') {
    error = handleSequelizeUniqueConstraintError(err);
  } else if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = handleSequelizeForeignKeyConstraintError(err);
  } else if (err.name === 'SequelizeDatabaseError') {
    error = handleSequelizeDatabaseError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  } else if (!(err instanceof AppError)) {
    // Unknown errors - convert to AppError
    error = new AppError(
      process.env.NODE_ENV === 'production' 
        ? 'Something went wrong' 
        : err.message,
      500,
      'INTERNAL_SERVER_ERROR'
    );
  }

  const appError = error as AppError;
  const statusCode = appError.statusCode || 500;
  const includeStack = process.env.NODE_ENV === 'development';

  // Send error response
  res.status(statusCode).json(formatErrorResponse(appError, includeStack));
};

// 404 Not Found Handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError(
    `Route ${req.originalUrl} not found`,
    404,
    'ROUTE_NOT_FOUND'
  );
  next(error);
};

// Async Handler Wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

