import express from 'express';
import {
  getCacheStats,
  clearCache,
  clearAllCache,
  warmUpCache,
  invalidateRecipeCache,
  invalidateUserCache,
  resetCacheStats,
} from '../controllers/cacheController';
import { generalLimiter } from '../middleware/rateLimiter';

const router = express.Router();

// Apply rate limiting to all cache routes
router.use(generalLimiter);

// Cache statistics
router.get('/stats', getCacheStats);

// Cache management
router.delete('/clear', clearCache);
router.delete('/clear-all', clearAllCache);
router.post('/warm-up', warmUpCache);
router.post('/reset-stats', resetCacheStats);

// Specific cache invalidation
router.delete('/recipe/:recipeId', invalidateRecipeCache);
router.delete('/user/:userId', invalidateUserCache);

export default router;
