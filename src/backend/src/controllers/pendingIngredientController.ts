import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import PendingIngredient from '../models/PendingIngredient';
import IngredientCategory from '../models/IngredientCategory';
import Ingredient from '../models/Ingredient';
import User from '../models/User';
import { BadRequestError, NotFoundError } from '../utils/errors';

/**
 * GET /api/admin/pending-ingredients
 * Get all pending ingredients with pagination
 */
export const getPendingIngredients = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string || 'pending';

    let whereClause: any = {};
    if (status !== 'all') {
      whereClause.status = status;
    }

    const offset = (page - 1) * limit;
    
    const { count, rows } = await PendingIngredient.findAndCountAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      success: true,
      data: {
        ingredients: rows,
        pagination: {
          page,
          limit,
          total: count,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching pending ingredients:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * GET /api/admin/pending-ingredients/stats
 * Get pending ingredients statistics
 */
export const getPendingIngredientsStats = async (req: Request, res: Response) => {
  try {
    const stats = await PendingIngredient.getStats();
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching pending ingredients stats:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

/**
 * POST /api/admin/pending-ingredients/:id/approve
 * Approve a pending ingredient
 */
export const approvePendingIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const reviewedBy = (req as any).user.id;

    const pendingIngredient = await PendingIngredient.approveIngredient(
      parseInt(id),
      reviewedBy
    );

    res.json({
      success: true,
      message: 'Ingredient approved successfully',
      data: pendingIngredient,
    });
    return;
  } catch (error) {
    console.error('Error approving pending ingredient:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Pending ingredient not found') {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      if (error.message === 'Ingredient is not in pending status') {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
    return;
  }
};

/**
 * POST /api/admin/pending-ingredients/:id/reject
 * Reject a pending ingredient
 */
export const rejectPendingIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { id } = req.params;
    const { rejectionReason } = req.body;
    const reviewedBy = (req as any).user.id;

    const pendingIngredient = await PendingIngredient.rejectIngredient(
      parseInt(id),
      reviewedBy,
      rejectionReason
    );

    res.json({
      success: true,
      message: 'Ingredient rejected successfully',
      data: pendingIngredient,
    });
    return;
  } catch (error) {
    console.error('Error rejecting pending ingredient:', error);
    
    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }
    
    if (error instanceof Error) {
      if (error.message === 'Pending ingredient not found') {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      if (error.message === 'Ingredient is not in pending status') {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
    return;
  }
};

/**
 * GET /api/admin/pending-ingredients/:id
 * Get a specific pending ingredient
 */
export const getPendingIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const pendingIngredient = await PendingIngredient.findByPk(id);

    if (!pendingIngredient) {
      throw new NotFoundError('Pending ingredient not found');
    }

    res.json({
      success: true,
      data: pendingIngredient,
    });
    return;
  } catch (error) {
    console.error('Error fetching pending ingredient:', error);
    
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
    return;
  }
};

/**
 * POST /api/pending-ingredients
 * Submit a new pending ingredient (for regular users)
 */
export const submitPendingIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { ingredientName, categoryId, description } = req.body;
    
    // Check if user is authenticated
    if (!(req as any).user || !(req as any).user.id) {
      console.error('User not authenticated:', (req as any).user);
      throw new BadRequestError('User not authenticated', 'USER_NOT_AUTHENTICATED');
    }
    
    const submittedBy = (req as any).user.id;

    // Check if ingredient already exists
    const existingIngredient = await Ingredient.findOne({
      where: { ingredientName },
    });

    if (existingIngredient) {
      throw new BadRequestError('Ingredient already exists', 'INGREDIENT_EXISTS');
    }

    // Check if already pending
    const existingPending = await PendingIngredient.findOne({
      where: { 
        ingredientName,
        status: 'pending'
      },
    });

    if (existingPending) {
      throw new BadRequestError('Ingredient is already pending approval', 'ALREADY_PENDING');
    }

    const pendingIngredient = await PendingIngredient.create({
      ingredientName,
      categoryId,
      description,
      submittedBy,
    });

    res.status(201).json({
      success: true,
      message: 'Ingredient submitted for approval',
      data: pendingIngredient,
    });
    return;
  } catch (error) {
    console.error('Error submitting pending ingredient:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    console.error('Request body:', req.body);
    console.error('Request user:', (req as any).user);
    
    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
};
