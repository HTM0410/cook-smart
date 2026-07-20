import { Request, Response } from 'express'
import Recipe from '../models/Recipe'
import RecipeStep from '../models/RecipeStep'
import RecipeIngredient from '../models/RecipeIngredient'
import Ingredient from '../models/Ingredient'
import RecipeReview from '../models/RecipeReview'
import RecipeCategory from '../models/RecipeCategory'
import RecipeCategoryMap from '../models/RecipeCategoryMap'
import cacheService from '../services/cacheService'
import { Op } from 'sequelize'
import { sequelize } from '../models'

// Get all recipes with pagination and filters
export const getAllRecipes = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      status = 'visible',
      sortBy = 'createdAt',
      order = 'DESC'
    } = req.query

    const pageNum = parseInt(page as string)
    const limitNum = parseInt(limit as string)
    const offset = (pageNum - 1) * limitNum

    // Build cache key from query params
    const cacheParams = `p=${pageNum}&l=${limitNum}&s=${search || ''}&st=${status}&sb=${sortBy}&o=${order}&off=${offset}`
    const cached = await cacheService.getCachedRecipeList(cacheParams)
    if (cached) {
      console.log(`🎯 Recipe list cache HIT: ${cacheParams}`)
      res.json(cached)
      return
    }

    // Build where clause
    const whereClause: any = {}

    if (status) {
      whereClause.status = status
    }

    if (search) {
      whereClause.recipeName = {
        [Op.like]: `%${search}%`
      }
    }

    // Get recipes with associated data
    const { count, rows: recipes } = await Recipe.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [[sortBy as string, order as string]],
      // Temporarily disable includes to debug
      // include: [
      //   {
      //     model: RecipeStep,
      //     as: 'steps',
      //     attributes: ['id', 'stepNumber', 'instruction', 'imageUrl']
      //   },
      //   {
      //     model: RecipeIngredient,
      //     as: 'ingredients',
      //     attributes: ['id', 'quantity', 'unit'],
      //     include: [{
      //       model: Ingredient,
      //       as: 'ingredient',
      //       attributes: ['id', 'ingredientName']
      //     }]
      //   }
      // ],
      attributes: ['id', 'recipeName', 'description', 'prepTime', 'cookTime', 'servings', 'difficulty', 'imageUrl', 'status', 'createdAt', 'updatedAt']
    })

    const totalPages = Math.ceil(count / limitNum)

    // Tính rating cho mỗi recipe - sử dụng batch query để tối ưu
    const recipeIds = recipes.map(r => r.id);
    
    // Lấy tất cả reviews trong 1 query
    const allReviews = await RecipeReview.findAll({
      where: {
        recipeId: { [Op.in]: recipeIds },
        isActive: true,
      },
      attributes: ['recipeId', 'rating'],
      raw: true,
    }) as any[];

    // Tính rating cho từng recipe
    const ratingMap = new Map<number, { avgRating: number; reviewCount: number }>();
    
    // Group reviews by recipeId
    const reviewsByRecipe = new Map<number, number[]>();
    allReviews.forEach((review: any) => {
      if (!reviewsByRecipe.has(review.recipeId)) {
        reviewsByRecipe.set(review.recipeId, []);
      }
      reviewsByRecipe.get(review.recipeId)!.push(review.rating);
    });

    // Tính average và count cho mỗi recipe
    reviewsByRecipe.forEach((ratings, recipeId) => {
      const sum = ratings.reduce((acc, r) => acc + (r || 0), 0);
      const avg = ratings.length > 0 ? sum / ratings.length : 0;
      ratingMap.set(recipeId, {
        avgRating: Math.round(avg * 10) / 10,
        reviewCount: ratings.length,
      });
    });

    // Lấy categories cho tất cả recipes trong một query batch
    const categoryMaps = await RecipeCategoryMap.findAll({
      where: {
        recipeId: { [Op.in]: recipeIds }
      },
      include: [{
        model: RecipeCategory,
        as: 'category',
        attributes: ['id', 'categoryName', 'categoryType']
      }]
    }) as any[];

    // Tạo map recipeId -> categories
    const categoriesMap = new Map<number, Array<{ id: number; categoryName: string; categoryType: string }>>();
    recipeIds.forEach(id => {
      categoriesMap.set(id, []);
    });

    // Populate categories map
    categoryMaps.forEach((map: any) => {
      const recipeId = map.recipeId;
      const category = map.category;
      if (category) {
        if (!categoriesMap.has(recipeId)) {
          categoriesMap.set(recipeId, []);
        }
        categoriesMap.get(recipeId)!.push({
          id: category.id,
          categoryName: category.categoryName,
          categoryType: category.categoryType
        });
      }
    });

    // Thêm rating và categories vào recipes
    const recipesWithRating = recipes.map((recipe) => {
      const rating = ratingMap.get(recipe.id) || { avgRating: 0, reviewCount: 0 };
      const categories = categoriesMap.get(recipe.id) || [];
      return {
        ...recipe.toJSON(),
        averageRating: rating.avgRating,
        reviewCount: rating.reviewCount,
        categories: categories
      };
    });

    const responsePayload = {
      success: true,
      message: 'Recipes retrieved successfully',
      data: {
        recipes: recipesWithRating,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: count,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1
        }
      }
    }

    // Cache the response (best-effort, do not fail the request if Redis is down)
    cacheService.cacheRecipeList(cacheParams, responsePayload).catch(err =>
      console.warn('cacheRecipeList failed:', err.message)
    )

    res.json(responsePayload)
  } catch (error) {
    console.error('Get all recipes error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching recipes'
    })
  }
}

