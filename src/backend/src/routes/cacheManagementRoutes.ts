import { Router, Request, Response } from 'express';
import commentCacheService from '../services/commentCacheService';
import { generalLimiter } from '../middleware/rateLimiter';

const router = Router();

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 */
router.get('/stats', generalLimiter, async (req: Request, res: Response) => {
  try {
    const stats = await commentCacheService.getStats();
    
    res.json({
      success: true,
      data: {
        cache: stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get cache stats',
      error: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/cache/comments/clear:
 *   post:
 *     summary: Clear all comment cache
 *     tags: [Cache Management]
 *     responses:
 *       200:
 *         description: Cache cleared successfully
 */
router.post('/comments/clear', generalLimiter, async (req: Request, res: Response) => {
  try {
    await commentCacheService.clearAll();
    
    res.json({
      success: true,
      message: 'Comment cache cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/cache/comments/warm:
 *   post:
 *     summary: Warm up cache for popular recipes
 *     tags: [Cache Management]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipeIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of recipe IDs to warm up
 *     responses:
 *       200:
 *         description: Cache warmed successfully
 */
router.post('/comments/warm', generalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { recipeIds } = req.body;
    
    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'recipeIds must be a non-empty array'
      });
      return;
    }

    await commentCacheService.warmPopularRecipes(recipeIds);
    
    res.json({
      success: true,
      message: `Cache warmed for ${recipeIds.length} recipes`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to warm cache',
      error: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/cache/comments/recipe/{recipeId}:
 *   delete:
 *     summary: Invalidate cache for a specific recipe
 *     tags: [Cache Management]
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recipe ID
 *     responses:
 *       200:
 *         description: Cache invalidated successfully
 */
router.delete('/comments/recipe/:recipeId', generalLimiter, async (req: Request, res: Response) => {
  try {
    const { recipeId } = req.params;
    
    await commentCacheService.invalidateRecipeComments(parseInt(recipeId));
    
    res.json({
      success: true,
      message: `Cache invalidated for recipe ${recipeId}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to invalidate cache',
      error: (error as Error).message
    });
  }
});

export default router;
