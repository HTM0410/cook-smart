import { Router } from 'express';
import {
  submitRating,
  getRatingStats,
  getUserRating,
  deleteRating,
  getRecipeRatings
} from '../controllers/ratingController';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting
router.use(generalLimiter);

/**
 * @route   POST /api/recipes/:recipeId/rating
 * @desc    Submit or update rating for a recipe
 * @access  Private (requires authentication)
 */
router.post('/recipes/:recipeId/rating', authenticateUser, submitRating);

/**
 * @route   GET /api/recipes/:recipeId/rating/stats
 * @desc    Get rating statistics for a recipe
 * @access  Public (with optional auth for user rating)
 */
router.get('/recipes/:recipeId/rating/stats', optionalAuth, getRatingStats);

/**
 * @route   GET /api/recipes/:recipeId/rating/user
 * @desc    Get user's rating for a recipe
 * @access  Private (requires authentication)
 */
router.get('/recipes/:recipeId/rating/user', optionalAuth, getUserRating);

/**
 * @route   DELETE /api/recipes/:recipeId/rating
 * @desc    Delete user's rating
 * @access  Private (requires authentication)
 */
router.delete('/recipes/:recipeId/rating', authenticateUser, deleteRating);

/**
 * @route   GET /api/recipes/:recipeId/ratings
 * @desc    Get all ratings for a recipe (paginated)
 * @access  Public
 */
router.get('/recipes/:recipeId/ratings', getRecipeRatings);

export default router;

