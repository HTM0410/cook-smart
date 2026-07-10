// Export Express app for serverless deployment (Netlify Functions)
// This file exports the Express app without starting the server

import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

console.log('📦 app.ts: Starting imports...');
// ECS Deploy: 2026-07-10 - Updated for production deployment

import swaggerUi from 'swagger-ui-express';

// Database config - Switch to Supabase PostgreSQL
import { connectDB, sequelize } from './config/database-supabase';

import './models'; // Load all models and associations

import logger, { stream } from './config/logger';
import { requestLogger, errorLogger } from './middleware/requestLogger';
import { metricsHandler, metricsMiddleware } from './middleware/monitoring';

import authRoutes from './routes/authRoutes';
import recipeRoutes from './routes/recipeRoutes';
import ingredientRoutes from './routes/ingredientRoutes';
import searchRoutes from './routes/searchRoutes';
import cacheRoutes from './routes/cacheRoutes';
import commentRoutes from './routes/commentRoutes';
import cacheManagementRoutes from './routes/cacheManagementRoutes';
import adminRoutes from './routes/adminRoutes';
import pendingIngredientRoutes from './routes/pendingIngredientRoutes';
import profileRoutes from './routes/profileRoutes';
import shareRoutes from './routes/shareRoutes';
import healthRoutes from './routes/healthRoutes';
import favoriteRoutes from './routes/favoriteRoutes';
import ratingRoutes from './routes/ratingRoutes';
import categoryRoutes from './routes/categoryRoutes';
import mealPlanRoutes from './routes/mealPlanRoutes';
import conflictRoutes from './routes/conflictRoutes';
import chatRoutes from './routes/chatRoutes';
import yoloRoutes from './routes/yoloRoutes';

import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { compressionMiddleware, responseHeadersMiddleware } from './utils/response';

import swaggerSpec from './config/swagger';

dotenv.config();

const app = express();

// Trust proxy for deployment
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// Allow all localhost origins in development for flexibility
const isDevelopment = process.env.NODE_ENV !== 'production';
const defaultOrigins = isDevelopment
  ? '*' // Allow all in dev
  : 'http://localhost:5173';

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || defaultOrigins)
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Optional wildcard subdomain matching (e.g. *.netlify.app) so Netlify preview
// deploys are accepted without redeploying env vars.
const allowedOriginRegexes: RegExp[] = (process.env.CORS_ORIGIN_REGEX || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
  .map((pattern) => new RegExp(pattern));

function isOriginAllowed(origin: string): boolean {
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  return allowedOriginRegexes.some((re) => re.test(origin));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In development, allow any origin (including all localhost ports)
    if (isDevelopment || isOriginAllowed(origin)) {
      return callback(null, true);
    }

    // Log rejected origins for debugging
    console.warn(`⚠️ CORS: Origin ${origin} not allowed`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Logging middleware
app.use(morgan('combined', { stream }));
app.use(requestLogger);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);

// Serve static files from uploads folder
// Note: multer saves to ../../uploads from config folder, which resolves to src/backend/uploads
const uploadsPath = path.resolve(__dirname, '../uploads');
console.log('📁 Static uploads path:', uploadsPath);
console.log('📁 Uploads path exists:', require('fs').existsSync(uploadsPath));
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '1d',
  etag: true,
  fallthrough: false // Return 404 immediately if file not found
}));

// Response formatting & compression
app.use(compressionMiddleware);
app.use(responseHeadersMiddleware);

// Apply general rate limiting
app.use(generalLimiter);

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'CookSmart API Docs',
}));

// Swagger JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: '🍳 CookSmart API is running...',
    version: '1.0.0',
    platform: process.env.NETLIFY ? 'Netlify Functions' : 'Express Server',
    endpoints: {
      auth: '/api/auth',
      recipes: '/api/recipes',
      ingredients: '/api/ingredients',
      search: '/api/search',
      cache: '/api/cache',
      cacheManagement: '/api/cache-management',
      admin: '/api/admin',
      pendingIngredients: '/api/admin/pending-ingredients',
      comments: '/api/recipes/:recipeId/comments',
favorites: '/api/favorites',
        categories: '/api/categories',
        chat: '/api/chat',
        health: '/health',
        docs: '/api-docs'
    }
  });
});

// Health check routes
app.use('/health', healthRoutes);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/cache-management', cacheManagementRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api', ratingRoutes);
app.use('/api', pendingIngredientRoutes);
app.use('/api', commentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/conflicts', conflictRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/yolo', yoloRoutes);

// Error Handlers (MUST be after all routes)
app.use(errorLogger);
app.use(notFoundHandler);
app.use(errorHandler);

// Export app for serverless
export default app;

// Export database initialization function
export async function initializeDatabase() {
  try {
    await connectDB();
    const shouldAlterSchema = process.env.DB_SYNC_ALTER === 'true';
    
    if (shouldAlterSchema) {
      console.warn('⚠️  DB_SYNC_ALTER=true => chạy sync với alter, chỉ nên dùng cho môi trường dev tạm thời.');
      await sequelize.sync({ alter: true });
    } else {
      await sequelize.sync();
    }
    
    console.log('📦 Database synced successfully.');
    return true;
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    throw error;
  }
}
