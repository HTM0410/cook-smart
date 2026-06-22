import { Request, Response } from 'express'
import { Op } from 'sequelize'
import { Ingredient, IngredientCategory } from '../models'

// Get all ingredients
export const getAllIngredients = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, search, categoryId, sortBy = 'ingredientName', order = 'ASC' } = req.query
    const limitNum = parseInt(limit as string)
    const offset = (parseInt(page as string) - 1) * limitNum

    let whereClause: any = {}
    
    if (search) {
      whereClause.ingredientName = {
        [Op.like]: `%${search}%`
      }
    }

    if (categoryId) {
      whereClause.categoryId = parseInt(categoryId as string)
    }

    const { count, rows: ingredients } = await Ingredient.findAndCountAll({
      where: whereClause,
      limit: limitNum,
      offset: offset,
      order: [[sortBy as string, order as string]],
      include: [
        {
          model: IngredientCategory,
          as: 'category',
          attributes: ['id', 'categoryName']
        }
      ],
      attributes: ['id', 'ingredientName', 'categoryId', 'description', 'createdAt', 'updatedAt']
    })

    const totalPages = Math.ceil(count / limitNum)

    res.json({
      success: true,
      message: 'Ingredients retrieved successfully',
      data: {
        ingredients,
        pagination: {
          currentPage: parseInt(page as string),
          totalPages,
          totalItems: count,
          itemsPerPage: limitNum,
          hasNextPage: parseInt(page as string) < totalPages,
          hasPreviousPage: parseInt(page as string) > 1
        }
      }
    })
  } catch (error) {
    console.error('Error fetching ingredients:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching ingredients'
    })
  }
}

// Get ingredient by ID
export const getIngredientById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const ingredient = await Ingredient.findByPk(id, {
      include: [
        {
          model: IngredientCategory,
          as: 'category',
          attributes: ['id', 'categoryName']
        }
      ]
    })

    if (!ingredient) {
      res.status(404).json({
        success: false,
        message: 'Ingredient not found'
      })
      return
    }

    res.json({
      success: true,
      message: 'Ingredient retrieved successfully',
      data: ingredient
    })
  } catch (error) {
    console.error('Error fetching ingredient by ID:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching ingredient'
    })
  }
}

// Create new ingredient (Admin only)
export const createIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ingredientName, categoryId, description } = req.body
    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    // Check if ingredient already exists
    const existingIngredient = await Ingredient.findOne({
      where: { ingredientName }
    })

    if (existingIngredient) {
      res.status(400).json({
        success: false,
        message: 'Ingredient with this name already exists'
      })
      return
    }

    // Check if category exists
    const category = await IngredientCategory.findByPk(categoryId)
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      })
      return
    }

    // Create ingredient
    const ingredient = await Ingredient.create({
      ingredientName,
      categoryId,
      description: description || null
    })

    // Fetch with category
    const newIngredient = await Ingredient.findByPk(ingredient.id, {
      include: [
        {
          model: IngredientCategory,
          as: 'category',
          attributes: ['id', 'categoryName']
        }
      ]
    })

    res.status(201).json({
      success: true,
      message: 'Ingredient created successfully',
      data: newIngredient
    })
  } catch (error) {
    console.error('Error creating ingredient:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during ingredient creation'
    })
  }
}

// Update ingredient (Admin only)
export const updateIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { ingredientName, categoryId, description } = req.body
    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    const ingredient = await Ingredient.findByPk(id)

    if (!ingredient) {
      res.status(404).json({
        success: false,
        message: 'Ingredient not found'
      })
      return
    }

    // Check if new name already exists (excluding current ingredient)
    if (ingredientName && ingredientName !== ingredient.ingredientName) {
      const existingIngredient = await Ingredient.findOne({
        where: { 
          ingredientName,
          id: { [Op.ne]: id }
        }
      })

      if (existingIngredient) {
        res.status(400).json({
          success: false,
          message: 'Ingredient with this name already exists'
        })
        return
      }
    }

    // Check if category exists
    if (categoryId && categoryId !== ingredient.categoryId) {
      const category = await IngredientCategory.findByPk(categoryId)
      if (!category) {
        res.status(404).json({
          success: false,
          message: 'Category not found'
        })
        return
      }
    }

    // Update ingredient
    await ingredient.update({
      ingredientName: ingredientName || ingredient.ingredientName,
      categoryId: categoryId || ingredient.categoryId,
      description: description !== undefined ? description : ingredient.description
    })

    // Fetch updated ingredient with category
    const updatedIngredient = await Ingredient.findByPk(ingredient.id, {
      include: [
        {
          model: IngredientCategory,
          as: 'category',
          attributes: ['id', 'categoryName']
        }
      ]
    })

    res.json({
      success: true,
      message: 'Ingredient updated successfully',
      data: updatedIngredient
    })
  } catch (error) {
    console.error('Error updating ingredient:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during ingredient update'
    })
  }
}

// Delete ingredient (Admin only)
export const deleteIngredient = async (req: Request, res: Response): Promise<void> => {
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

    const ingredient = await Ingredient.findByPk(id)

    if (!ingredient) {
      res.status(404).json({
        success: false,
        message: 'Ingredient not found'
      })
      return
    }

    await ingredient.destroy()

    res.json({
      success: true,
      message: 'Ingredient deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting ingredient:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during ingredient deletion'
    })
  }
}

// Get all ingredient categories
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await IngredientCategory.findAll({
      order: [['categoryName', 'ASC']],
      attributes: ['id', 'categoryName', 'createdAt', 'updatedAt']
    })

    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      data: categories
    })
  } catch (error) {
    console.error('Error fetching categories:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error while fetching categories'
    })
  }
}

// Create ingredient category (Admin only)
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryName } = req.body
    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    // Check if category already exists
    const existingCategory = await IngredientCategory.findOne({
      where: { categoryName }
    })

    if (existingCategory) {
      res.status(400).json({
        success: false,
        message: 'Category with this name already exists'
      })
      return
    }

    const category = await IngredientCategory.create({
      categoryName
    })

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    })
  } catch (error) {
    console.error('Error creating category:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during category creation'
    })
  }
}

// Update ingredient category (Admin only)
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { categoryName } = req.body
    const admin = req.admin

    if (!admin) {
      res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
      return
    }

    const category = await IngredientCategory.findByPk(id)

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      })
      return
    }

    // Check if new name already exists (excluding current category)
    if (categoryName && categoryName !== category.categoryName) {
      const existingCategory = await IngredientCategory.findOne({
        where: { 
          categoryName,
          id: { [Op.ne]: id }
        }
      })

      if (existingCategory) {
        res.status(400).json({
          success: false,
          message: 'Category with this name already exists'
        })
        return
      }
    }

    await category.update({
      categoryName: categoryName || category.categoryName
    })

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    })
  } catch (error) {
    console.error('Error updating category:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during category update'
    })
  }
}

// Delete ingredient category (Admin only)
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
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

    const category = await IngredientCategory.findByPk(id)

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      })
      return
    }

    // Check if category has ingredients
    const ingredientCount = await Ingredient.count({
      where: { categoryId: id }
    })

    if (ingredientCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete category. It has ${ingredientCount} ingredient(s) associated with it. Please reassign or delete those ingredients first.`
      })
      return
    }

    await category.destroy()

    res.json({
      success: true,
      message: 'Category deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting category:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during category deletion'
    })
  }
}
