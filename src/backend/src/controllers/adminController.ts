import { Request, Response, NextFunction } from 'express';
import { 
  User, 
  Recipe, 
  Ingredient, 
  IngredientCategory, 
  RecipeStep, 
  RecipeIngredient, 
  Comment 
} from '../models';
import commentCacheService from '../services/commentCacheService';
import { Op } from 'sequelize';
import { BadRequestError, NotFoundError } from '../utils/errors';

/**
 * Get dashboard statistics
 * GET /api/admin/dashboard/stats
 */
export const getDashboardStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get counts
    const [
      totalUsers,
      totalRecipes,
      totalIngredients,
      totalComments,
      activeUsers,
      hiddenRecipes,
    ] = await Promise.all([
      User.count(),
      Recipe.count(),
      Ingredient.count(),
      Comment.count({ where: { isDeleted: false } }),
      User.count({ where: { status: 'active' } }),
      Recipe.count({ where: { status: 'hidden' } }),
    ]);

    // Get recent activities
    const recentUsers = await User.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'fullName', 'email', 'createdAt', 'status'],
    });

    const recentRecipes = await Recipe.findAll({
      order: [['createdAt', 'DESC']],
      limit: 5,
      attributes: ['id', 'recipeName', 'createdBy', 'status', 'createdAt'],
    });

    // Get popular recipes (by favorites - we'll simulate this)
    const popularRecipes = await Recipe.findAll({
      order: [['createdAt', 'DESC']], // In real app, order by favorite count
      limit: 5,
      attributes: ['id', 'recipeName', 'createdBy', 'status'],
    });

    res.json({
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: {
        overview: {
          totalUsers,
          totalRecipes,
          totalIngredients,
          totalComments,
          activeUsers,
          hiddenRecipes,
        },
        recentActivities: {
          users: recentUsers,
          recipes: recentRecipes,
        },
        popularRecipes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users with pagination
 * GET /api/admin/users
 */
export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      role = '',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }
    
    if (status) {
      where.status = status;
    }
    
    if (role) {
      where.role = role;
    }

    const { rows: users, count: total } = await User.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['password'] },
    });

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user status
 * PUT /api/admin/users/:userId/status
 */
