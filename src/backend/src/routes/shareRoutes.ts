import express from 'express';
import { getRecipeSharePreview, trackShare } from '../controllers/shareController';
import { authenticateUser } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/share/recipe/{recipeId}/preview:
 *   get:
 *     summary: Get recipe share preview with OG tags
 *     tags: [Share]
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Recipe ID
 *     responses:
 *       200:
 *         description: HTML preview with OG tags
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       404:
 *         description: Recipe not found
 */
router.get('/recipe/:recipeId/preview', getRecipeSharePreview);

/**
 * @swagger
 * /api/share/track:
 *   post:
 *     summary: Track share analytics
 *     tags: [Share]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipeId
 *               - platform
 *             properties:
 *               recipeId:
 *                 type: integer
 *                 description: Recipe ID
 *               platform:
 *                 type: string
 *                 description: Share platform (facebook, twitter, whatsapp, etc.)
 *     responses:
 *       200:
 *         description: Share tracked successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/track', authenticateUser, trackShare);

export default router;

