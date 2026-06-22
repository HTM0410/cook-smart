import { Router } from 'express'
import {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  toggleRecipeVisibility,
  addRecipeStep,
  addRecipeIngredient
} from '../controllers/recipeController'
import { searchRecipesByKeyword, searchRecipesByIngredients } from '../controllers/recipeSearchController'
import {
  assignCategoriesToRecipe,
  getRecipeCategories,
  removeCategoryFromRecipe,
} from '../controllers/categoryController'
import { authenticateAdmin, optionalAuth, requireAdmin } from '../middleware/auth'
import { generalLimiter } from '../middleware/rateLimiter'
import { validateRecipeCreation, validateRecipeUpdate, validateRecipeStep, validateRecipeIngredient } from '../middleware/recipeValidation'
import { body } from 'express-validator'
import { handleValidationErrors } from '../middleware/validation'

const router = Router()

// Apply general rate limiting
router.use(generalLimiter)

/**
 * @swagger
 * /api/recipes:
 *   get:
 *     summary: Lấy danh sách công thức nấu ăn (có phân trang)
 *     tags: [Recipes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, recipeName, prepTime, cookTime, servings, difficulty]
 *           default: createdAt
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     recipes:
 *                       type: array
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 */
// Public routes (optional auth for personalized data)
router.get('/', optionalAuth, getAllRecipes)

/**
 * @swagger
 * /api/recipes/search:
 *   get:
 *     summary: Tìm kiếm công thức theo từ khóa và bộ lọc
 *     tags: [Recipes]
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *         description: "Chuỗi cách nhau bởi dấu phẩy vd: easy,medium"
 *       - in: query
 *         name: min_time
 *         schema:
 *           type: integer
 *       - in: query
 *         name: max_time
 *         schema:
 *           type: integer
 *       - in: query
 *         name: servings
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Kết quả tìm kiếm
 */
router.get('/search', optionalAuth, searchRecipesByKeyword)

/**
 * @swagger
 * /api/recipes/by-ingredients:
 *   post:
 *     summary: Tìm công thức dựa trên danh sách nguyên liệu
 *     tags: [Recipes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *               difficulty:
 *                 type: array
 *                 items:
 *                   type: string
 *               prepTimeMax:
 *                 type: integer
 *               cookTimeMax:
 *                 type: integer
 *               servingsMin:
 *                 type: integer
 *               servingsMax:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Danh sách công thức phù hợp
 */
router.post('/by-ingredients', optionalAuth, searchRecipesByIngredients)

/**
 * @swagger
 * /api/recipes/{id}:
 *   get:
 *     summary: Lấy chi tiết công thức theo ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
/**
 * @swagger
 * /api/recipes/{recipeId}/categories:
 *   get:
 *     summary: Get all categories for a recipe
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Recipe categories retrieved successfully
 */
router.get('/:recipeId/categories', optionalAuth, getRecipeCategories)

/**
 * @swagger
 * /api/recipes/{recipeId}/categories:
 *   post:
 *     summary: Assign categories to a recipe (Admin only)
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryIds
 *             properties:
 *               categoryIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *     responses:
 *       200:
 *         description: Categories assigned successfully
 */
const validateCategoryIds = [
  body('categoryIds')
    .isArray({ min: 1 })
    .withMessage('categoryIds must be a non-empty array')
    .custom((value) => {
      if (!value.every((id: any) => Number.isInteger(id) && id > 0)) {
        throw new Error('All category IDs must be positive integers')
      }
      return true
    }),
]
router.post('/:recipeId/categories', authenticateAdmin, requireAdmin, validateCategoryIds, handleValidationErrors, assignCategoriesToRecipe)

/**
 * @swagger
 * /api/recipes/{recipeId}/categories/{categoryId}:
 *   delete:
 *     summary: Remove a category from a recipe (Admin only)
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Category removed from recipe successfully
 */
router.delete('/:recipeId/categories/:categoryId', authenticateAdmin, requireAdmin, removeCategoryFromRecipe)

router.get('/:id', optionalAuth, getRecipeById)

/**
 * @swagger
 * /api/recipes:
 *   post:
 *     summary: Tạo công thức mới (Admin only)
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipeName
 *               - prepTime
 *               - cookTime
 *               - servings
 *               - difficulty
 *             properties:
 *               recipeName:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 150
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               prepTime:
 *                 type: integer
 *                 minimum: 0
 *               cookTime:
 *                 type: integer
 *                 minimum: 0
 *               servings:
 *                 type: integer
 *                 minimum: 1
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *               steps:
 *                 type: array
 *               ingredients:
 *                 type: array
 *     responses:
 *       201:
 *         description: Tạo công thức thành công
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// Admin-only routes
router.post('/', authenticateAdmin, validateRecipeCreation, createRecipe)

/**
 * @swagger
 * /api/recipes/{id}:
 *   put:
 *     summary: Cập nhật công thức (Admin only)
 *     tags: [Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/:id', authenticateAdmin, validateRecipeUpdate, updateRecipe)

/**
 * @swagger
 * /api/recipes/{id}:
 *   delete:
 *     summary: Xóa công thức (Admin only)
 *     tags: [Recipes]
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
 *         description: Xóa thành công
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', authenticateAdmin, deleteRecipe)

/**
 * @swagger
 * /api/recipes/{id}/visibility:
 *   patch:
 *     summary: Thay đổi trạng thái hiển thị (Admin only)
 *     tags: [Recipes]
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
 *               status:
 *                 type: string
 *                 enum: [visible, hidden]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 */
router.patch('/:id/visibility', authenticateAdmin, toggleRecipeVisibility)

/**
 * @swagger
 * /api/recipes/{id}/steps:
 *   post:
 *     summary: Thêm bước nấu (Admin only)
 *     tags: [Recipes]
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
 *             required:
 *               - stepNumber
 *               - instruction
 *             properties:
 *               stepNumber:
 *                 type: integer
 *               instruction:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Thêm bước thành công
 */
// Recipe steps management (Admin only)
router.post('/:id/steps', authenticateAdmin, validateRecipeStep, addRecipeStep)

/**
 * @swagger
 * /api/recipes/{id}/ingredients:
 *   post:
 *     summary: Thêm nguyên liệu vào công thức (Admin only)
 *     tags: [Recipes]
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
 *             required:
 *               - ingredientId
 *               - quantity
 *             properties:
 *               ingredientId:
 *                 type: integer
 *               quantity:
 *                 type: number
 *               unit:
 *                 type: string
 *     responses:
 *       201:
 *         description: Thêm nguyên liệu thành công
 */
// Recipe ingredients management (Admin only)
router.post('/:id/ingredients', authenticateAdmin, validateRecipeIngredient, addRecipeIngredient)

export default router

