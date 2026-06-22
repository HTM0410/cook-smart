export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealPlanStatus = 'active' | 'completed' | 'archived';
export type ConflictSeverity = 'low' | 'medium' | 'high';

export interface MealPlanItemRecipe {
  id: number;
  recipeName: string;
  imageUrl?: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: string;
  ingredients: MealPlanItemIngredient[];
}

export interface MealPlanItemIngredient {
  id: number;
  ingredientName: string;
  quantity: string;
  unit?: string;
}

export interface MealPlanItem {
  id: number;
  mealPlanId: number;
  recipeId: number;
  plannedDate: string;
  mealType: MealType;
  servings: number;
  notes?: string;
  recipe: MealPlanItemRecipe;
}

export interface MealPlan {
  id: number;
  userId: number;
  planName: string;
  startDate: string;
  endDate: string;
  status: MealPlanStatus;
  items: MealPlanItem[];
  conflicts: IngredientConflict[];
  createdAt: string;
  updatedAt: string;
}

export interface IngredientConflict {
  ingredientId1: number;
  ingredientName1: string;
  ingredientId2: number;
  ingredientName2: string;
  conflictReason: string;
  severity: ConflictSeverity;
  affectedRecipes: Array<{
    recipeId: number;
    recipeName: string;
  }>;
}

export interface CreateMealPlanRequest {
  planName: string;
  startDate: string;
  endDate: string;
}

export interface AddRecipeToMealPlanRequest {
  recipeId: number;
  plannedDate: string;
  mealType: MealType;
  servings?: number;
  notes?: string;
}

export interface UpdateMealPlanItemRequest {
  plannedDate?: string;
  mealType?: MealType;
  servings?: number;
  notes?: string;
}

export interface ConflictWarning {
  mealPlanId: number;
  date: string;
  mealType: MealType;
  conflicts: IngredientConflict[];
}

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
  generatedAt: string;
}

export interface WeekDay {
  date: string;
  dayName: string;
  dayOfWeek: number;
  isToday: boolean;
  items: {
    breakfast: MealPlanItem[];
    lunch: MealPlanItem[];
    dinner: MealPlanItem[];
    snack: MealPlanItem[];
  };
}

export interface MealPlanState {
  currentPlan: MealPlan | null;
  plans: MealPlan[];
  loading: boolean;
  error: string | null;
  pendingChanges: boolean;
  conflicts: IngredientConflict[];
}
