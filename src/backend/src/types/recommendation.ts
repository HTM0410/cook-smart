/**
 * Recommendation System Types
 * Định nghĩa các interface và type cho hệ thống gợi ý
 */

// ============================================
// Interaction Types
// ============================================

export type InteractionType = 'view' | 'favorite' | 'rating';

export interface Interaction {
  userId: number;
  recipeId: number;
  type: InteractionType;
  value: number;
  timestamp: Date;
}

export interface UserInteractionSummary {
  userId: number;
  recipeId: number;
  viewScore: number;
  favoriteScore: number;
  ratingScore: number;
  totalScore: number;
  lastInteraction: Date | null;
}

// ============================================
// Embedding Types
// ============================================

export interface EmbeddingVector {
  id: number;
  recipeId: number;
  vector: number[];
  textContent: string;
}

export interface SimilarityResult {
  recipeId: number;
  score: number;
}

// ============================================
// Recommendation Types
// ============================================

export interface RecommendationScore {
  recipeId: number;
  contentScore: number;
  collaborativeScore: number;
  popularityScore: number;
  finalScore: number;
  breakdown?: {
    weights: HybridWeights;
    signals: {
      views: number;
      favorites: number;
      ratings: number;
      similarity: number;
    };
  };
}

export interface RecommendedRecipe {
  id: number;
  recipeName: string;
  description: string | null;
  imageUrl: string | null;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  averageRating: number;
  reviewCount: number;
  totalViews: number;
  totalFavorites: number;
  categories: RecipeCategoryInfo[];
  score: RecommendationScore;
  reason: RecommendationReason;
}

export interface RecipeCategoryInfo {
  id: number;
  categoryName: string;
  categoryType: 'cuisine' | 'course' | 'tag';
}

export type RecommendationReason = 
  | 'personalized'
  | 'similar_to_favorites'
  | 'similar_to_history'
  | 'popular'
  | 'trending'
  | 'new_recipe'
  | 'cold_start_fallback';

// ============================================
// Hybrid Weights
// ============================================

export interface HybridWeights {
  content: number;
  collaborative: number;
  popularity: number;
}

export const DEFAULT_HYBRID_WEIGHTS: HybridWeights = {
  content: 0.35,
  collaborative: 0.40,
  popularity: 0.25,
};

export const COLD_START_WEIGHTS: HybridWeights = {
  content: 0.50,
  collaborative: 0.00,
  popularity: 0.50,
};

// ============================================
// Interaction Weights
// ============================================

export const INTERACTION_WEIGHTS = {
  view: 0.25,
  favorite: 4.0,
  rating: 1, // Will be scaled 1-5 based on actual rating
} as const;

// ============================================
// User Profile Types
// ============================================

export interface UserProfile {
  userId: number;
  interactionCount: number;
  favoriteCount: number;
  ratingCount: number;
  avgRatingGiven: number;
  viewedRecipeIds: number[];
  favoritedRecipeIds: number[];
  ratedRecipeIds: number[];
  isColdStart: boolean;
}

export interface UserPreferenceProfile {
  preferredCategories: string[];
  preferredDifficulties: ('easy' | 'medium' | 'hard')[];
  preferredIngredients: string[];
  avgPrepTime: number;
  avgCookTime: number;
}

// ============================================
// Matrix Types (for Collaborative Filtering)
// ============================================

export interface InteractionMatrix {
  users: Map<number, number>; // userId -> row index
  recipes: Map<number, number>; // recipeId -> col index
  matrix: number[][];
  sparseIndices: Set<string>; // "row,col" for non-zero entries
}

export interface SVDFactors {
  userFactors: number[][]; // [userId][k]
  recipeFactors: number[][]; // [recipeId][k]
  singularValues: number[];
}

export interface PredictedRating {
  userId: number;
  recipeId: number;
  predictedScore: number;
  confidence: number;
}

// ============================================
// Popularity Types
// ============================================

export interface RecipePopularity {
  recipeId: number;
  recipeName: string;
  totalViews: number;
  totalFavorites: number;
  avgRating: number;
  ratingCount: number;
  popularityScore: number;
  rank?: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface GetRecommendationsRequest {
  userId: number;
  limit?: number;
  offset?: number;
  excludeRecipeIds?: number[];
  categoryFilter?: string;
  difficultyFilter?: ('easy' | 'medium' | 'hard')[];
  maxPrepTime?: number;
  includeReason?: boolean;
}

export interface GetPopularRecipesRequest {
  limit?: number;
  period?: 'day' | 'week' | 'month' | 'all';
  categoryFilter?: string;
}

export interface GetSimilarRecipesRequest {
  recipeId: number;
  limit?: number;
  excludeRecipeIds?: number[];
}

export interface RecordViewRequest {
  userId: number;
  recipeId: number;
}

export interface RecommendationsResponse {
  recipes: RecommendedRecipe[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
  metadata?: {
    generatedAt: string;
    algorithm: string;
    weightsUsed: HybridWeights;
    userProfile?: {
      interactionCount: number;
      isColdStart: boolean;
    };
  };
}

// ============================================
// Caching Types
// ============================================

export interface CachedRecommendation {
  recipeId: number;
  score: number;
  cachedAt: Date;
}

export interface CacheConfig {
  userRecommendationsTTL: number; // seconds
  popularRecipesTTL: number;
  similarRecipesTTL: number;
  interactionMatrixTTL: number;
}

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  userRecommendationsTTL: 5 * 60, // 5 minutes
  popularRecipesTTL: 10 * 60, // 10 minutes
  similarRecipesTTL: 30 * 60, // 30 minutes
  interactionMatrixTTL: 60 * 60, // 1 hour
};
