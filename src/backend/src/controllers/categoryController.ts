import { Request, Response, NextFunction } from 'express';
import RecipeCategory from '../models/RecipeCategory';
import RecipeCategoryMap from '../models/RecipeCategoryMap';
import Recipe from '../models/Recipe';
import { Op, QueryTypes } from 'sequelize';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { sequelize } from '../config/database-supabase';

/**
 * GET /api/categories
 * Get all categories with optional filtering by type
 * Includes recipe count for each category
 */
export const getAllCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { type } = req.query;
    
    const whereClause: any = {};
    if (type && ['cuisine', 'course', 'tag'].includes(type as string)) {
      whereClause.categoryType = type;
    }

    const categories = await RecipeCategory.findAll({
      where: whereClause,
      order: [['categoryType', 'ASC'], ['id', 'ASC']],
    });

    // Get recipe counts for each category (only visible recipes)
    const categoryIds = categories.map(cat => cat.id);
    
    if (categoryIds.length === 0) {
      res.json({
        success: true,
        message: 'Categories retrieved successfully',
        data: {
          categories: [],
        },
      });
      return;
    }

    // Use raw SQL query to count recipes per category
    // PostgreSQL trả về keys là snake_case, không phải camelCase
    const countResults = await sequelize.query(`
      SELECT 
        rcm.category_id,
        COUNT(DISTINCT rcm.recipe_id) as recipe_count
      FROM recipe_category_map rcm
      INNER JOIN recipes r ON rcm.recipe_id = r.id
      WHERE rcm.category_id = ANY(ARRAY[${categoryIds.join(',')}])
        AND r.status = 'visible'
      GROUP BY rcm.category_id
    `, {
      type: QueryTypes.SELECT
    }) as any[];

    // Create a map of categoryId -> count
    const countMap = new Map<number, number>();
    console.log('[CategoryController] Raw countResults:', JSON.stringify(countResults, null, 2));
    if (Array.isArray(countResults) && countResults.length > 0) {
      countResults.forEach((item: any) => {
        // PostgreSQL trả về snake_case keys: category_id, recipe_count
        const categoryId = item.category_id;
        const recipeCount = item.recipe_count;
        
        console.log(`[CategoryController] Processing item: categoryId=${categoryId}, recipeCount=${recipeCount} (type: ${typeof recipeCount})`);
        
        if (categoryId !== null && categoryId !== undefined) {
          const id = typeof categoryId === 'number' ? categoryId : parseInt(categoryId.toString());
          // recipe_count từ PostgreSQL COUNT() trả về dạng string hoặc bigint
          const count = typeof recipeCount === 'string' 
            ? parseInt(recipeCount) 
            : (typeof recipeCount === 'bigint' 
              ? Number(recipeCount) 
              : (typeof recipeCount === 'number'
                ? recipeCount
                : 0));
          countMap.set(id, count);
          console.log(`[CategoryController] ✅ Mapped category ${id} -> ${count} recipes`);
        }
      });
    } else {
      console.log('[CategoryController] ⚠️  countResults is not an array or is empty');
    }

    // Add recipe count to each category
    const categoriesWithCount = categories.map(category => {
      // Get base data from model
      const categoryData = category.get({ plain: true });
      const recipeCount = countMap.get(category.id) || 0;
      
      // Ensure recipeCount is always a number
      const finalCount = typeof recipeCount === 'number' ? recipeCount : 0;
      
      // Create result object with recipeCount - use get() instead of toJSON()
      const result = {
        id: categoryData.id,
        categoryName: categoryData.categoryName,
        categoryType: categoryData.categoryType,
        description: categoryData.description,
        createdAt: categoryData.createdAt,
        updatedAt: categoryData.updatedAt,
        recipeCount: finalCount, // Explicitly add recipeCount
      };
      
      // Debug log for first few categories
      if (category.id <= 3 || category.categoryName === 'Việt Nam' || category.categoryName === 'Món chính') {
        console.log(`[CategoryController] Category ${category.id} (${category.categoryName}): recipeCount=${result.recipeCount}, countMap.get(${category.id})=${countMap.get(category.id)}`);
      }
      
      return result;
    });

    // Debug: Log sample categories with counts
    console.log('[CategoryController] Total categories:', categories.length);
    console.log('[CategoryController] Count map size:', countMap.size);
    if (countMap.size > 0) {
      console.log('[CategoryController] Sample countMap entries:', 
        Array.from(countMap.entries()).slice(0, 5));
    }
    const sampleWithCount = categoriesWithCount.filter(c => c.recipeCount > 0).slice(0, 5);
    if (sampleWithCount.length > 0) {
      console.log('[CategoryController] ✅ Sample categories with recipeCount:', 
        sampleWithCount.map(c => `${c.categoryName}(${c.id})=${c.recipeCount}`).join(', '));
    } else {
      console.log('[CategoryController] ⚠️  No categories have recipeCount > 0');
      console.log('[CategoryController] Sample categories (first 3):', 
        categoriesWithCount.slice(0, 3).map(c => `${c.categoryName}(${c.id})=${c.recipeCount || 'UNDEFINED'}`).join(', '));
    }

    // Debug: Log final response before sending
    if (categoriesWithCount.length > 0) {
      console.log('[CategoryController] Final response - First category:', JSON.stringify(categoriesWithCount[0], null, 2));
      const vietnam = categoriesWithCount.find((c: any) => c.id === 1);
      const monChinh = categoriesWithCount.find((c: any) => c.id === 11);
      if (vietnam) {
        console.log('[CategoryController] Final response - Việt Nam:', JSON.stringify(vietnam, null, 2));
      }
      if (monChinh) {
        console.log('[CategoryController] Final response - Món chính:', JSON.stringify(monChinh, null, 2));
      }
    }
    
    // Verify recipeCount exists in all categories
    const missingRecipeCount = categoriesWithCount.filter((c: any) => !('recipeCount' in c));
    if (missingRecipeCount.length > 0) {
      console.log('[CategoryController] ⚠️  Categories missing recipeCount:', missingRecipeCount.map((c: any) => c.categoryName));
    } else {
      console.log('[CategoryController] ✅ All categories have recipeCount field');
    }

    const responseData = {
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories: categoriesWithCount,
      },
    };
    
    // Debug: Log response structure
    console.log('[CategoryController] Response data structure:', {
      hasCategories: !!responseData.data.categories,
      categoriesLength: responseData.data.categories.length,
      firstCategoryKeys: responseData.data.categories[0] ? Object.keys(responseData.data.categories[0]) : []
    });
    
    res.json(responseData);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/categories/:id
 * Get category by ID
 */
