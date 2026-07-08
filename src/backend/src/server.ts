console.log('📦 server.ts: Starting imports...');

// Global handlers - log instead of crashing so the API can still start
process.on('unhandledRejection', (reason: any) => {
  console.error('⚠️  Unhandled Promise Rejection:', reason?.message || reason);
  if (reason?.stack) console.error('   Stack:', reason.stack);
});
process.on('uncaughtException', (err: any) => {
  console.error('⚠️  Uncaught Exception:', err?.message || err);
  if (err?.stack) console.error('   Stack:', err.stack);
});

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

console.log('📦 Basic imports OK');

import swaggerUi from 'swagger-ui-express';
import { createServer } from 'http';

console.log('📦 Server imports OK');

// Database config - Switch to Supabase PostgreSQL
import { connectDB, sequelize } from './config/database-supabase';
// To switch back to MySQL, use: './config/database'

console.log('📦 Database import OK');

import './models'; // Load all models and associations

console.log('📦 Models import OK');

import logger, { stream } from './config/logger';
import { requestLogger, errorLogger } from './middleware/requestLogger';
import { metricsHandler, metricsMiddleware } from './middleware/monitoring';

console.log('📦 Logger import OK');

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
import yoloRoutes from './routes/yoloRoutes';
import chatRoutes from './routes/chatRoutes';
import recommendationRoutes from './routes/recommendationRoutes';
import mealPlanRoutes from './routes/mealPlanRoutes';
import conflictRoutes from './routes/conflictRoutes';
// import searchKeywordRoutes from './routes/searchKeywordRoutes'; // Tạm thời comment để debug

console.log('📦 Routes import OK');

import { generalLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { compressionMiddleware, responseHeadersMiddleware } from './utils/response';

console.log('📦 Middleware import OK');

import swaggerSpec from './config/swagger';

console.log('📦 Swagger import OK');

import SocketServer from './socket/socketServer';

console.log('📦 Socket import OK');
console.log('📦 All imports completed successfully!');

dotenv.config();
console.log('📦 dotenv.config() called');

const app = express();
console.log('📦 Express app created');

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Configure Helmet to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// Allow all origins in development
const isDevelopment = process.env.NODE_ENV !== 'production';
const defaultOrigins = isDevelopment
  ? '*'
  : [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'http://127.0.0.1:5175',
    ].join(',');

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.CLIENT_URL || defaultOrigins)
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In development, allow any origin
    if (isDevelopment || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Allow localhost on common dev ports even when NODE_ENV is not development
    if (/^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
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
import path from 'path';
const uploadsPath = path.resolve(__dirname, '../uploads');
console.log('📁 Static uploads path:', uploadsPath);
const fs = require('fs');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
  console.log('📁 Created uploads directory');
}
console.log('📁 Uploads path exists:', fs.existsSync(uploadsPath));
app.use('/uploads', express.static(uploadsPath));

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
app.use('/api/yolo', yoloRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/interactions', recommendationRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/conflicts', conflictRoutes);
// app.use('/api/search-keywords', searchKeywordRoutes); // Tạm thời comment để debug

// Error Handlers (MUST be after all routes)
app.use(errorLogger);
app.use(notFoundHandler);
app.use(errorHandler);

// Connect to DB and sync models
console.log('🚀 Starting server initialization...');
console.log('📋 Environment variables check:');
console.log(`   - SUPABASE_DB_URL: ${process.env.SUPABASE_DB_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`   - SUPABASE_DB_HOST: ${process.env.SUPABASE_DB_HOST ? '✅ Set' : '❌ Missing'}`);
console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   - PORT: ${process.env.PORT || 3000}`);

// Debug: Log SUPABASE_DB_URL format (masked)
if (process.env.SUPABASE_DB_URL) {
  const url = process.env.SUPABASE_DB_URL;
  const masked = url.replace(/:([^:@]+)@/, ':****@');
  console.log(`   - SUPABASE_DB_URL (masked): ${masked.substring(0, 100)}...`);
  // Check port
  const portMatch = url.match(/:(\d+)\//);
  if (portMatch) {
    const port = portMatch[1];
    console.log(`   - Database port: ${port}`);
    if (url.includes('pooler') && port === '5432') {
      console.error('   ⚠️  WARNING: Pooler hostname với port 5432 - nên dùng port 6543!');
    }
  }
}

console.log('🔄 Proceeding to database connection...');
console.log('🔄 Attempting to connect to Supabase database...');
connectDB().then(async () => {
  try {
    console.log('🔄 Đang sync database models...');
    const shouldAlterSchema = process.env.DB_SYNC_ALTER === 'true';

    if (shouldAlterSchema) {
      console.warn('⚠️  DB_SYNC_ALTER=true => chạy sync với alter, chỉ nên dùng cho môi trường dev tạm thời.');
      await sequelize.sync({ alter: true });
    } else {
      await sequelize.sync();
    }

    console.log('📦 Database synced successfully.');
    
    const PORT = process.env.PORT || 3000;

    console.log('🔄 Creating HTTP server...');
    // Create HTTP server
    const server = createServer(app);
    console.log('✅ HTTP server created');

    console.log('🔄 Initializing Socket.IO...');
    // Initialize Socket.IO
    const socketServer = new SocketServer(server);
    console.log('✅ Socket.IO initialized');

    console.log('🔄 Starting to listen...');
    server.listen(Number(PORT), '0.0.0.0', () => {
      console.log('✅ Server started on port', PORT);
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`🌐 API URL: http://localhost:${PORT}`);
      logger.info(`📖 API Docs: http://localhost:${PORT}/api-docs`);
      logger.info(`❤️  Health Check: http://localhost:${PORT}/health`);
      logger.info(`🔌 WebSocket server initialized`);
      logger.info(`📡 Socket.IO ready for real-time connections`);
      logger.info(`🟢 Environment: ${process.env.NODE_ENV || 'development'}`);
    }).on('error', (err: any) => {
      console.error('❌ Server listen error:', err.code, err.message);
    });
  } catch (error) {
    console.error('❌ Database sync failed:', error);
    console.error('❌ Error details:', error);
    process.exit(1);
  }
}).catch((error) => {
  console.error('❌ Failed to connect to database:', error);
  console.error('❌ Error details:', error);
  console.error('❌ Server will not start without database connection.');
  process.exit(1);
});