// Get recipe by ID
export const getRecipeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const recipeId = parseInt(id)

    // Try to get cached recipe first
    let recipe = await cacheService.getCachedRecipeDetail(recipeId)

    if (!recipe) {
      // Cache miss - fetch from database
      console.log(`🔍 Cache miss - fetching recipe ${recipeId} from database`)
      recipe = await Recipe.findByPk(recipeId, {
        include: [
          {
            model: RecipeStep,
            as: 'steps',
            attributes: ['id', 'stepNumber', 'instruction', 'imageUrl'],
            separate: true,
            order: [['stepNumber', 'ASC']]
          },
          {
            model: Ingredient,
            as: 'ingredients',
            through: {
              attributes: ['quantity', 'unit']
            },
            attributes: ['id', 'ingredientName', 'description']
          },
          {
            model: RecipeCategory,
            as: 'categories',
            attributes: ['id', 'categoryName', 'categoryType'],
            through: { attributes: [] }
          }
        ]
      })

      if (!recipe) {
        res.status(404).json({
          success: false,
          message: 'Recipe not found'
        })
        return
      }

      // Cache the recipe for future requests
      await cacheService.cacheRecipeDetail(recipeId, recipe)
    } else {
      console.log(`🎯 Cache hit - returning cached recipe ${recipeId}`)
    }

    // Ensure categories are included in response
    // Handle both Sequelize model instance and plain object (from cache)
    let recipeData: any;
    if (recipe && typeof (recipe as any).toJSON === 'function') {
      // Sequelize model instance
      recipeData = (recipe as any).toJSON();
    } else {
      // Plain object (from cache or already serialized)
      recipeData = recipe;
    }

    // Ensure categories array exists and is properly formatted
    const categories = (recipeData as any).categories || [];
    const formattedCategories = Array.isArray(categories) 
      ? categories.map((cat: any) => ({
          id: cat.id,
          categoryName: cat.categoryName || cat.category_name,
          categoryType: cat.categoryType || cat.category_type
        }))
      : [];

    const recipeWithCategories = {
      ...recipeData,
      categories: formattedCategories
    };

    // Debug log
    if (formattedCategories.length > 0) {
      console.log(`[RecipeController] Recipe ${recipeId} has ${formattedCategories.length} categories:`, 
        formattedCategories.map((c: any) => c.categoryName).join(', '));
    }

    res.json({
      success: true,
      message: 'Recipe retrieved successfully',
      data: { 
        recipe: recipeWithCategories,
        cached: recipe !== null // Indicate if result was from cache
      }
    })
  } catch (error) {
    console.error('Get recipe by ID error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching recipe'
    })
  }
}

