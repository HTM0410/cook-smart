import express from 'express';
import { trackSearch, getTrendingKeywords } from '../controllers/searchKeywordController';
import { setCacheControl } from '../utils/response';

const router = express.Router();

/**
 * @swagger
 * /api/search-keywords/track:
 *   post:
 *     summary: Track a search keyword
 *     tags: [Search Keywords]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - keyword
 *             properties:
 *               keyword:
 *                 type: string
 *                 example: "phở bò"
 *     responses:
 *       200:
 *         description: Search tracked successfully
 */
router.post('/track', trackSearch);

/**
 * @swagger
 * /api/search-keywords/trending:
 *   get:
 *     summary: Get trending search keywords
 *     tags: [Search Keywords]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of keywords to return
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to look back (0 = all time)
 *     responses:
 *       200:
 *         description: Trending keywords retrieved successfully
 */
router.get('/trending', setCacheControl(60, 'public'), getTrendingKeywords);

export default router;
