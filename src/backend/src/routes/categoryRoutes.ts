import { Router } from 'express';
import {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  assignCategoriesToRecipe,
  getRecipeCategories,
  removeCategoryFromRecipe,
} from '../controllers/categoryController';
import { authenticateAdmin, requireAdmin } from '../middleware/auth';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';

const router = Router();

// Validation middleware
const validateCategoryCreation = [
  body('categoryName')
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters'),
  body('categoryType')
    .notEmpty()
    .withMessage('Category type is required')
    .isIn(['cuisine', 'course', 'tag'])
    .withMessage('Category type must be: cuisine, course, or tag'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
];

const validateCategoryUpdate = [
  body('categoryName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category name must be between 1 and 100 characters'),
  body('categoryType')
    .optional()
    .isIn(['cuisine', 'course', 'tag'])
    .withMessage('Category type must be: cuisine, course, or tag'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
];

const validateCategoryIds = [
  body('categoryIds')
    .isArray({ min: 1 })
    .withMessage('categoryIds must be a non-empty array')
    .custom((value) => {
      if (!value.every((id: any) => Number.isInteger(id) && id > 0)) {
        throw new Error('All category IDs must be positive integers');
      }
      return true;
    }),
];

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories with optional filtering
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [cuisine, course, tag]
 *         description: Filter by category type
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 */
router.get('/', getAllCategories);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     summary: Get category by ID
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category retrieved successfully
 */
router.get('/:id', getCategoryById);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create new category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryName
 *               - categoryType
 *             properties:
 *               categoryName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               categoryType:
 *                 type: string
 *                 enum: [cuisine, course, tag]
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Category created successfully
 */
router.post('/', authenticateAdmin, requireAdmin, validateCategoryCreation, handleValidationErrors, createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoryName:
 *                 type: string
 *               categoryType:
 *                 type: string
 *                 enum: [cuisine, course, tag]
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Category updated successfully
 */
router.put('/:id', authenticateAdmin, requireAdmin, validateCategoryUpdate, handleValidationErrors, updateCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category deleted successfully
 */
router.delete('/:id', authenticateAdmin, requireAdmin, deleteCategory);

// Note: Recipe category routes are handled in recipeRoutes.ts
// These are kept here for backward compatibility but should be moved

export default router;

