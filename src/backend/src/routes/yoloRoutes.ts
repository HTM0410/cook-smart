import { Router } from 'express';
import {
  getYoloHealth,
  getYoloInfo,
  getLabels,
  detectIngredients,
  searchRecipesByDetection,
  saveDetectionHistory,
} from '../controllers/yoloController';

const router = Router();

/**
 * @swagger
 * /api/yolo/health:
 *   get:
 *     summary: Check YOLO service health
 *     tags: [YOLO]
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Force refresh health cache
 *     responses:
 *       200:
 *         description: Health status retrieved
 *       503:
 *         description: YOLO service unavailable
 */
router.get('/health', getYoloHealth);

/**
 * @swagger
 * /api/yolo/info:
 *   get:
 *     summary: Get YOLO service detailed information
 *     tags: [YOLO]
 *     responses:
 *       200:
 *         description: Service info retrieved
 *       503:
 *         description: YOLO service unavailable
 */
router.get('/info', getYoloInfo);

/**
 * @swagger
 * /api/yolo/labels:
 *   get:
 *     summary: Get all supported YOLO labels
 *     tags: [YOLO]
 *     responses:
 *       200:
 *         description: Labels retrieved
 */
router.get('/labels', getLabels);

/**
 * @swagger
 * /api/yolo/detect:
 *   post:
 *     summary: Detect ingredients from uploaded image
 *     tags: [YOLO]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageBase64
 *             properties:
 *               imageBase64:
 *                 type: string
 *                 description: Base64 encoded image data (with or without data URL prefix)
 *               mimeType:
 *                 type: string
 *                 description: Image MIME type (e.g., image/jpeg, image/png)
 *               minConfidence:
 *                 type: number
 *                 description: Minimum confidence threshold (0-1)
 *     responses:
 *       200:
 *         description: Detection successful
 *       400:
 *         description: Invalid request
 *       503:
 *         description: YOLO service unavailable
 */
router.post('/detect', detectIngredients);

/**
 * @swagger
 * /api/yolo/search-recipes:
 *   post:
 *     summary: Detect ingredients and search for matching recipes
 *     tags: [YOLO]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageBase64
 *             properties:
 *               imageBase64:
 *                 type: string
 *                 description: Base64 encoded image data
 *               mimeType:
 *                 type: string
 *                 description: Image MIME type
 *               minConfidence:
 *                 type: number
 *                 description: Minimum confidence threshold
 *     responses:
 *       200:
 *         description: Detection and search successful
 *       400:
 *         description: Invalid request
 */
router.post('/search-recipes', searchRecipesByDetection);

/**
 * @swagger
 * /api/yolo/save-history:
 *   post:
 *     summary: Save detection history when user modifies AI results
 *     tags: [YOLO]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - imageHash
 *               - originalIngredients
 *               - finalIngredients
 *               - wasModified
 *             properties:
 *               imageHash:
 *                 type: string
 *                 description: Hash of the uploaded image
 *               originalIngredients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Original ingredients detected by AI
 *               finalIngredients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Final ingredients after user modification
 *               wasModified:
 *                 type: boolean
 *                 description: Whether user modified the results
 *     responses:
 *       200:
 *         description: History saved successfully
 *       400:
 *         description: Invalid request
 */
router.post('/save-history', saveDetectionHistory);

export default router;
