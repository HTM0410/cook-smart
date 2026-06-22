import { Router } from 'express';
import { 
  getAllIngredients,
  getIngredientById,
  createIngredient,
  updateIngredient,
  deleteIngredient,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/ingredientController';
import { setCacheControl } from '../utils/response';
import { authenticateAdmin, requireAdmin } from '../middleware/auth';
import {
  validateIngredientCreation,
  validateIngredientUpdate,
  validateIngredientQueryParams,
  validateIngredientId,
  validateCategoryCreation
} from '../middleware/ingredientValidation';

const router = Router();

/**
 * @swagger
 * /api/ingredients/categories/all:
 *   get:
 *     summary: Lấy tất cả danh mục nguyên liệu
 *     tags: [Ingredients]
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 */
// Category routes (MUST be before /:id routes)
// Public routes
// Cache categories for 1 hour (public)
router.get('/categories/all', setCacheControl(3600, 'public'), getAllCategories);

/**
 * @swagger
 * /api/ingredients/categories:
 *   post:
 *     summary: Tạo danh mục mới (Admin only)
 *     tags: [Ingredients]
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
 *             properties:
 *               categoryName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *     responses:
 *       201:
 *         description: Tạo danh mục thành công
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Admin-only routes
router.post('/categories', authenticateAdmin, requireAdmin, validateCategoryCreation, createCategory);
router.put('/categories/:id', authenticateAdmin, requireAdmin, validateCategoryCreation, updateCategory);
router.delete('/categories/:id', authenticateAdmin, requireAdmin, deleteCategory);

/**
 * @swagger
 * /api/ingredients:
 *   get:
 *     summary: Lấy danh sách nguyên liệu (có phân trang)
 *     tags: [Ingredients]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 */
// Ingredient routes
// Public routes
router.get('/', validateIngredientQueryParams, getAllIngredients);

/**
 * @swagger
 * /api/ingredients/{id}:
 *   get:
 *     summary: Lấy chi tiết nguyên liệu theo ID
 *     tags: [Ingredients]
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
router.get('/:id', validateIngredientId, getIngredientById);

/**
 * @swagger
 * /api/ingredients:
 *   post:
 *     summary: Tạo nguyên liệu mới (Admin only)
 *     tags: [Ingredients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ingredientName
 *               - categoryId
 *             properties:
 *               ingredientName:
 *                 type: string
 *               description:
 *                 type: string
 *               categoryId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Tạo nguyên liệu thành công
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Admin-only routes
router.post('/', authenticateAdmin, requireAdmin, validateIngredientCreation, createIngredient);

/**
 * @swagger
 * /api/ingredients/{id}:
 *   put:
 *     summary: Cập nhật nguyên liệu (Admin only)
 *     tags: [Ingredients]
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
 *         description: Cập nhật thành công
 */
router.put('/:id', authenticateAdmin, requireAdmin, validateIngredientUpdate, updateIngredient);

/**
 * @swagger
 * /api/ingredients/{id}:
 *   delete:
 *     summary: Xóa nguyên liệu (Admin only)
 *     tags: [Ingredients]
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
 */
router.delete('/:id', authenticateAdmin, requireAdmin, validateIngredientId, deleteIngredient);

export default router;

