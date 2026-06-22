// Recipe types for frontend
export interface Recipe {
  id: number;
  recipeName: string;
  description?: string;
  imageUrl?: string;
  prepTime: number; // minutes
  cookTime: number; // minutes
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  status: 'visible' | 'hidden';
  createdAt: string;
  updatedAt: string;
  averageRating?: number;
  reviewCount?: number;
  ingredients?: RecipeIngredient[];
  steps?: RecipeStep[];
  categories?: RecipeCategory[];
  matchMetadata?: {
    matchedIngredientsCount: number;
    totalIngredientsCount: number;
    matchPercentage: number;
    fuzzyScore: number;
    weightedScore: number;
    matchedIngredients: Array<{
      id: number;
      quantity: string;
      unit?: string;
      score: number;
    }>;
  };
}

export interface RecipeCategory {
  id: number;
  categoryName: string;
  categoryType: 'cuisine' | 'course' | 'tag';
  description?: string;
}

export interface RecipeIngredient {
  id: number;
  ingredientName: string;
  description?: string;
  RecipeIngredient?: {
    quantity: number | string;
    unit: string;
  };
  // For backward compatibility with nested structure
  ingredient?: {
    id: number;
    ingredientName: string;
    description?: string;
  };
  quantity?: number | string;
  unit?: string;
}

export interface RecipeStep {
  id: number;
  stepNumber: number;
  instruction: string;
  imageUrl?: string;
}

export interface Ingredient {
  id: number;
  ingredientName: string;
  description?: string;
  category?: {
    id: number;
    categoryName: string;
  };
}

export interface IngredientCategory {
  id: number;
  categoryName: string;
}

// API Response types
export interface RecipeResponse {
  success: boolean;
  message: string;
  data: Recipe | { recipe: Recipe; cached?: boolean };
}

export interface RecipesResponse {
  success: boolean;
  message: string;
  data: {
    recipes: Recipe[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  };
}

// Search types
export interface SearchRecipesRequest {
  ingredients: string[];
  excludeIngredients?: string[];  // Nguyên liệu cần loại trừ
  difficulty?: string[];
  prepTimeMax?: number;
  cookTimeMax?: number;
  servingsMin?: number;
  servingsMax?: number;
  minMatchPercentage?: number;
  cuisine?: string;
  course?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface IngredientMatchRecipe {
  id: number;
  recipeName: string;
  description: string;
  imageUrl?: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  matchedCount: number;
  totalIngredients: number;
  matchPercent: number;
  averageRating: number;
  reviewCount: number;
  createdAt?: string;
}

export interface SearchRecipesResponse {
  success: boolean;
  message: string;
  data: {
    recipes: IngredientMatchRecipe[];
    suggestions?: Recipe[];
    searchTerms: string[];
    matchedIngredients: Array<{ id: number; name: string }>;
    missingIngredients: string[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface KeywordSearchResponse {
  success: boolean;
  message: string;
  data: {
    recipes: Recipe[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    filtersApplied: Record<string, unknown>;
  };
}

export interface AutocompleteResponse {
  success: boolean;
  message: string;
  data: {
    query: string;
    suggestions: Array<{
      id: number;
      name: string;
      category: string;
      score: number;
    }>;
  };
}