// Create new recipe (Admin only)
export const createRecipe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      recipeName, 
      description, 
      prepTime, 
      cookTime, 
      servings, 
      difficulty,
      imageUrl,
      steps,
      ingredients
    } = req.body

    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    // Create recipe
    const recipe = await Recipe.create({
      recipeName,
      description: description || null,
      prepTime: prepTime || 0,
      cookTime: cookTime || 0,
      servings: servings || 1,
      difficulty: difficulty || 'medium',
      imageUrl: imageUrl || null,
      createdBy: admin.id,
      status: 'visible'
    })

    // Add recipe steps if provided
    if (steps && Array.isArray(steps) && steps.length > 0) {
      const recipeSteps = steps.map((step: any, index: number) => ({
        recipeId: recipe.id,
        stepNumber: step.stepNumber || index + 1,
        instruction: step.instruction,
        imageUrl: step.imageUrl || null
      }))
      await RecipeStep.bulkCreate(recipeSteps)
    }

    // Add recipe ingredients if provided
    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      const recipeIngredients = ingredients.map((ing: any) => ({
        recipeId: recipe.id,
        ingredientId: ing.ingredientId,
        quantity: ing.quantity,
        unit: ing.unit || null
      }))
      await RecipeIngredient.bulkCreate(recipeIngredients)
    }

    // Fetch complete recipe with associations
    const completeRecipe = await Recipe.findByPk(recipe.id, {
      include: [
        {
          model: RecipeStep,
          as: 'steps',
          attributes: ['id', 'stepNumber', 'instruction', 'imageUrl']
        },
        {
          model: Ingredient,
          as: 'ingredients',
          through: {
            attributes: ['quantity', 'unit']
          },
            attributes: ['id', 'ingredientName']
        }
      ]
    })

    res.status(201).json({
      success: true,
      message: 'Recipe created successfully',
      data: { recipe: completeRecipe }
    })

    // Invalidate all recipe list caches (new recipe should appear in lists)
    await cacheService.invalidateRecipeListCaches()
  } catch (error) {
    console.error('Create recipe error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while creating recipe'
    })
  }
}

// Update recipe (Admin only)
export const updateRecipe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { 
      recipeName, 
      description, 
      prepTime, 
      cookTime, 
      servings, 
      difficulty,
      imageUrl,
      status
    } = req.body

    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    const recipe = await Recipe.findByPk(id)

    if (!recipe) {
      res.status(404).json({
        success: false,
        message: 'Recipe not found'
      })
      return
    }

    // Update recipe
    await recipe.update({
      recipeName: recipeName || recipe.recipeName,
      description: description !== undefined ? description : recipe.description,
      prepTime: prepTime !== undefined ? prepTime : recipe.prepTime,
      cookTime: cookTime !== undefined ? cookTime : recipe.cookTime,
      servings: servings !== undefined ? servings : recipe.servings,
      difficulty: difficulty || recipe.difficulty,
      imageUrl: imageUrl !== undefined ? imageUrl : recipe.imageUrl,
      status: status || recipe.status
    })

    // Fetch updated recipe with associations
    const updatedRecipe = await Recipe.findByPk(recipe.id, {
      include: [
        {
          model: RecipeStep,
          as: 'steps',
          attributes: ['id', 'stepNumber', 'instruction', 'imageUrl']
        },
        {
          model: Ingredient,
          as: 'ingredients',
          through: {
            attributes: ['quantity', 'unit']
          },
            attributes: ['id', 'ingredientName']
        }
      ]
    })

    res.json({
      success: true,
      message: 'Recipe updated successfully',
      data: { recipe: updatedRecipe }
    })

    // Invalidate caches (recipe detail + all list variants)
    await cacheService.invalidateRecipeCaches(parseInt(id))
  } catch (error) {
    console.error('Update recipe error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while updating recipe'
    })
  }
}

