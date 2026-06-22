import { Router } from 'express';
import { body } from 'express-validator';
import {
  getPendingIngredients,
  getPendingIngredientsStats,
  approvePendingIngredient,
  rejectPendingIngredient,
  getPendingIngredient,
  submitPendingIngredient,
} from '../controllers/pendingIngredientController';
import { authenticateUser } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// Validation middleware
const validateRejectIngredient = [
  body('rejectionReason')
    .notEmpty()
    .withMessage('Rejection reason is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Rejection reason must be between 10 and 500 characters'),
];

const validateSubmitIngredient = [
  body('ingredientName')
    .notEmpty()
    .withMessage('Ingredient name is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Ingredient name must be between 1 and 100 characters'),
  body('categoryId')
    .isInt({ min: 1 })
    .withMessage('Valid category ID is required'),
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
];

// Admin routes (protected by admin authentication)
router.get('/admin/pending-ingredients', authenticateUser, requireAdmin, getPendingIngredients);
router.get('/admin/pending-ingredients/stats', authenticateUser, requireAdmin, getPendingIngredientsStats);
router.get('/admin/pending-ingredients/:id', authenticateUser, requireAdmin, getPendingIngredient);
router.post('/admin/pending-ingredients/:id/approve', authenticateUser, requireAdmin, approvePendingIngredient);
router.post('/admin/pending-ingredients/:id/reject', authenticateUser, requireAdmin, validateRejectIngredient, rejectPendingIngredient);

// User routes (for submitting new ingredients)
router.post('/pending-ingredients', authenticateUser, validateSubmitIngredient, submitPendingIngredient);

export default router;
