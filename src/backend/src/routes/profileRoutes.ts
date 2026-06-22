import { Router } from 'express';
import { 
  getUserProfile, 
  getUserFavorites, 
  updateProfile,
  getCurrentUserProfile,
  uploadUserAvatar,
  getUserActivity,
  getUserReviews,
  changePassword
} from '../controllers/profileController';
import { authenticateUser } from '../middleware/auth';
import { setCacheControl } from '../utils/response';
import { uploadAvatar } from '../config/multer';

const router = Router();

/**
 * @swagger
 * /api/profile/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 */
router.get('/me', authenticateUser, getCurrentUserProfile);

// Routes for /me/* that require authentication and redirect to current user
router.get('/me/favorites', authenticateUser, async (req, res, next) => {
  req.params.userId = String(req.user?.id);
  return getUserFavorites(req, res, next);
});

router.get('/me/activity', authenticateUser, async (req, res, next) => {
  req.params.userId = String(req.user?.id);
  return getUserActivity(req, res, next);
});

router.get('/me/reviews', authenticateUser, async (req, res, next) => {
  req.params.userId = String(req.user?.id);
  return getUserReviews(req, res, next);
});

/**
 * @swagger
 * /api/profile/:userId:
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 */
// Cache user profile for short time (private) to allow quick back/forward nav
router.get('/:userId', setCacheControl(60, 'private'), getUserProfile);

/**
 * @swagger
 * /api/profile/:userId/favorites:
 *   get:
 *     summary: Get user's favorite recipes
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Favorites retrieved successfully
 */
// Favorites change often; keep a brief cache to reduce chatter
router.get('/:userId/favorites', setCacheControl(30, 'private'), getUserFavorites);

/**
 * @swagger
 * /api/profile/:userId/activity:
 *   get:
 *     summary: Get user's activity feed
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
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
 *     responses:
 *       200:
 *         description: Activity feed retrieved successfully
 */
router.get('/:userId/activity', setCacheControl(15, 'private'), getUserActivity);

/**
 * @swagger
 * /api/profile/:userId/reviews:
 *   get:
 *     summary: Get user's reviews/comments
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 12
 *     responses:
 *       200:
 *         description: Reviews retrieved successfully
 */
router.get('/:userId/reviews', setCacheControl(30, 'private'), getUserReviews);

/**
 * @swagger
 * /api/profile:
 *   put:
 *     summary: Update current user profile
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               bio:
 *                 type: string
 *               location:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/', authenticateUser, updateProfile);

/**
 * @swagger
 * /api/profile/password:
 *   put:
 *     summary: Change user password
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.put('/password', authenticateUser, changePassword);

/**
 * @swagger
 * /api/profile/avatar:
 *   post:
 *     summary: Upload user avatar
 *     tags: [Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 */
router.post('/avatar', authenticateUser, uploadAvatar, uploadUserAvatar);

export default router;
