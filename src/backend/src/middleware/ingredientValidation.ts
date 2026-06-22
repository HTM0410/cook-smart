import { Request, Response, NextFunction } from 'express'
import { body, query, param, validationResult } from 'express-validator'

// Middleware để xử lý validation errors
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req)
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined
      }))
    })
    return
  }
  
  next()
}

// Validation for creating ingredient
export const validateIngredientCreation = [
  body('ingredientName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Ingredient name must be between 1 and 100 characters')
    .notEmpty()
    .withMessage('Ingredient name is required'),
  
  body('categoryId')
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  handleValidationErrors
]

// Validation for updating ingredient
export const validateIngredientUpdate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Ingredient ID must be a positive integer'),
  
  body('ingredientName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Ingredient name must be between 1 and 100 characters'),
  
  body('categoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  
  handleValidationErrors
]

// Validation for ingredient query parameters
export const validateIngredientQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search query must be between 1 and 100 characters'),
  
  query('categoryId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category ID must be a positive integer'),
  
  query('sortBy')
    .optional()
    .isIn(['ingredientName', 'categoryId', 'createdAt'])
    .withMessage('SortBy must be a valid field (ingredientName, categoryId, createdAt)'),
  
  query('order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Order must be ASC or DESC'),
  
  handleValidationErrors
]

// Validation for ingredient ID parameter
export const validateIngredientId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Ingredient ID must be a positive integer'),
  
  handleValidationErrors
]

// Validation for creating category
export const validateCategoryCreation = [
  body('categoryName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters')
    .notEmpty()
    .withMessage('Category name is required'),
  
  handleValidationErrors
]

