import { Request, Response } from 'express';
import { success, error } from '../utils/response';
import mealPlanService, { CreateMealPlanDTO, AddRecipeToMealPlanDTO, UpdateMealPlanItemDTO } from '../services/mealPlanService';
import groceryListService from '../services/groceryListService';
import { authenticateUser } from '../middleware/auth';

export const createMealPlan = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const data: CreateMealPlanDTO = req.body;
    const mealPlan = await mealPlanService.createMealPlan(userId, data);
    return res.status(201).json(success(mealPlan));
  } catch (err: any) {
    console.error('Error creating meal plan:', err);
    const status = err?.statusCode || 500;
    return res.status(status).json(error(err.message || 'Failed to create meal plan'));
  }
};

export const getMealPlans = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const mealPlans = await mealPlanService.getMealPlans(userId);
    return res.status(200).json(success(mealPlans));
  } catch (err: any) {
    console.error('Error getting meal plans:', err);
    return res.status(500).json(error(err.message || 'Failed to get meal plans'));
  }
};

export const getMealPlanById = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const { id } = req.params;
    const mealPlan = await mealPlanService.getMealPlanById(parseInt(id), userId);

    if (!mealPlan) {
      return res.status(404).json(error('Meal plan not found'));
    }

    return res.status(200).json(success(mealPlan));
  } catch (err: any) {
    console.error('Error getting meal plan:', err);
    return res.status(500).json(error(err.message || 'Failed to get meal plan'));
  }
};

export const addRecipeToMealPlan = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const { id } = req.params;
    const data: AddRecipeToMealPlanDTO = req.body;

    const result = await mealPlanService.addRecipeToMealPlan(
      parseInt(id),
      userId,
      data
    );

    return res.status(201).json(success({
      item: result.item,
      conflicts: result.conflicts,
    }));
  } catch (err: any) {
    console.error('Error adding recipe to meal plan:', err);
    return res.status(500).json(error(err.message || 'Failed to add recipe'));
  }
};

export const removeRecipeFromMealPlan = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const { id, itemId } = req.params;
    await mealPlanService.removeRecipeFromMealPlan(parseInt(itemId), userId);

    const conflicts = await mealPlanService.getMealPlanById(parseInt(id), userId);

    return res.status(200).json(success({
      success: true,
      conflicts: conflicts?.conflicts || [],
    }));
  } catch (err: any) {
    console.error('Error removing recipe from meal plan:', err);
    return res.status(500).json(error(err.message || 'Failed to remove recipe'));
  }
};

export const updateMealPlanItem = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const { id, itemId } = req.params;
    const data: UpdateMealPlanItemDTO = req.body;

    const result = await mealPlanService.updateMealPlanItem(
      parseInt(itemId),
      userId,
      data
    );

    return res.status(200).json(success({
      item: result.item,
      conflicts: result.conflicts,
    }));
  } catch (err: any) {
    console.error('Error updating meal plan item:', err);
    return res.status(500).json(error(err.message || 'Failed to update meal plan item'));
  }
};

export const deleteMealPlan = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const { id } = req.params;
    await mealPlanService.deleteMealPlan(parseInt(id), userId);

    return res.status(200).json(success({ success: true }));
  } catch (err: any) {
    console.error('Error deleting meal plan:', err);
    return res.status(500).json(error(err.message || 'Failed to delete meal plan'));
  }
};

export const updateMealPlanStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'completed', 'archived'].includes(status)) {
      return res.status(400).json(error('Invalid status'));
    }

    const mealPlan = await mealPlanService.updateMealPlanStatus(
      parseInt(id),
      userId,
      status
    );

    return res.status(200).json(success(mealPlan));
  } catch (err: any) {
    console.error('Error updating meal plan status:', err);
    return res.status(500).json(error(err.message || 'Failed to update status'));
  }
};

export const getGroceryList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json(error('Unauthorized'));
    }

    const { id } = req.params;
    const { startDate, endDate } = req.query;

    let groceryList;
    if (startDate && endDate) {
      groceryList = await groceryListService.generateGroceryListByDateRange(
        parseInt(id),
        userId,
        startDate as string,
        endDate as string
      );
    } else {
      groceryList = await groceryListService.generateGroceryList(parseInt(id), userId);
    }

    return res.status(200).json(success(groceryList));
  } catch (err: any) {
    console.error('Error generating grocery list:', err);
    return res.status(500).json(error(err.message || 'Failed to generate grocery list'));
  }
};
