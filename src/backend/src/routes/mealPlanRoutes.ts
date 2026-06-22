import { Router } from 'express';
import {
  createMealPlan,
  getMealPlans,
  getMealPlanById,
  addRecipeToMealPlan,
  removeRecipeFromMealPlan,
  updateMealPlanItem,
  deleteMealPlan,
  updateMealPlanStatus,
  getGroceryList,
} from '../controllers/mealPlanController';
import { authenticateUser } from '../middleware/auth';
import { generalLimiter } from '../middleware/rateLimiter';
import { body } from 'express-validator';
import { handleValidationErrors } from '../middleware/validation';

const router = Router();

router.use(generalLimiter);

const validateMealPlanCreation = [
  body('planName')
    .notEmpty()
    .withMessage('Plan name is required')
    .isLength({ max: 200 })
    .withMessage('Plan name must be at most 200 characters'),
  body('startDate')
    .notEmpty()
    .withMessage('Start date is required')
    .isISO8601()
    .withMessage('Invalid start date format'),
  body('endDate')
    .notEmpty()
    .withMessage('End date is required')
    .isISO8601()
    .withMessage('Invalid end date format'),
];

const validateRecipeAddition = [
  body('recipeId')
    .isInt({ min: 1 })
    .withMessage('Invalid recipe ID'),
  body('plannedDate')
    .notEmpty()
    .withMessage('Planned date is required')
    .isISO8601()
    .withMessage('Invalid planned date format'),
  body('mealType')
    .isIn(['breakfast', 'lunch', 'dinner', 'snack'])
    .withMessage('Invalid meal type'),
  body('servings')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Servings must be at least 1'),
];

router.post('/', authenticateUser, validateMealPlanCreation, handleValidationErrors, createMealPlan);

router.get('/', authenticateUser, getMealPlans);

router.get('/:id', authenticateUser, getMealPlanById);

router.post('/:id/items', authenticateUser, validateRecipeAddition, handleValidationErrors, addRecipeToMealPlan);

router.delete('/:id/items/:itemId', authenticateUser, removeRecipeFromMealPlan);

router.patch('/:id/items/:itemId', authenticateUser, updateMealPlanItem);

router.delete('/:id', authenticateUser, deleteMealPlan);

router.patch('/:id/status', authenticateUser, updateMealPlanStatus);

router.get('/:id/grocery-list', authenticateUser, getGroceryList);

export default router;
