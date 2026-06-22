/**
 * Recommendation Controller
 * Xử lý các request liên quan đến hệ thống gợi ý
 */

import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import {
  hybridRecommendationService,
  embeddingService,
  collaborativeFilteringService,
  popularityService,
} from '../services/recommendation';
import { UserView, Recipe, User } from '../models';
import {
  GetRecommendationsRequest,
  RecordViewRequest,
} from '../types/recommendation';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

/**
 * Lấy danh sách gợi ý personalized cho user
 * GET /api/recommendations
 */
export const getRecommendations = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = parseInt(req.query.userId as string, 10) || (req.user?.id);

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    const request: GetRecommendationsRequest = {
      userId,
      limit: parseInt(req.query.limit as string, 10) || 10,
      excludeRecipeIds: req.query.excludeRecipeIds
        ? (JSON.parse(req.query.excludeRecipeIds as string) as number[])
        : [],
      categoryFilter: req.query.categoryFilter as string,
      difficultyFilter: req.query.difficultyFilter
        ? (JSON.parse(req.query.difficultyFilter as string) as ('easy' | 'medium' | 'hard')[])
        : undefined,
      maxPrepTime: req.query.maxPrepTime
        ? parseInt(req.query.maxPrepTime as string, 10)
        : undefined,
      includeReason: req.query.includeReason !== 'false',
    };

    const result = await hybridRecommendationService.getRecommendations(request);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[RecommendationController] getRecommendations error:', error);
    next(error);
  }
};

/**
 * Lấy danh sách công thức phổ biến
 * GET /api/recommendations/popular
 */
export const getPopularRecipes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const recipes = await hybridRecommendationService.getPopularRecipes(limit);

    res.json({
      success: true,
      data: {
        recipes,
        count: recipes.length,
      },
    });
  } catch (error: any) {
    console.error('[RecommendationController] getPopularRecipes error:', error);
    next(error);
  }
};

/**
 * Lấy công thức tương tự với một công thức
 * GET /api/recommendations/similar/:recipeId
 */
export const getSimilarRecipes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const recipeId = parseInt(req.params.recipeId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const excludeRecipeIds = req.query.excludeRecipeIds
      ? (JSON.parse(req.query.excludeRecipeIds as string) as number[])
      : [];

    if (!recipeId) {
      res.status(400).json({
        success: false,
        error: 'Recipe ID is required',
      });
      return;
    }

    const recipes = await hybridRecommendationService.getSimilarRecipes(
      recipeId,
      limit,
      excludeRecipeIds
    );

    res.json({
      success: true,
      data: {
        recipes,
        count: recipes.length,
        sourceRecipeId: recipeId,
      },
    });
  } catch (error: any) {
    console.error('[RecommendationController] getSimilarRecipes error:', error);
    next(error);
  }
};

/**
 * Ghi nhận lượt xem công thức
 * POST /api/interactions/view
 */
export const recordView = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId, recipeId } = req.body as RecordViewRequest;

    if (!userId || !recipeId) {
      res.status(400).json({
        success: false,
        error: 'userId and recipeId are required',
      });
      return;
    }

    // Verify recipe exists
    const recipe = await Recipe.findByPk(recipeId);
    if (!recipe) {
      res.status(404).json({
        success: false,
        error: 'Recipe not found',
      });
      return;
    }

    // Upsert view record
    const [userView, created] = await UserView.findOrCreate({
      where: { userId, recipeId },
      defaults: {
        userId,
        recipeId,
        viewCount: 1,
        lastViewedAt: new Date(),
      },
    });

    if (!created) {
      userView.viewCount += 1;
      userView.lastViewedAt = new Date();
      await userView.save();
    }

    res.json({
      success: true,
      data: {
        viewId: userView.id,
        viewCount: userView.viewCount,
      },
    });
  } catch (error: any) {
    console.error('[RecommendationController] recordView error:', error);
    next(error);
  }
};

/**
 * Lấy lịch sử xem của user
 * GET /api/interactions/views/:userId
 */
export const getUserViewHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    if (!userId) {
      res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
      return;
    }

    const views = await UserView.findAndCountAll({
      where: { userId },
      include: [{
        model: Recipe,
        as: 'recipe',
        where: { status: 'visible' },
        required: true,
      }],
      order: [['lastViewedAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        views: views.rows.map((v: any) => ({
          recipeId: v.recipeId,
          recipeName: v.recipe?.recipeName,
          imageUrl: v.recipe?.imageUrl,
          viewCount: v.viewCount,
          lastViewedAt: v.lastViewedAt,
        })),
        pagination: {
          total: views.count,
          limit,
          offset,
        },
      },
    });
  } catch (error: any) {
    console.error('[RecommendationController] getUserViewHistory error:', error);
    next(error);
  }
};

/**
 * Tạo lại embeddings cho tất cả công thức (Admin only)
 * POST /api/recommendations/regenerate-embeddings
 */
export const regenerateEmbeddings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check admin role
    if (req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
      return;
    }

    const limit = req.body.limit ? parseInt(req.body.limit, 10) : undefined;

    console.log('[RecommendationController] Starting embedding regeneration...');
    const result = await embeddingService.embedAllRecipes(limit);

    res.json({
      success: true,
      data: {
        processed: result.processed,
        failed: result.failed,
      },
      message: `Processed ${result.processed} recipes, ${result.failed} failed`,
    });
  } catch (error: any) {
    console.error('[RecommendationController] regenerateEmbeddings error:', error);
    next(error);
  }
};

/**
 * Retrain recommendation model (Admin only)
 * POST /api/recommendations/retrain
 */
export const retrainModel = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check admin role
    if (req.user?.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
      return;
    }

    const k = req.body.k ? parseInt(req.body.k, 10) : 20;

    console.log(`[RecommendationController] Starting model retraining with k=${k}...`);
    await hybridRecommendationService.refreshModel();

    res.json({
      success: true,
      message: 'Model retraining completed',
    });
  } catch (error: any) {
    console.error('[RecommendationController] retrainModel error:', error);
    next(error);
  }
};

/**
 * Lấy thông tin health check của recommendation system
 * GET /api/recommendations/health
 */
export const getHealthStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const health = await hybridRecommendationService.healthCheck();
    const collabInfo = collaborativeFilteringService.getModelInfo();

    res.json({
      success: true,
      data: {
        services: health,
        model: {
          isTrained: collabInfo.isTrained,
          lastUpdated: collabInfo.lastUpdated,
          matrixSize: collabInfo.matrixSize,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[RecommendationController] getHealthStatus error:', error);
    next(error);
  }
};

/**
 * Lấy thông tin trending recipes
 * GET /api/recommendations/trending
 */
export const getTrendingRecipes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 10;
    const days = parseInt(req.query.days as string, 10) || 7;

    const trending = await popularityService.getTrendingRecipes(limit, days);

    res.json({
      success: true,
      data: {
        recipes: trending,
        count: trending.length,
        period: `last ${days} days`,
      },
    });
  } catch (error: any) {
    console.error('[RecommendationController] getTrendingRecipes error:', error);
    next(error);
  }
};
