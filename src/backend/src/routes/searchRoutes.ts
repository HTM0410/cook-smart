import { Router } from 'express';
import { searchRecipesByIngredients, autocompleteIngredients, autocompleteRecipes } from '../controllers/searchController';
import { generalLimiter } from '../middleware/rateLimiter';
import { optionalAuth } from '../middleware/auth';

const router = Router();

// Apply rate limiting
router.use(generalLimiter);

/**
 * @swagger
 * /api/search/recipes:
 *   post:
 *     summary: Tìm kiếm công thức theo nguyên liệu
 *     tags: [Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ingredients
 *             properties:
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["tomato", "cheese", "basil"]
 *                 minItems: 1
 *                 maxItems: 20
 *               limit:
 *                 type: integer
 *                 default: 10
 *                 minimum: 1
 *                 maximum: 100
 *               offset:
 *                 type: integer
 *                 default: 0
 *                 minimum: 0
 *               minMatchPercentage:
 *                 type: integer
 *                 default: 50
 *                 minimum: 1
 *                 maximum: 100
 *                 description: Phần trăm nguyên liệu tối thiểu phải khớp
 *               sortBy:
 *                 type: string
 *                 enum: [relevance, createdAt, name]
 *                 default: relevance
 *               order:
 *                 type: string
 *                 enum: [ASC, DESC]
 *                 default: DESC
 *     responses:
 *       200:
 *         description: Tìm kiếm thành công
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
 *                       items:
 *                         type: object
 *                     searchTerms:
 *                       type: array
 *                       items:
 *                         type: string
 *                     matchedIngredients:
 *                       type: array
 *                       items:
 *                         type: integer
 *                     pagination:
 *                       type: object
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/recipes', optionalAuth, searchRecipesByIngredients);

/**
 * @swagger
 * /api/search/ingredients/autocomplete:
 *   get:
 *     summary: Gợi ý tên nguyên liệu (autocomplete)
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Từ khóa tìm kiếm
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Lấy gợi ý thành công
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
 *                     query:
 *                       type: string
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                           category:
 *                             type: string
 *                           score:
 *                             type: number
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/ingredients/autocomplete', autocompleteIngredients);

/**
 * @swagger
 * /api/search/recipes/autocomplete:
 *   get:
 *     summary: Gợi ý tên công thức (autocomplete)
 *     tags: [Search]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Từ khóa tìm kiếm
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Lấy gợi ý thành công
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
 *                     query:
 *                       type: string
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           text:
 *                             type: string
 *                           score:
 *                             type: number
 *                     source:
 *                       type: string
 *                       enum: [elasticsearch, fallback]
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.get('/recipes/autocomplete', autocompleteRecipes);

export default router;

