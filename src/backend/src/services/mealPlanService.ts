import { Op } from 'sequelize';
import { MealPlan, MealPlanItem, Recipe, RecipeIngredient, Ingredient } from '../models';
import { ConflictDetectionService } from './conflictDetectionService';

export interface CreateMealPlanDTO {
  planName: string;
  startDate: string;
  endDate: string;
}

export interface AddRecipeToMealPlanDTO {
  recipeId: number;
  plannedDate: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings?: number;
  notes?: string;
}

export interface UpdateMealPlanItemDTO {
  plannedDate?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings?: number;
  notes?: string;
}

export interface MealPlanWithItems {
  id: number;
  userId: number;
  planName: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'archived';
  items: MealPlanItemWithRecipe[];
  conflicts: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MealPlanItemWithRecipe {
  id: number;
  mealPlanId: number;
  recipeId: number;
  plannedDate: string;
  mealType: string;
  servings: number;
  notes?: string;
  recipe: {
    id: number;
    recipeName: string;
    imageUrl?: string;
    prepTime: number;
    cookTime: number;
    servings: number;
    difficulty: string;
    ingredients: Array<{
      id: number;
      ingredientName: string;
      quantity: string;
      unit?: string;
    }>;
  };
}

export class MealPlanService {
  private conflictDetectionService: ConflictDetectionService;

  constructor() {
    this.conflictDetectionService = new ConflictDetectionService();
  }

  async createMealPlan(userId: number, data: CreateMealPlanDTO): Promise<MealPlan> {
    const mealPlan = await MealPlan.create({
      userId,
      planName: data.planName,
      startDate: data.startDate,
      endDate: data.endDate,
      status: 'active',
    });
    return mealPlan;
  }

  async getMealPlans(userId: number): Promise<MealPlan[]> {
    return await MealPlan.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: MealPlanItem,
          as: 'items',
          include: [
            {
              model: Recipe,
              as: 'recipe',
              attributes: ['id', 'recipeName', 'imageUrl', 'prepTime', 'cookTime', 'servings', 'difficulty'],
            },
          ],
        },
      ],
    });
  }

  async getMealPlanById(id: number, userId: number): Promise<MealPlanWithItems | null> {
    const mealPlan = await MealPlan.findOne({
      where: { id, userId },
      include: [
        {
          model: MealPlanItem,
          as: 'items',
          include: [
            {
              model: Recipe,
              as: 'recipe',
              attributes: ['id', 'recipeName', 'imageUrl', 'prepTime', 'cookTime', 'servings', 'difficulty'],
              include: [
                {
                  model: Ingredient,
                  as: 'ingredients',
                  through: {
                    attributes: ['quantity', 'unit'],
                  },
                  attributes: ['id', 'ingredientName'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!mealPlan) return null;

    const conflicts = await this.conflictDetectionService.getConflictsForMealPlan(id);

    const items: MealPlanItemWithRecipe[] = (mealPlan as any).items.map((item: any) => ({
      id: item.id,
      mealPlanId: item.mealPlanId,
      recipeId: item.recipeId,
      plannedDate: item.plannedDate,
      mealType: item.mealType,
      servings: item.servings,
      notes: item.notes,
      recipe: {
        id: item.recipe.id,
        recipeName: item.recipe.recipeName,
        imageUrl: item.recipe.imageUrl,
        prepTime: item.recipe.prepTime,
        cookTime: item.recipe.cookTime,
        servings: item.recipe.servings,
        difficulty: item.recipe.difficulty,
        ingredients: item.recipe.ingredients?.map((ing: any) => ({
          id: ing.id,
          ingredientName: ing.ingredientName,
          quantity: ing.RecipeIngredient?.quantity,
          unit: ing.RecipeIngredient?.unit,
        })) || [],
      },
    }));

    return {
      id: mealPlan.id,
      userId: mealPlan.userId,
      planName: mealPlan.planName,
      startDate: mealPlan.startDate,
      endDate: mealPlan.endDate,
      status: mealPlan.status,
      items,
      conflicts,
      createdAt: mealPlan.createdAt,
      updatedAt: mealPlan.updatedAt,
    };
  }

  async addRecipeToMealPlan(
    mealPlanId: number,
    userId: number,
    data: AddRecipeToMealPlanDTO
  ): Promise<{ item: MealPlanItem; conflicts: any[] }> {
    const mealPlan = await MealPlan.findOne({ where: { id: mealPlanId, userId } });
    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }

    const item = await MealPlanItem.create({
      mealPlanId,
      recipeId: data.recipeId,
      plannedDate: data.plannedDate,
      mealType: data.mealType,
      servings: data.servings || 2,
      notes: data.notes,
    });

    const conflicts = await this.conflictDetectionService.getConflictsForMealPlan(mealPlanId);

    return { item, conflicts };
  }

  async removeRecipeFromMealPlan(itemId: number, userId: number): Promise<boolean> {
    const item = await MealPlanItem.findOne({
      where: { id: itemId },
      include: [
        {
          model: MealPlan,
          as: 'mealPlan',
          where: { userId },
        },
      ],
    });

    if (!item) {
      throw new Error('Meal plan item not found');
    }

    await item.destroy();
    return true;
  }

  async updateMealPlanItem(
    itemId: number,
    userId: number,
    data: UpdateMealPlanItemDTO
  ): Promise<{ item: MealPlanItem; conflicts: any[] }> {
    const item = await MealPlanItem.findOne({
      where: { id: itemId },
      include: [
        {
          model: MealPlan,
          as: 'mealPlan',
          where: { userId },
        },
      ],
    });

    if (!item) {
      throw new Error('Meal plan item not found');
    }

    await item.update(data);

    const conflicts = await this.conflictDetectionService.getConflictsForMealPlan(item.mealPlanId);

    return { item, conflicts };
  }

  async deleteMealPlan(id: number, userId: number): Promise<boolean> {
    const mealPlan = await MealPlan.findOne({ where: { id, userId } });
    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }

    await MealPlanItem.destroy({ where: { mealPlanId: id } });
    await mealPlan.destroy();
    return true;
  }

  async updateMealPlanStatus(id: number, userId: number, status: 'active' | 'completed' | 'archived'): Promise<MealPlan> {
    const mealPlan = await MealPlan.findOne({ where: { id, userId } });
    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }

    await mealPlan.update({ status });
    return mealPlan;
  }
}

export default new MealPlanService();
