import { Router } from 'express'
import { 
  registerUser, 
  loginUser, 
  loginAdmin, 
  getCurrentUser, 
  getCurrentAdmin, 
  refreshToken, 
  logout, 
  changePassword,
  forgotPassword,
  resetPassword
} from '../controllers/authController'
import { 
  validateUserRegistration, 
  validateUserLogin, 
  validateAdminLogin, 
  validatePasswordChange,
  validatePasswordResetRequest,
  validatePasswordReset
} from '../middleware/validation'
import { 
  authenticateUser, 
  authenticateAdmin 
} from '../middleware/auth'
import { 
  authLimiter, 
  generalLimiter 
} from '../middleware/rateLimiter'

const router = Router()

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản user mới
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - fullName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *                 example: Password123
 *               fullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: Nguyễn Văn A
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: User registered successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                     token:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Email đã tồn tại
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
// Public routes (no authentication required)
router.post('/register', 
  authLimiter, 
  validateUserRegistration, 
  registerUser
)

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Password123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 */
router.post('/login', 
  authLimiter, 
  validateUserLogin, 
  loginUser
)

/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     summary: Đăng nhập admin
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *               password:
 *                 type: string
 *                 format: password
 *                 example: Admin123
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/admin/login', 
  authLimiter, 
  validateAdminLogin, 
  loginAdmin
)

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed thành công
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/refresh-token', 
  generalLimiter, 
  refreshToken
)

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 */
router.post('/logout', 
  generalLimiter, 
  logout
)

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin user hiện tại
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
// Protected routes (authentication required)
router.get('/me', 
  generalLimiter, 
  authenticateUser, 
  getCurrentUser
)

/**
 * @swagger
 * /api/auth/admin/me:
 *   get:
 *     summary: Lấy thông tin admin hiện tại
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get('/admin/me', 
  generalLimiter, 
  authenticateAdmin, 
  getCurrentAdmin
)

/**
 * @swagger
 * /api/auth/change-password:
 *   put:
 *     summary: Đổi mật khẩu
 *     tags: [Authentication]
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
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Đổi mật khẩu thành công
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.put('/change-password', 
  generalLimiter, 
  authenticateUser, 
  validatePasswordChange, 
  changePassword
)

// Forgot password
router.post('/forgot-password',
  generalLimiter,
  validatePasswordResetRequest,
  forgotPassword
)

// Reset password
router.put('/reset-password',
  generalLimiter,
  validatePasswordReset,
  resetPassword
)

export default router
