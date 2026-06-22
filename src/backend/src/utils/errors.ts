// Base Error Class
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Bad Request Error (400)
export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request', code?: string) {
    super(message, 400, code);
  }
}

// Unauthorized Error (401)
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized', code?: string) {
    super(message, 401, code);
  }
}

// Forbidden Error (403)
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden', code?: string) {
    super(message, 403, code);
  }
}

// Not Found Error (404)
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', code?: string) {
    super(message, 404, code);
  }
}

// Conflict Error (409)
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists', code?: string) {
    super(message, 409, code);
  }
}

// Validation Error (422)
export class ValidationError extends AppError {
  public errors: any[];

  constructor(message: string = 'Validation failed', errors: any[] = [], code?: string) {
    super(message, 422, code);
    this.errors = errors;
  }
}

// Internal Server Error (500)
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error', code?: string) {
    super(message, 500, code);
  }
}

// Database Error
export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', code?: string) {
    super(message, 500, code);
  }
}

// Service Unavailable Error (503)
export class ServiceUnavailableError extends AppError {
  constructor(message: string = 'Service unavailable', code?: string) {
    super(message, 503, code);
  }
}