export const updateUserStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['active', 'banned'].includes(status)) {
      throw new BadRequestError('Invalid status value');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await user.update({ status });

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          status: user.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all recipes with pagination
 * GET /api/admin/recipes
 */
export const getRecipes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      status = '',
      difficulty = '',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.recipeName = { [Op.like]: `%${search}%` };
    }
    
    if (status) {
      where.status = status;
    }
    
    if (difficulty) {
      where.difficulty = difficulty;
    }

    const { rows: recipes, count: total } = await Recipe.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      message: 'Recipes retrieved successfully',
      data: {
        recipes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update recipe status
 * PUT /api/admin/recipes/:recipeId/status
 */
export const updateRecipeStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const { status } = req.body;

    if (!['visible', 'hidden'].includes(status)) {
      throw new BadRequestError('Invalid status value');
    }

    const recipe = await Recipe.findByPk(recipeId);
    if (!recipe) {
      throw new NotFoundError('Recipe not found');
    }

    await recipe.update({ status });

    res.json({
      success: true,
      message: 'Recipe status updated successfully',
      data: {
        recipe: {
          id: recipe.id,
          recipeName: recipe.recipeName,
          status: recipe.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update recipe with full details (ingredients and steps)
 * PUT /api/admin/recipes/:recipeId
 */
export const updateRecipeFull = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const {
      recipeName,
      description,
      difficulty,
      status,
      prepTime,
      cookTime,
      servings,
      ingredients,
      steps
    } = req.body;

    // Find recipe
    const recipe = await Recipe.findByPk(recipeId);
    if (!recipe) {
      throw new NotFoundError('Recipe not found');
    }

    // Update basic info
    await recipe.update({
      recipeName: recipeName !== undefined ? recipeName : recipe.recipeName,
      description: description !== undefined ? description : recipe.description,
      difficulty: difficulty !== undefined ? difficulty : recipe.difficulty,
      status: status !== undefined ? status : recipe.status,
      prepTime: prepTime !== undefined ? prepTime : recipe.prepTime,
      cookTime: cookTime !== undefined ? cookTime : recipe.cookTime,
      servings: servings !== undefined ? servings : recipe.servings,
    });

    // Update ingredients if provided
    if (ingredients && Array.isArray(ingredients)) {
      // Delete existing recipe ingredients
      await RecipeIngredient.destroy({ where: { recipeId: recipe.id } });

      // Find or create ingredients and link them
      for (const ing of ingredients) {
        let ingredient = await Ingredient.findOne({
          where: { ingredientName: ing.ingredientName }
        });

        if (!ingredient) {
          // Create new ingredient if not exists
          ingredient = await Ingredient.create({
            ingredientName: ing.ingredientName,
            categoryId: 1, // Default category
          });
        }

        // Create recipe-ingredient link
        await RecipeIngredient.create({
          recipeId: recipe.id,
          ingredientId: ingredient.id,
          quantity: ing.quantity,
          unit: ing.unit,
        });
      }
    }

    // Update steps if provided
    if (steps && Array.isArray(steps)) {
      // Delete existing steps
      await RecipeStep.destroy({ where: { recipeId: recipe.id } });

      // Create new steps
      for (const step of steps) {
        await RecipeStep.create({
          recipeId: recipe.id,
          stepNumber: step.stepNumber,
          instruction: step.instruction,
        });
      }
    }

    // Fetch updated recipe with associations
    const updatedRecipe = await Recipe.findByPk(recipe.id, {
      include: [
        {
          model: Ingredient,
          as: 'ingredients',
          through: { attributes: ['quantity', 'unit'] },
        },
        {
          model: RecipeStep,
          as: 'steps',
          order: [['stepNumber', 'ASC']],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Recipe updated successfully',
      data: { recipe: updatedRecipe },
    });
  } catch (error) {
    console.error('Update recipe error:', error);
    next(error);
  }
};

/**
 * Delete recipe
 * DELETE /api/admin/recipes/:recipeId
 */
export const deleteRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipeId } = req.params;

    const recipe = await Recipe.findByPk(recipeId);
    if (!recipe) {
      throw new NotFoundError('Recipe not found');
    }

    await recipe.destroy();

    res.json({
      success: true,
      message: 'Recipe deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all ingredients with pagination
 * GET /api/admin/ingredients
 */
export const getIngredients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      category = '',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    if (search) {
      where.ingredientName = { [Op.like]: `%${search}%` };
    }
    
    if (category) {
      where.categoryId = category;
    }

    const { rows: ingredients, count: total } = await Ingredient.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: IngredientCategory,
          as: 'category',
          attributes: ['id', 'categoryName'],
          required: false,
        },
      ],
      raw: false,
    });

    // Serialize ingredients to ensure category is included properly
    const serializedIngredients = ingredients.map(ing => {
      const ingredientData = ing.toJSON ? ing.toJSON() : ing.get({ plain: true });
      // Access category from the Sequelize instance, not from plain data
      const category = (ing as any).category;
      return {
        id: ingredientData.id,
        ingredientName: ingredientData.ingredientName,
        description: ingredientData.description || null,
        categoryId: ingredientData.categoryId,
        category: category ? {
          id: category.id,
          categoryName: category.categoryName,
        } : null,
        createdAt: ingredientData.createdAt,
        updatedAt: ingredientData.updatedAt,
      };
    });

    res.json({
      success: true,
      message: 'Ingredients retrieved successfully',
      data: {
        ingredients: serializedIngredients,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all comments with pagination and filters
 * GET /api/admin/comments
 */
export const getComments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      recipeId = '',
      userId = '',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { isDeleted: false };
    
    if (search) {
      where.content = { [Op.like]: `%${search}%` };
    }
    
    if (recipeId) {
      where.recipeId = parseInt(recipeId as string);
    }
    
    if (userId) {
      where.userId = parseInt(userId as string);
    }

    const { rows: comments, count: total } = await Comment.findAndCountAll({
      where,
      limit: limitNum,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'email'],
        },
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'recipeName'],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Comments retrieved successfully',
      data: {
        comments,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    console.error('Get comments error:', error);
    next(error);
  }
};

/**
 * Delete comment (soft delete)
 * DELETE /api/admin/comments/:commentId
 */
export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      throw new NotFoundError('Comment not found');
    }

    // Soft delete
    await comment.update({ isDeleted: true });

    // Invalidate cache
    await commentCacheService.invalidateCommentDetail(parseInt(commentId));
    if (comment.recipeId) {
      await commentCacheService.invalidateRecipeComments(comment.recipeId);
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    next(error);
  }
};

/**
 * Batch operations for users
 * POST /api/admin/users/batch
 */
export const batchUpdateUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userIds, action, value } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new BadRequestError('userIds must be a non-empty array');
    }

    let updated = 0;

    switch (action) {
      case 'updateStatus':
        if (!['active', 'banned'].includes(value)) {
          throw new BadRequestError('Invalid status value');
        }
        const [affectedRows] = await User.update(
          { status: value },
          { where: { id: userIds } }
        );
        updated = affectedRows;
        break;

      case 'delete':
        updated = await User.destroy({ where: { id: userIds } });
        break;

      default:
        throw new BadRequestError('Invalid action');
    }

    res.json({
      success: true,
      message: `Batch operation completed successfully`,
      data: {
        updated,
        action,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Batch operations for recipes
 * POST /api/admin/recipes/batch
 */
export const batchUpdateRecipes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipeIds, action, value } = req.body;

    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
      throw new BadRequestError('recipeIds must be a non-empty array');
    }

    let updated = 0;

    switch (action) {
      case 'updateStatus':
        if (!['visible', 'hidden', 'pending'].includes(value)) {
          throw new BadRequestError('Invalid status value');
        }
        const [affectedRows] = await Recipe.update(
          { status: value },
          { where: { id: recipeIds } }
        );
        updated = affectedRows;
        break;

      case 'delete':
        updated = await Recipe.destroy({ where: { id: recipeIds } });
        break;

      default:
        throw new BadRequestError('Invalid action');
    }

    res.json({
      success: true,
      message: `Batch operation completed successfully`,
      data: {
        updated,
        action,
      },
    });
  } catch (error) {
    next(error);
  }
};