export const getCategoryById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await RecipeCategory.findByPk(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    res.json({
      success: true,
      message: 'Category retrieved successfully',
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/categories
 * Create new category (Admin only)
 */
export const createCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { categoryName, categoryType, description } = req.body;

    if (!categoryName || !categoryType) {
      throw new BadRequestError('Category name and type are required');
    }

    if (!['cuisine', 'course', 'tag'].includes(categoryType)) {
      throw new BadRequestError('Invalid category type. Must be: cuisine, course, or tag');
    }

    // Check if category with same name and type already exists
    const existing = await RecipeCategory.findOne({
      where: {
        categoryName,
        categoryType,
      },
    });

    if (existing) {
      throw new BadRequestError('Category with this name and type already exists');
    }

    const category = await RecipeCategory.create({
      categoryName,
      categoryType,
      description,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/categories/:id
 * Update category (Admin only)
 */
export const updateCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;
    const { categoryName, categoryType, description } = req.body;

    const category = await RecipeCategory.findByPk(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // If changing name or type, check for duplicates
    if (categoryName || categoryType) {
      const whereClause: any = {
        id: { [Op.ne]: id },
      };

      if (categoryName && categoryType) {
        whereClause.categoryName = categoryName;
        whereClause.categoryType = categoryType;
      } else if (categoryName) {
        whereClause.categoryName = categoryName;
        whereClause.categoryType = category.categoryType;
      } else if (categoryType) {
        whereClause.categoryName = category.categoryName;
        whereClause.categoryType = categoryType;
      }

      const existing = await RecipeCategory.findOne({ where: whereClause });
      if (existing) {
        throw new BadRequestError('Category with this name and type already exists');
      }
    }

    if (categoryType && !['cuisine', 'course', 'tag'].includes(categoryType)) {
      throw new BadRequestError('Invalid category type. Must be: cuisine, course, or tag');
    }

    await category.update({
      categoryName: categoryName || category.categoryName,
      categoryType: categoryType || category.categoryType,
      description: description !== undefined ? description : category.description,
    });

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: {
        category,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/categories/:id
 * Delete category (Admin only)
 */
export const deleteCategory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await RecipeCategory.findByPk(id);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Delete all mappings (CASCADE will handle this, but we can do it explicitly)
    await RecipeCategoryMap.destroy({
      where: { categoryId: id },
    });

    await category.destroy();

    res.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/recipes/:recipeId/categories
 * Assign categories to a recipe (Admin only)
 */
export const assignCategoriesToRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipeId } = req.params;
    const { categoryIds } = req.body;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new BadRequestError('categoryIds must be a non-empty array');
    }

    const recipe = await Recipe.findByPk(recipeId);
    if (!recipe) {
      throw new NotFoundError('Recipe not found');
    }

    // Validate all category IDs exist
    const categories = await RecipeCategory.findAll({
      where: {
        id: categoryIds,
      },
    });

    if (categories.length !== categoryIds.length) {
      throw new BadRequestError('One or more category IDs are invalid');
    }

    // Get existing mappings
    const existingMappings = await RecipeCategoryMap.findAll({
      where: {
        recipeId: parseInt(recipeId),
      },
    });

    const existingCategoryIds = existingMappings.map(m => m.categoryId);
    const newCategoryIds = categoryIds.filter((id: number) => !existingCategoryIds.includes(id));

    // Create new mappings
    if (newCategoryIds.length > 0) {
      await RecipeCategoryMap.bulkCreate(
        newCategoryIds.map((categoryId: number) => ({
          recipeId: parseInt(recipeId),
          categoryId,
        }))
      );
    }

    // Get all categories for this recipe
    const allMappings = await RecipeCategoryMap.findAll({
      where: { recipeId: parseInt(recipeId) },
      include: [
        {
          model: RecipeCategory,
          as: 'category',
          required: true,
        },
      ],
    });

    res.json({
      success: true,
      message: 'Categories assigned successfully',
      data: {
        recipeId: parseInt(recipeId),
        assignedCategories: allMappings.map(m => ({
          id: m.categoryId,
          categoryName: (m as any).category?.categoryName,
          categoryType: (m as any).category?.categoryType,
        })),
        newlyAdded: newCategoryIds,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/recipes/:recipeId/categories
 * Get all categories for a recipe
 */
export const getRecipeCategories = async (
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

    const mappings = await RecipeCategoryMap.findAll({
      where: { recipeId: parseInt(recipeId) },
      include: [
        {
          model: RecipeCategory,
          as: 'category',
          required: true,
        },
      ],
    });

    const categories = mappings.map(m => ({
      id: (m as any).category?.id,
      categoryName: (m as any).category?.categoryName,
      categoryType: (m as any).category?.categoryType,
      description: (m as any).category?.description,
    }));

    res.json({
      success: true,
      message: 'Recipe categories retrieved successfully',
      data: {
        recipeId: parseInt(recipeId),
        categories,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/recipes/:recipeId/categories/:categoryId
 * Remove a category from a recipe (Admin only)
 */
export const removeCategoryFromRecipe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recipeId, categoryId } = req.params;

    const mapping = await RecipeCategoryMap.findOne({
      where: {
        recipeId: parseInt(recipeId),
        categoryId: parseInt(categoryId),
      },
    });

    if (!mapping) {
      throw new NotFoundError('Category mapping not found');
    }

    await mapping.destroy();

    res.json({
      success: true,
      message: 'Category removed from recipe successfully',
    });
  } catch (error) {
    next(error);
  }
};

