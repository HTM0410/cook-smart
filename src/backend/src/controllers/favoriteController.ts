import { Request, Response, NextFunction } from 'express';
import UserFavorite from '../models/UserFavorite';
import Recipe from '../models/Recipe';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { param, validationResult } from 'express-validator';
import { successResponse, errorResponse } from '../utils/response';

/**
 * Get all favorite recipes for current user
 * GET /api/favorites
 */
export const getUserFavorites = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId ?? (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Get favorites with recipe details
    const favorites = await UserFavorite.findAll({
      where: { userId },
      include: [{
        model: Recipe,
        as: 'recipe',
        attributes: [
          'id', 'recipeName', 'description', 'imageUrl', 
          'cookTime', 'prepTime', 'servings', 'difficulty',
          'createdAt'
        ]
      }],
      order: [['createdAt', 'DESC']],
      limit: limitNum,
      offset
    });

    // Get total count
    const totalCount = await UserFavorite.count({
      where: { userId }
    });

    res.json(successResponse('Favorites retrieved successfully', {
      favorites: favorites.map(f => ({
        id: f.id,
        recipeId: f.recipeId,
        createdAt: f.createdAt,
        recipe: (f as any).recipe
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum)
      }
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Add recipe to favorites
 * POST /api/favorites/:recipeId
 */
export const addFavorite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { recipeId } = req.params;
    const userId = req.userId ?? (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    // Check if recipe exists
    const recipe = await Recipe.findByPk(parseInt(recipeId));
    if (!recipe) {
      throw new NotFoundError('Recipe not found');
    }

    // Check if already favorited
    const existingFavorite = await UserFavorite.findOne({
      where: {
        userId,
        recipeId: parseInt(recipeId)
      }
    });

    if (existingFavorite) {
      res.json(successResponse('Recipe already in favorites', {
        favorite: existingFavorite,
        favorited: true
      }));
      return;
    }

    // Create favorite
    const favorite = await UserFavorite.create({
      userId,
      recipeId: parseInt(recipeId)
    });

    res.status(201).json(successResponse('Recipe added to favorites', {
      favorite,
      favorited: true
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Remove recipe from favorites
 * DELETE /api/favorites/:recipeId
 */
export const removeFavorite = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { recipeId } = req.params;
    const userId = req.userId ?? (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    // Find and delete favorite
    const favorite = await UserFavorite.findOne({
      where: {
        userId,
        recipeId: parseInt(recipeId)
      }
    });

    if (!favorite) {
      res.json(successResponse('Recipe is not in favorites', {
        favorited: false
      }));
      return;
    }

    await favorite.destroy();

    res.json(successResponse('Recipe removed from favorites', {
      favorited: false
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Check if recipe is favorited by current user
 * GET /api/favorites/check/:recipeId
 */
export const checkFavoriteStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { recipeId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.json(successResponse('Favorite status checked', {
        favorited: false
      }));
      return;
    }

    const favorite = await UserFavorite.findOne({
      where: {
        userId,
        recipeId: parseInt(recipeId)
      }
    });

    res.json(successResponse('Favorite status checked', {
      favorited: !!favorite,
      favorite: favorite || null
    }));
  } catch (error) {
    next(error);
  }
};

/**
 * Get favorite count for a recipe
 * GET /api/favorites/count/:recipeId
 */
export const getFavoriteCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { recipeId } = req.params;

    const count = await UserFavorite.count({
      where: { recipeId: parseInt(recipeId) }
    });

    res.json(successResponse('Favorite count retrieved', {
      recipeId: parseInt(recipeId),
      count
    }));
  } catch (error) {
    next(error);
  }
};

// Validation middleware
export const validateRecipeId = [
  param('recipeId').isInt({ min: 1 }).withMessage('Recipe ID must be a positive integer')
];

