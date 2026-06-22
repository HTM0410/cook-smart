import rateLimit from 'express-rate-limit'

// Rate limiter cho authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Tối đa 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Không đếm các request thành công
})

// Rate limiter cho password reset
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // Tối đa 3 requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limiter cho general API
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // Dev: 1000, Prod: 100
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for WebSocket connections and localhost in dev
  skip: (req) => {
    // Skip WebSocket
    if (req.path.startsWith('/socket.io/') || req.path.includes('socket.io')) {
      return true;
    }
    // Skip localhost in development
    if (process.env.NODE_ENV === 'development' && req.ip === '::1') {
      return true;
    }
    return false;
  }
})

// Rate limiter cho search endpoints
export const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 phút
  max: 20, // Tối đa 20 search requests per minute
  message: {
    success: false,
    message: 'Too many search requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limiter cho upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 50, // Tối đa 50 uploads per hour
  message: {
    success: false,
    message: 'Too many upload attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
})
