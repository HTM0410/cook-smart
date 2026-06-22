import { Request, Response, NextFunction } from 'express';
import cacheService from '../services/cacheService';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

/**
 * Get cache statistics
 * GET /api/cache/stats
 */
export const getCacheStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = cacheService.getStats();
    const memoryInfo = await cacheService.getMemoryInfo();

    res.json({
      success: true,
      message: 'Cache statistics retrieved successfully',
      data: {
        stats,
        memory: memoryInfo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear specific cache by pattern
 * DELETE /api/cache/clear
 */
export const clearCache = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { pattern, key } = req.body;

    if (!pattern && !key) {
      throw new BadRequestError('Either pattern or key must be provided', 'MISSING_PARAMETER');
    }

    let result: boolean | number;

    if (pattern) {
      result = await cacheService.delPattern(pattern);
    } else {
      result = await cacheService.del(key);
    }

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      data: {
        cleared: result,
        pattern: pattern || null,
        key: key || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Clear all cache (Admin only)
 * DELETE /api/cache/clear-all
 */
export const clearAllCache = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is admin (you might want to add proper admin authentication)
    const isAdmin = req.user?.role === 'admin' || req.user?.isAdmin;
    
    if (!isAdmin) {
      throw new UnauthorizedError('Admin access required', 'ADMIN_REQUIRED');
    }

    const result = await cacheService.clearAll();

    res.json({
      success: true,
      message: 'All cache cleared successfully',
      data: {
        cleared: result,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Warm up cache
 * POST /api/cache/warm-up
 */
export const warmUpCache = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await cacheService.warmUpCache();

    res.json({
      success: true,
      message: 'Cache warm-up completed successfully',
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Invalidate recipe caches
 * DELETE /api/cache/recipe/:recipeId
 */
export const invalidateRecipeCache = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const recipeIdNum = parseInt(recipeId);

    if (isNaN(recipeIdNum)) {
      throw new BadRequestError('Invalid recipe ID', 'INVALID_RECIPE_ID');
    }

    await cacheService.invalidateRecipeCaches(recipeIdNum);

    res.json({
      success: true,
      message: 'Recipe cache invalidated successfully',
      data: {
        recipeId: recipeIdNum,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Invalidate user caches
 * DELETE /api/cache/user/:userId
 */
export const invalidateUserCache = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const userIdNum = parseInt(userId);

    if (isNaN(userIdNum)) {
      throw new BadRequestError('Invalid user ID', 'INVALID_USER_ID');
    }

    await cacheService.invalidateUserCaches(userIdNum);

    res.json({
      success: true,
      message: 'User cache invalidated successfully',
      data: {
        userId: userIdNum,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset cache statistics
 * POST /api/cache/reset-stats
 */
export const resetCacheStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    cacheService.resetStats();

    res.json({
      success: true,
      message: 'Cache statistics reset successfully',
      data: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
};
