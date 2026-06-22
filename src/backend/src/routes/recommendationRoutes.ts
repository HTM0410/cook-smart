/**
 * Recommendation Routes
 * API endpoints cho hệ thống gợi ý
 */

import { Router } from 'express';
import {
  getRecommendations,
  getPopularRecipes,
  getSimilarRecipes,
  recordView,
  getUserViewHistory,
  regenerateEmbeddings,
  retrainModel,
  getHealthStatus,
  getTrendingRecipes,
} from '../controllers/recommendationController';
import { optionalAuth, authenticateAdmin, requireAdmin } from '../middleware/auth';

const router = Router();

/**
 * @route GET /api/recommendations
 * @desc Lấy danh sách gợi ý personalized cho user
 * @access Public (with optional auth for personalization)
 */
router.get('/', optionalAuth, getRecommendations);

/**
 * @route GET /api/recommendations/popular
 * @desc Lấy danh sách công thức phổ biến
 * @access Public
 */
router.get('/popular', getPopularRecipes);

/**
 * @route GET /api/recommendations/trending
 * @desc Lấy danh sách công thức trending
 * @access Public
 */
router.get('/trending', getTrendingRecipes);

/**
 * @route GET /api/recommendations/similar/:recipeId
 * @desc Lấy công thức tương tự với một công thức
 * @access Public
 */
router.get('/similar/:recipeId', getSimilarRecipes);

/**
 * @route GET /api/recommendations/health
 * @desc Lấy thông tin health check của recommendation system
 * @access Public
 */
router.get('/health', getHealthStatus);

/**
 * @route POST /api/recommendations/regenerate-embeddings
 * @desc Tạo lại embeddings cho tất cả công thức (Admin only)
 * @access Private (Admin)
 */
router.post('/regenerate-embeddings', authenticateAdmin, requireAdmin, regenerateEmbeddings);

/**
 * @route POST /api/recommendations/retrain
 * @desc Retrain recommendation model (Admin only)
 * @access Private (Admin)
 */
router.post('/retrain', authenticateAdmin, requireAdmin, retrainModel);

/**
 * @route POST /api/interactions/view
 * @desc Ghi nhận lượt xem công thức
 * @access Public (userId required in body)
 */
router.post('/view', recordView);

/**
 * @route GET /api/interactions/views/:userId
 * @desc Lấy lịch sử xem của user
 * @access Public (userId in path)
 */
router.get('/views/:userId', getUserViewHistory);

export default router;
