import { Router } from 'express';
import {
  getDashboardStats,
  getUsers,
  updateUserStatus,
  getRecipes,
  updateRecipeStatus,
  updateRecipeFull,
  deleteRecipe,
  getIngredients,
  getComments,
  deleteComment,
  batchUpdateUsers,
  batchUpdateRecipes,
} from '../controllers/adminController';
import { authenticateAdmin, requireAdmin } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import {
  getMlopsOverview,
  getFeedbackQueue,
  decideFeedback,
  exportFeedback,
  syncFeedback,
  releaseToPipeline,
  getFeedbackStats,
  updateConfidenceThreshold,
  getConfidenceThreshold,
} from '../controllers/mlopsAdminController';
import {
  listModels,
  getModel,
  uploadModel,
  updateModel,
  deleteModel,
  setActiveModel,
  addAlias,
  removeAlias,
  uploadMiddleware,
} from '../controllers/modelRegistryController';

const router = Router();

// Apply admin authentication to all routes
router.use(authenticateAdmin);
router.use(requireAdmin);
// Skip rate limiter for admin in development - already handled in generalLimiter skip function
if (process.env.NODE_ENV !== 'development') {
  router.use(generalLimiter);
}

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get('/dashboard/stats', getDashboardStats);

/**
 * @swagger
 * /api/admin/mlops/overview:
 *   get:
 *     summary: Get ingredient detection MLOps operational overview
 *     tags: [Admin - MLOps]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: MLOps overview retrieved successfully
 */
router.get('/mlops/overview', getMlopsOverview);

// =============================================================================
// MLOps feedback review endpoints (Admin)
// =============================================================================

/**
 * @swagger
 * /api/admin/mlops/feedback/queue:
 *   get:
 *     summary: List detection corrections pending or reviewed
 *     tags: [Admin - MLOps]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, rejected] }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: OK }
 */
router.get('/mlops/feedback/queue', getFeedbackQueue);

/**
 * @swagger
 * /api/admin/mlops/feedback/stats:
 *   get:
 *     summary: Aggregate stats for corrections
 *     tags: [Admin - MLOps]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/mlops/feedback/stats', getFeedbackStats);

/**
 * @swagger
 * /api/admin/mlops/feedback/{id}/decision:
 *   post:
 *     summary: Approve or reject a correction
 *     tags: [Admin - MLOps]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [approved, rejected] }
 *               notes: { type: string }
 */
router.post('/mlops/feedback/:id/decision', decideFeedback);

/**
 * @swagger
 * /api/admin/mlops/feedback/export:
 *   post:
 *     summary: Export approved corrections as YOLO labels
 *     tags: [Admin - MLOps]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/mlops/feedback/export', exportFeedback);

/**
 * @swagger
 * /api/admin/mlops/feedback/sync:
 *   post:
 *     summary: Sync DetectionHistory modifications into DetectionCorrection rows
 *     tags: [Admin - MLOps]
 */
router.post('/mlops/feedback/sync', syncFeedback);

/**
 * @swagger
 * /api/admin/mlops/release-to-pipeline:
 *   post:
 *     summary: Promote W&B candidate -> production and trigger CodePipeline
 *     tags: [Admin - MLOps]
 */
router.post('/mlops/release-to-pipeline', releaseToPipeline);

/**
 * @swagger
 * /api/admin/mlops/threshold:
 *   get:
 *     summary: Read the current effective YOLO confidence threshold
 *   put:
 *     summary: Update YOLO confidence threshold at runtime (persists on the service)
 */
router.get('/mlops/threshold', getConfidenceThreshold);
router.put('/mlops/threshold', updateConfidenceThreshold);

// =============================================================================
// Model Registry endpoints (Admin)
// =============================================================================

router.get('/models', listModels);
router.get('/models/:version', getModel);
router.post('/models/upload', uploadMiddleware, uploadModel);
router.put('/models/:version', updateModel);
router.delete('/models/:version', deleteModel);
router.post('/models/:version/set-active', setActiveModel);
router.post('/models/:version/aliases', addAlias);
router.delete('/models/:version/aliases/:alias', removeAlias);

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Get all users with pagination and filters
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, banned]
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [user, admin]
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 */
router.get('/users', getUsers);

/**
 * @swagger
 * /api/admin/users/{userId}/status:
 *   put:
 *     summary: Update user status
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, banned]
 *     responses:
 *       200:
 *         description: User status updated successfully
 */
router.put('/users/:userId/status', updateUserStatus);

/**
 * @swagger
 * /api/admin/users/batch:
 *   post:
 *     summary: Batch operations for users
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *               - action
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               action:
 *                 type: string
 *                 enum: [updateStatus, delete]
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Batch operation completed successfully
 */
router.post('/users/batch', batchUpdateUsers);

/**
 * @swagger
 * /api/admin/recipes:
 *   get:
 *     summary: Get all recipes with pagination and filters
 *     tags: [Admin - Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [visible, hidden, pending]
 *       - in: query
 *         name: difficulty
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard]
 *     responses:
 *       200:
 *         description: Recipes retrieved successfully
 */
router.get('/recipes', getRecipes);

/**
 * @swagger
 * /api/admin/recipes/{recipeId}/status:
 *   put:
 *     summary: Update recipe status
 *     tags: [Admin - Recipes]
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
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [visible, hidden, pending]
 *     responses:
 *       200:
 *         description: Recipe status updated successfully
 */
router.put('/recipes/:recipeId/status', updateRecipeStatus);

/**
 * @swagger
 * /api/admin/recipes/{recipeId}:
 *   put:
 *     summary: Update recipe with ingredients and steps
 *     tags: [Admin - Recipes]
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
 *             properties:
 *               recipeName:
 *                 type: string
 *               description:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *               status:
 *                 type: string
 *                 enum: [visible, hidden, pending]
 *               prepTime:
 *                 type: integer
 *               cookTime:
 *                 type: integer
 *               servings:
 *                 type: integer
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     ingredientName:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *               steps:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     stepNumber:
 *                       type: integer
 *                     instruction:
 *                       type: string
 *     responses:
 *       200:
 *         description: Recipe updated successfully
 */
router.put('/recipes/:recipeId', updateRecipeFull);

/**
 * @swagger
 * /api/admin/recipes/{recipeId}:
 *   delete:
 *     summary: Delete recipe
 *     tags: [Admin - Recipes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Recipe deleted successfully
 */
router.delete('/recipes/:recipeId', deleteRecipe);

/**
 * @swagger
 * /api/admin/recipes/batch:
 *   post:
 *     summary: Batch operations for recipes
 *     tags: [Admin - Recipes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipeIds
 *               - action
 *             properties:
 *               recipeIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *               action:
 *                 type: string
 *                 enum: [updateStatus, delete]
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Batch operation completed successfully
 */
router.post('/recipes/batch', batchUpdateRecipes);

/**
 * @swagger
 * /api/admin/ingredients:
 *   get:
 *     summary: Get all ingredients with pagination and filters
 *     tags: [Admin - Ingredients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: category
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Ingredients retrieved successfully
 */
router.get('/ingredients', getIngredients);

/**
 * @swagger
 * /api/admin/comments:
 *   get:
 *     summary: Get all comments with pagination and filters
 *     tags: [Admin - Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: recipeId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 */
router.get('/comments', getComments);

/**
 * @swagger
 * /api/admin/comments/{commentId}:
 *   delete:
 *     summary: Delete comment (soft delete)
 *     tags: [Admin - Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 */
router.delete('/comments/:commentId', deleteComment);

export default router;
