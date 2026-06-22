import { body, query, param } from 'express-validator'
import { handleValidationErrors } from './validation'

// Validation for recipe creation
export const validateRecipeCreation = [
  body('recipeName')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Recipe name must be between 3 and 200 characters')
    .notEmpty()
    .withMessage('Recipe name is required'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),

  body('prepTime')
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage('Prep time must be a positive integer (0-9999 minutes)'),

  body('cookTime')
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage('Cook time must be a positive integer (0-9999 minutes)'),

  body('servings')
    .optional()
    .isInt({ min: 1, max: 999 })
    .withMessage('Servings must be between 1 and 999'),

  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be one of: easy, medium, hard'),

  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),

  body('steps')
    .optional()
    .isArray()
    .withMessage('Steps must be an array'),

  body('steps.*.stepNumber')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Step number must be a positive integer'),

  body('steps.*.instruction')
    .if(body('steps').exists())
    .trim()
    .notEmpty()
    .withMessage('Step instruction is required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Step instruction must be between 5 and 1000 characters'),

  body('steps.*.imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Step image URL must be a valid URL'),

  body('ingredients')
    .optional()
    .isArray()
    .withMessage('Ingredients must be an array'),

  body('ingredients.*.ingredientId')
    .if(body('ingredients').exists())
    .isInt({ min: 1 })
    .withMessage('Ingredient ID must be a positive integer'),

  body('ingredients.*.quantity')
    .if(body('ingredients').exists())
    .notEmpty()
    .withMessage('Ingredient quantity is required')
    .isLength({ max: 50 })
    .withMessage('Quantity must not exceed 50 characters'),

  body('ingredients.*.unit')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Unit must not exceed 50 characters'),

  handleValidationErrors
]

// Validation for recipe update
export const validateRecipeUpdate = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Recipe ID must be a positive integer'),

  body('recipeName')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Recipe name must be between 3 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),

  body('prepTime')
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage('Prep time must be a positive integer (0-9999 minutes)'),

  body('cookTime')
    .optional()
    .isInt({ min: 0, max: 9999 })
    .withMessage('Cook time must be a positive integer (0-9999 minutes)'),

  body('servings')
    .optional()
    .isInt({ min: 1, max: 999 })
    .withMessage('Servings must be between 1 and 999'),

  body('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be one of: easy, medium, hard'),

  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),

  body('status')
    .optional()
    .isIn(['visible', 'hidden'])
    .withMessage('Status must be either "visible" or "hidden"'),

  handleValidationErrors
]

// Validation for adding recipe step
export const validateRecipeStep = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Recipe ID must be a positive integer'),

  body('stepNumber')
    .isInt({ min: 1 })
    .withMessage('Step number must be a positive integer'),

  body('instruction')
    .trim()
    .notEmpty()
    .withMessage('Instruction is required')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Instruction must be between 5 and 1000 characters'),

  body('imageUrl')
    .optional()
    .trim()
    .isURL()
    .withMessage('Image URL must be a valid URL'),

  handleValidationErrors
]

// Validation for adding recipe ingredient
export const validateRecipeIngredient = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Recipe ID must be a positive integer'),

  body('ingredientId')
    .isInt({ min: 1 })
    .withMessage('Ingredient ID must be a positive integer'),

  body('quantity')
    .trim()
    .notEmpty()
    .withMessage('Quantity is required')
    .isLength({ max: 50 })
    .withMessage('Quantity must not exceed 50 characters'),

  body('unit')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Unit must not exceed 50 characters'),

  handleValidationErrors
]

// Validation for recipe query parameters
export const validateRecipeQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Search query must be between 1 and 200 characters'),

  query('status')
    .optional()
    .isIn(['visible', 'hidden'])
    .withMessage('Status must be either "visible" or "hidden"'),

  query('sortBy')
    .optional()
    .isIn(['recipeName', 'createdAt', 'updatedAt', 'prepTime', 'cookTime'])
    .withMessage('Invalid sort field'),

  query('order')
    .optional()
    .isIn(['ASC', 'DESC'])
    .withMessage('Order must be either "ASC" or "DESC"'),

  handleValidationErrors
]

