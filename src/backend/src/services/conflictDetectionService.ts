import { IngredientConflict, Ingredient, MealPlanItem, RecipeIngredient } from '../models';
import { Op } from 'sequelize';

export interface ConflictInfo {
  ingredientId1: number;
  ingredientName1: string;
  ingredientId2: number;
  ingredientName2: string;
  conflictReason: string;
  severity: 'low' | 'medium' | 'high';
  affectedRecipes: Array<{
    recipeId: number;
    recipeName: string;
  }>;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: ConflictInfo[];
  checkedAt: Date;
}

export class ConflictDetectionService {
  private conflictCache: Map<number, ConflictInfo[]> = new Map();
  private cacheExpiry: number = 60000;

  async checkConflicts(ingredientIds: number[]): Promise<ConflictCheckResult> {
    if (ingredientIds.length < 2) {
      return { hasConflicts: false, conflicts: [], checkedAt: new Date() };
    }

    const startTime = Date.now();

    const conflicts = await IngredientConflict.findAll({
      where: {
        [Op.or]: [
          { ingredientId1: { [Op.in]: ingredientIds } },
          { ingredientId2: { [Op.in]: ingredientIds } },
        ],
      },
      include: [
        { model: Ingredient, as: 'ingredient1', attributes: ['id', 'ingredientName'] },
        { model: Ingredient, as: 'ingredient2', attributes: ['id', 'ingredientName'] },
      ],
    });

    const conflictInfos: ConflictInfo[] = conflicts.map((c: any) => ({
      ingredientId1: c.ingredientId1,
      ingredientName1: c.ingredient1?.ingredientName || '',
      ingredientId2: c.ingredientId2,
      ingredientName2: c.ingredient2?.ingredientName || '',
      conflictReason: c.conflictReason,
      severity: c.severity,
      affectedRecipes: [],
    }));

    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > 1000) {
      console.warn(`[ConflictDetection] Slow query detected: ${elapsedTime}ms`);
    }

    return {
      hasConflicts: conflictInfos.length > 0,
      conflicts: conflictInfos,
      checkedAt: new Date(),
    };
  }

  async getConflictsForMealPlan(mealPlanId: number): Promise<ConflictInfo[]> {
    const cacheKey = mealPlanId;
    const cached = this.conflictCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const items = await MealPlanItem.findAll({
      where: { mealPlanId },
      attributes: ['id', 'recipeId'],
    });

    const allIngredientIds: number[] = [];
    const recipeMap: Map<number, { recipeId: number; ingredientIds: number[] }> = new Map();

    for (const item of items) {
      const recipeIngredients = await RecipeIngredient.findAll({
        where: { recipeId: item.recipeId },
        attributes: ['ingredientId'],
      });

      const ingredientIds = recipeIngredients.map(ri => ri.ingredientId);
      recipeMap.set(item.recipeId, {
        recipeId: item.recipeId,
        ingredientIds,
      });

      allIngredientIds.push(...ingredientIds);
    }

    const uniqueIngredientIds = [...new Set(allIngredientIds)];
    const conflictResult = await this.checkConflicts(uniqueIngredientIds);

    const affectedRecipeMap: Map<string, Array<{ recipeId: number; recipeName: string }>> = new Map();
    for (const conflict of conflictResult.conflicts) {
      affectedRecipeMap.set(`${conflict.ingredientId1}-${conflict.ingredientId2}`, []);
    }

    for (const [recipeId, data] of recipeMap) {
      for (const conflict of conflictResult.conflicts) {
        const hasIngredient1 = data.ingredientIds.includes(conflict.ingredientId1);
        const hasIngredient2 = data.ingredientIds.includes(conflict.ingredientId2);
        if (hasIngredient1 || hasIngredient2) {
          const key = `${conflict.ingredientId1}-${conflict.ingredientId2}`;
          const affected = affectedRecipeMap.get(key) || [];
          if (!affected.find(r => r.recipeId === recipeId)) {
            affected.push({ recipeId, recipeName: '' });
          }
          affectedRecipeMap.set(key, affected);
        }
      }
    }

    const enrichedConflicts = conflictResult.conflicts.map(conflict => {
      const key = `${conflict.ingredientId1}-${conflict.ingredientId2}`;
      const affected = affectedRecipeMap.get(key) || [];
      return { ...conflict, affectedRecipes: affected };
    });

    this.conflictCache.set(cacheKey, enrichedConflicts);

    setTimeout(() => {
      this.conflictCache.delete(cacheKey);
    }, this.cacheExpiry);

    return enrichedConflicts;
  }

  async checkConflictsForMealSlot(
    mealPlanId: number,
    plannedDate: string,
    mealType: string
  ): Promise<ConflictCheckResult> {
    const items = await MealPlanItem.findAll({
      where: { mealPlanId, plannedDate, mealType },
    });

    if (items.length < 2) {
      return { hasConflicts: false, conflicts: [], checkedAt: new Date() };
    }

    const ingredientIds: number[] = [];
    for (const item of items) {
      const recipeIngredients = await RecipeIngredient.findAll({
        where: { recipeId: item.recipeId },
        attributes: ['ingredientId'],
      });
      ingredientIds.push(...recipeIngredients.map(ri => ri.ingredientId));
    }

    const uniqueIngredientIds = [...new Set(ingredientIds)];
    return await this.checkConflicts(uniqueIngredientIds);
  }

  async checkRecipeAdditionConflicts(
    mealPlanId: number,
    plannedDate: string,
    mealType: string,
    newRecipeId: number
  ): Promise<ConflictCheckResult> {
    const existingItems = await MealPlanItem.findAll({
      where: { mealPlanId, plannedDate, mealType },
    });

    const ingredientIds: number[] = [];

    for (const item of existingItems) {
      const recipeIngredients = await RecipeIngredient.findAll({
        where: { recipeId: item.recipeId },
        attributes: ['ingredientId'],
      });
      ingredientIds.push(...recipeIngredients.map(ri => ri.ingredientId));
    }

    const newRecipeIngredients = await RecipeIngredient.findAll({
      where: { recipeId: newRecipeId },
      attributes: ['ingredientId'],
    });
    ingredientIds.push(...newRecipeIngredients.map(ri => ri.ingredientId));

    const uniqueIngredientIds = [...new Set(ingredientIds)];
    return await this.checkConflicts(uniqueIngredientIds);
  }

  invalidateCache(mealPlanId: number): void {
    this.conflictCache.delete(mealPlanId);
  }
}

export default new ConflictDetectionService();