// Delete recipe (Admin only)
export const deleteRecipe = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    const recipe = await Recipe.findByPk(id)

    if (!recipe) {
      res.status(404).json({
        success: false,
        message: 'Recipe not found'
      })
      return
    }

    // Delete associated data first
    await RecipeStep.destroy({ where: { recipeId: id } })
    await RecipeIngredient.destroy({ where: { recipeId: id } })
    
    // Delete recipe
    await recipe.destroy()

    res.json({
      success: true,
      message: 'Recipe deleted successfully'
    })

    // Invalidate caches after delete
    await cacheService.invalidateRecipeCaches(parseInt(id))
  } catch (error) {
    console.error('Delete recipe error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while deleting recipe'
    })
  }
}

// Toggle recipe visibility (Admin only)
export const toggleRecipeVisibility = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    const recipe = await Recipe.findByPk(id)

    if (!recipe) {
      res.status(404).json({
        success: false,
        message: 'Recipe not found'
      })
      return
    }

    const newStatus = recipe.status === 'visible' ? 'hidden' : 'visible'
    await recipe.update({ status: newStatus })

    res.json({
      success: true,
      message: `Recipe ${newStatus === 'visible' ? 'shown' : 'hidden'} successfully`,
      data: { recipe }
    })

    // Invalidate caches (visibility affects what shows in lists)
    await cacheService.invalidateRecipeCaches(parseInt(id))
  } catch (error) {
    console.error('Toggle recipe visibility error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while toggling recipe visibility'
    })
  }
}

// Add step to recipe (Admin only)
export const addRecipeStep = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { stepNumber, instruction, imageUrl } = req.body
    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    const recipe = await Recipe.findByPk(id)

    if (!recipe) {
      res.status(404).json({
        success: false,
        message: 'Recipe not found'
      })
      return
    }

    const step = await RecipeStep.create({
      recipeId: parseInt(id),
      stepNumber,
      instruction,
      imageUrl: imageUrl || null
    })

    res.status(201).json({
      success: true,
      message: 'Recipe step added successfully',
      data: { step }
    })

    // Invalidate caches (recipe content changed)
    await cacheService.invalidateRecipeCaches(parseInt(id))
  } catch (error) {
    console.error('Add recipe step error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding recipe step'
    })
  }
}

// Add ingredient to recipe (Admin only)
export const addRecipeIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { ingredientId, quantity, unit } = req.body
    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    const recipe = await Recipe.findByPk(id)

    if (!recipe) {
      res.status(404).json({
        success: false,
        message: 'Recipe not found'
      })
      return
    }

    const ingredient = await Ingredient.findByPk(ingredientId)

    if (!ingredient) {
      res.status(404).json({
        success: false,
        message: 'Ingredient not found'
      })
      return
    }

    const recipeIngredient = await RecipeIngredient.create({
      recipeId: parseInt(id),
      ingredientId,
      quantity,
      unit: unit || null
    })

    const completeIngredient = await RecipeIngredient.findByPk(recipeIngredient.id, {
      include: [{
        model: Ingredient,
        as: 'ingredient',
        attributes: ['id', 'ingredientName']
      }]
    })

    res.status(201).json({
      success: true,
      message: 'Ingredient added to recipe successfully',
      data: { recipeIngredient: completeIngredient }
    })

    // Invalidate caches (ingredient map affects filtered queries)
    await cacheService.invalidateRecipeCaches(parseInt(id))
  } catch (error) {
    console.error('Add recipe ingredient error:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while adding ingredient to recipe'
    })
  }
}

