import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import { IngredientConflict, Ingredient } from '../models';
import { Op } from 'sequelize';

export const getAllConflicts = async (req: Request, res: Response) => {
  try {
    const { severity, ingredientId } = req.query;

    const where: any = {};
    if (severity) {
      where.severity = severity;
    }
    if (ingredientId) {
      where[Op.or] = [
        { ingredientId1: ingredientId },
        { ingredientId2: ingredientId },
      ];
    }

    const conflicts = await IngredientConflict.findAll({
      where,
      include: [
        { model: Ingredient, as: 'ingredient1', attributes: ['id', 'ingredientName'] },
        { model: Ingredient, as: 'ingredient2', attributes: ['id', 'ingredientName'] },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.status(200).json(success(conflicts));
  } catch (err: any) {
    console.error('Error getting conflicts:', err);
    return res.status(500).json(error(err.message || 'Failed to get conflicts'));
  }
};

export const getConflictById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conflict = await IngredientConflict.findByPk(id, {
      include: [
        { model: Ingredient, as: 'ingredient1', attributes: ['id', 'ingredientName'] },
        { model: Ingredient, as: 'ingredient2', attributes: ['id', 'ingredientName'] },
      ],
    });

    if (!conflict) {
      return res.status(404).json(error('Conflict not found'));
    }

    return res.status(200).json(success(conflict));
  } catch (err: any) {
    console.error('Error getting conflict:', err);
    return res.status(500).json(error(err.message || 'Failed to get conflict'));
  }
};

export const createConflict = async (req: Request, res: Response) => {
  try {
    const { ingredientId1, ingredientId2, conflictReason, severity } = req.body;

    if (!ingredientId1 || !ingredientId2 || !conflictReason) {
      return res.status(400).json(error('Missing required fields'));
    }

    if (ingredientId1 === ingredientId2) {
      return res.status(400).json(error('Cannot create conflict for same ingredient'));
    }

    const existing = await IngredientConflict.findOne({
      where: {
        [Op.or]: [
          { ingredientId1, ingredientId2 },
          { ingredientId1: ingredientId2, ingredientId2: ingredientId1 },
        ],
      },
    });

    if (existing) {
      return res.status(400).json(error('Conflict already exists'));
    }

    const conflict = await IngredientConflict.create({
      ingredientId1,
      ingredientId2,
      conflictReason,
      severity: severity || 'medium',
    });

    return res.status(201).json(success(conflict));
  } catch (err: any) {
    console.error('Error creating conflict:', err);
    return res.status(500).json(error(err.message || 'Failed to create conflict'));
  }
};

export const updateConflict = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { conflictReason, severity } = req.body;

    const conflict = await IngredientConflict.findByPk(id);
    if (!conflict) {
      return res.status(404).json(error('Conflict not found'));
    }

    await conflict.update({
      ...(conflictReason && { conflictReason }),
      ...(severity && { severity }),
    });

    return res.status(200).json(success(conflict));
  } catch (err: any) {
    console.error('Error updating conflict:', err);
    return res.status(500).json(error(err.message || 'Failed to update conflict'));
  }
};

export const deleteConflict = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conflict = await IngredientConflict.findByPk(id);
    if (!conflict) {
      return res.status(404).json(error('Conflict not found'));
    }

    await conflict.destroy();
    return res.status(200).json(success({ success: true }));
  } catch (err: any) {
    console.error('Error deleting conflict:', err);
    return res.status(500).json(error(err.message || 'Failed to delete conflict'));
  }
};
