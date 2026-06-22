import { Router } from 'express';
import {
  getAllConflicts,
  getConflictById,
  createConflict,
  updateConflict,
  deleteConflict,
} from '../controllers/conflictController';
import { authenticateAdmin, requireAdmin } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';

const router = Router();

router.use(generalLimiter);

const validateConflictCreation = [
  body('ingredientId1')
    .isInt({ min: 1 })
    .withMessage('Invalid first ingredient ID'),
  body('ingredientId2')
    .isInt({ min: 1 })
    .withMessage('Invalid second ingredient ID'),
  body('conflictReason')
    .notEmpty()
    .withMessage('Conflict reason is required')
    .isLength({ max: 500 })
    .withMessage('Conflict reason must be at most 500 characters'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid severity level'),
];

const validateConflictUpdate = [
  body('conflictReason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Conflict reason must be at most 500 characters'),
  body('severity')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Invalid severity level'),
];

router.get('/', authenticateAdmin, getAllConflicts);

router.get('/:id', authenticateAdmin, getConflictById);

router.post('/', authenticateAdmin, requireAdmin, validateConflictCreation, handleValidationErrors, createConflict);

router.put('/:id', authenticateAdmin, requireAdmin, validateConflictUpdate, handleValidationErrors, updateConflict);

router.delete('/:id', authenticateAdmin, requireAdmin, deleteConflict);

export default router;
