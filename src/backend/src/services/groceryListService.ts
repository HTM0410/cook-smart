import { MealPlan, MealPlanItem, Recipe, RecipeIngredient, Ingredient, IngredientCategory } from '../models';

export interface GroceryItem {
  ingredientId: number;
  ingredientName: string;
  categoryId: number;
  categoryName: string;
  totalQuantity: string;
  unit: string;
  recipes: string[];
}

export interface GroceryList {
  mealPlanId: number;
  mealPlanName: string;
  items: GroceryItem[];
  generatedAt: Date;
}

export class GroceryListService {
  async generateGroceryList(mealPlanId: number, userId: number): Promise<GroceryList> {
    const mealPlan = await MealPlan.findOne({
      where: { id: mealPlanId, userId },
    });

    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }

    const items = await MealPlanItem.findAll({
      where: { mealPlanId },
      include: [
        {
          model: Recipe,
          as: 'recipe',
        },
      ],
    });

    const ingredientMap: Map<number, GroceryItem> = new Map();

    for (const item of items) {
      const recipeIngredients = await RecipeIngredient.findAll({
        where: { recipeId: item.recipeId },
        include: [
          {
            model: Ingredient,
            as: 'ingredient',
            include: [
              {
                model: IngredientCategory,
                as: 'category',
              },
            ],
          },
        ],
      });

      for (const ri of recipeIngredients) {
        const ing = (ri as any).ingredient;
        const category = ing?.category;

        if (!ing) continue;

        const quantityMultiplier = item.servings / (item as any).recipe?.servings || 1;
        let adjustedQuantity = ri.quantity;

        try {
          const numQty = parseFloat(ri.quantity);
          if (!isNaN(numQty)) {
            adjustedQuantity = (numQty * quantityMultiplier).toFixed(2).replace(/\.00$/, '');
          }
        } catch (e) {
        }

        const key = ing.id;
        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!;
          const existingQty = parseFloat(existing.totalQuantity) || 0;
          const newQty = parseFloat(adjustedQuantity) || 0;
          existing.totalQuantity = (existingQty + newQty).toString();
          if (!existing.recipes.includes((item as any).recipe?.recipeName)) {
            existing.recipes.push((item as any).recipe?.recipeName);
          }
        } else {
          ingredientMap.set(key, {
            ingredientId: ing.id,
            ingredientName: ing.ingredientName,
            categoryId: category?.id || 0,
            categoryName: category?.categoryName || 'Khác',
            totalQuantity: adjustedQuantity,
            unit: ri.unit || '',
            recipes: [(item as any).recipe?.recipeName],
          });
        }
      }
    }

    const sortedItems = Array.from(ingredientMap.values()).sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName)
    );

    return {
      mealPlanId,
      mealPlanName: mealPlan.planName,
      items: sortedItems,
      generatedAt: new Date(),
    };
  }

  async generateGroceryListByDateRange(
    mealPlanId: number,
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<GroceryList> {
    const mealPlan = await MealPlan.findOne({
      where: { id: mealPlanId, userId },
    });

    if (!mealPlan) {
      throw new Error('Meal plan not found');
    }

    const items = await MealPlanItem.findAll({
      where: {
        mealPlanId,
        plannedDate: {
          [Symbol.for('between')]: [startDate, endDate],
        },
      },
      include: [
        {
          model: Recipe,
          as: 'recipe',
        },
      ],
    });

    const ingredientMap: Map<number, GroceryItem> = new Map();

    for (const item of items) {
      const recipeIngredients = await RecipeIngredient.findAll({
        where: { recipeId: item.recipeId },
        include: [
          {
            model: Ingredient,
            as: 'ingredient',
            include: [
              {
                model: IngredientCategory,
                as: 'category',
              },
            ],
          },
        ],
      });

      for (const ri of recipeIngredients) {
        const ing = (ri as any).ingredient;
        const category = ing?.category;

        if (!ing) continue;

        const quantityMultiplier = item.servings / (item as any).recipe?.servings || 1;
        let adjustedQuantity = ri.quantity;

        try {
          const numQty = parseFloat(ri.quantity);
          if (!isNaN(numQty)) {
            adjustedQuantity = (numQty * quantityMultiplier).toFixed(2).replace(/\.00$/, '');
          }
        } catch (e) {
        }

        const key = ing.id;
        if (ingredientMap.has(key)) {
          const existing = ingredientMap.get(key)!;
          const existingQty = parseFloat(existing.totalQuantity) || 0;
          const newQty = parseFloat(adjustedQuantity) || 0;
          existing.totalQuantity = (existingQty + newQty).toString();
          if (!existing.recipes.includes((item as any).recipe?.recipeName)) {
            existing.recipes.push((item as any).recipe?.recipeName);
          }
        } else {
          ingredientMap.set(key, {
            ingredientId: ing.id,
            ingredientName: ing.ingredientName,
            categoryId: category?.id || 0,
            categoryName: category?.categoryName || 'Khác',
            totalQuantity: adjustedQuantity,
            unit: ri.unit || '',
            recipes: [(item as any).recipe?.recipeName],
          });
        }
      }
    }

    const sortedItems = Array.from(ingredientMap.values()).sort((a, b) =>
      a.categoryName.localeCompare(b.categoryName)
    );

    return {
      mealPlanId,
      mealPlanName: `${mealPlan.planName} (${startDate} - ${endDate})`,
      items: sortedItems,
      generatedAt: new Date(),
    };
  }
}

export default new GroceryListService();
