import { Request, Response, NextFunction } from 'express';
import RecipeReview from '../models/RecipeReview';
import Recipe from '../models/Recipe';
import User from '../models/User';
import { sendSuccess } from '../utils/response';
import { sequelize } from '../config/database-supabase';

/**
 * Submit or update rating for a recipe
 * POST /api/recipes/:recipeId/rating
 */
export const submitRating = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập để đánh giá'
      });
      return;
    }

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({
        success: false,
        message: 'Đánh giá phải từ 1 đến 5 sao'
      });
      return;
    }

    // Check if recipe exists
    const recipe = await Recipe.findByPk(recipeId);
    if (!recipe) {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy công thức'
      });
      return;
    }

    // Check if user already rated this recipe
    const existingReview = await RecipeReview.findOne({
      where: {
        userId,
        recipeId: parseInt(recipeId)
      }
    });

    let review;
    let status = 'created';

    if (existingReview) {
      // Update existing rating
      await existingReview.update({
        rating,
        comment: comment || existingReview.comment
      });
      review = existingReview;
      status = 'updated';
    } else {
      // Create new rating
      review = await RecipeReview.create({
        userId,
        recipeId: parseInt(recipeId),
        rating,
        comment,
        isActive: true
      });
    }

    // Get updated stats
    const stats = await getRecipeRatingStats(parseInt(recipeId));

    sendSuccess(
      res,
      {
        rating: {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
          updatedAt: review.updatedAt
        },
        stats,
        status
      },
      status === 'created' ? 'Đánh giá thành công' : 'Cập nhật đánh giá thành công',
      status === 'created' ? 201 : 200
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get rating statistics for a recipe
 * GET /api/recipes/:recipeId/rating/stats
 */
export const getRatingStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const userId = req.user?.id;

    const stats = await getRecipeRatingStats(parseInt(recipeId), userId);

    sendSuccess(res, stats);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's rating for a recipe
 * GET /api/recipes/:recipeId/rating/user
 */
export const getUserRating = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      sendSuccess(res, {
        userRating: null,
        hasRated: false
      });
      return;
    }

    const review = await RecipeReview.findOne({
      where: {
        userId,
        recipeId: parseInt(recipeId),
        isActive: true
      }
    });

    sendSuccess(res, {
      userRating: review ? {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      } : null,
      hasRated: !!review
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete user's rating
 * DELETE /api/recipes/:recipeId/rating
 */
export const deleteRating = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Vui lòng đăng nhập'
      });
      return;
    }

    const review = await RecipeReview.findOne({
      where: {
        userId,
        recipeId: parseInt(recipeId)
      }
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá'
      });
      return;
    }

    // Soft delete
    await review.update({ isActive: false });

    // Get updated stats
    const stats = await getRecipeRatingStats(parseInt(recipeId));

    sendSuccess(
      res,
      { stats },
      'Đã xóa đánh giá'
    );
  } catch (error) {
    next(error);
  }
};

/**
 * Get all ratings for a recipe with pagination
 * GET /api/recipes/:recipeId/ratings
 */
export const getRecipeRatings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const { count, rows: ratings } = await RecipeReview.findAndCountAll({
      where: {
        recipeId: parseInt(recipeId),
        isActive: true
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    const stats = await getRecipeRatingStats(parseInt(recipeId));

    sendSuccess(res, {
      ratings: ratings.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        user: (r as any).user, // User association
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      })),
      stats,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper: Calculate rating statistics for a recipe
 */
async function getRecipeRatingStats(recipeId: number, userId?: number) {
  const result = await RecipeReview.findAll({
    where: {
      recipeId,
      isActive: true
    },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'ratingCount'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN rating = 5 THEN 1 ELSE 0 END')), 'fiveStars'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN rating = 4 THEN 1 ELSE 0 END')), 'fourStars'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN rating = 3 THEN 1 ELSE 0 END')), 'threeStars'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN rating = 2 THEN 1 ELSE 0 END')), 'twoStars'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN rating = 1 THEN 1 ELSE 0 END')), 'oneStar'],
    ],
    raw: true
  });

  const stats: any = result[0] || {};

  // Get user's rating if userId provided
  let userRating = null;
  if (userId) {
    const review = await RecipeReview.findOne({
      where: { userId, recipeId, isActive: true }
    });
    userRating = review ? review.rating : null;
  }

  return {
    averageRating: stats.avgRating ? parseFloat(parseFloat(stats.avgRating).toFixed(1)) : 0,
    ratingCount: parseInt(stats.ratingCount) || 0,
    distribution: {
      5: parseInt(stats.fiveStars) || 0,
      4: parseInt(stats.fourStars) || 0,
      3: parseInt(stats.threeStars) || 0,
      2: parseInt(stats.twoStars) || 0,
      1: parseInt(stats.oneStar) || 0
    },
    userRating
  };
}

export default {
  submitRating,
  getRatingStats,
  getUserRating,
  deleteRating,
  getRecipeRatings
};

