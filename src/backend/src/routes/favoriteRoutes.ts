import { Router } from 'express';
import {
  getUserFavorites,
  addFavorite,
  removeFavorite,
  checkFavoriteStatus,
  getFavoriteCount,
  validateRecipeId
} from '../controllers/favoriteController';
import { authenticateFavoriteParticipant } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting
router.use(generalLimiter);

/**
 * @swagger
 * /api/favorites:
 *   get:
 *     summary: Get all favorite recipes for current user
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Favorites retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     favorites:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           recipeId:
 *                             type: integer
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           recipe:
 *                             type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/', authenticateFavoriteParticipant, getUserFavorites);

/**
 * @swagger
 * /api/favorites/check/{recipeId}:
 *   get:
 *     summary: Check if recipe is favorited by current user
 *     tags: [Favorites]
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recipe ID
 *     responses:
 *       200:
 *         description: Favorite status checked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     favorited:
 *                       type: boolean
 *                     favorite:
 *                       type: object
 *                       nullable: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/check/:recipeId', validateRecipeId, checkFavoriteStatus);

/**
 * @swagger
 * /api/favorites/count/{recipeId}:
 *   get:
 *     summary: Get favorite count for a recipe
 *     tags: [Favorites]
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recipe ID
 *     responses:
 *       200:
 *         description: Favorite count retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recipeId:
 *                       type: integer
 *                     count:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/count/:recipeId', validateRecipeId, getFavoriteCount);

/**
 * @swagger
 * /api/favorites/{recipeId}:
 *   post:
 *     summary: Add recipe to favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recipe ID
 *     responses:
 *       201:
 *         description: Recipe added to favorites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     favorite:
 *                       type: object
 *                     favorited:
 *                       type: boolean
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/:recipeId', authenticateFavoriteParticipant, validateRecipeId, addFavorite);

/**
 * @swagger
 * /api/favorites/{recipeId}:
 *   delete:
 *     summary: Remove recipe from favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recipe ID
 *     responses:
 *       200:
 *         description: Recipe removed from favorites
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     favorited:
 *                       type: boolean
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:recipeId', authenticateFavoriteParticipant, validateRecipeId, removeFavorite);

export default router;

