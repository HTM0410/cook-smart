/**
 * Search Re-ranking Service
 * Kết hợp kết quả tìm kiếm với recommendation scores để personalize kết quả
 */

import { contentBasedService } from './contentBasedService';
import { collaborativeFilteringService } from './collaborativeFilteringService';
import { popularityService } from './popularityService';
import {
  HybridWeights,
  DEFAULT_HYBRID_WEIGHTS,
  COLD_START_WEIGHTS,
} from '../../types/recommendation';

export interface SearchResultItem {
  id: number;
  recipeName: string;
  description?: string | null;
  imageUrl?: string | null;
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  averageRating?: number;
  reviewCount?: number;
  createdAt?: Date | string;
  // Search-specific metadata
  matchMetadata?: {
    matchedIngredientsCount?: number;
    totalIngredientsCount?: number;
    matchPercentage?: number;
    weightedScore?: number;
  };
  // Original search score (relevance)
  searchScore?: number;
}

export interface ReRankedSearchResult {
  recipes: SearchResultItem[];
  metadata: {
    reranked: boolean;
    userId?: number;
    weights: HybridWeights;
    scoreBreakdown?: {
      recipeId: number;
      searchScore: number;
      recommendationScore: number;
      finalScore: number;
    }[];
  };
}

interface ReRankOptions {
  userId?: number;
  searchWeight?: number; // Weight for search relevance (default 0.6)
  recommendationWeight?: number; // Weight for recommendation (default 0.4)
  limit?: number;
}

class SearchRerankService {
  private readonly DEFAULT_LIMIT = 12;
  private readonly MAX_LIMIT = 50;

  /**
   * Re-rank search results với recommendation scores
   */
  async rerankSearchResults(
    searchResults: SearchResultItem[],
    options: ReRankOptions
  ): Promise<ReRankedSearchResult> {
    const {
      userId,
      searchWeight = 0.6,
      recommendationWeight = 0.4,
      limit = this.DEFAULT_LIMIT,
    } = options;

    // Nếu không có userId hoặc không có kết quả, trả về nguyên kết quả tìm kiếm
    if (!userId || searchResults.length === 0) {
      return {
        recipes: searchResults.slice(0, limit),
        metadata: {
          reranked: false,
          weights: { content: 0, collaborative: 0, popularity: 0 },
        },
      };
    }

    const effectiveLimit = Math.min(limit, this.MAX_LIMIT);
    const recipeIds = searchResults.map(r => r.id);

    // 1. Lấy user profile để xác định cold-start status
    const userProfile = await collaborativeFilteringService.getUserProfile(userId);
    const isColdStart = userProfile.isColdStart;

    // 2. Xác định hybrid weights dựa trên user profile
    const weights = isColdStart ? COLD_START_WEIGHTS : DEFAULT_HYBRID_WEIGHTS;

    // 3. Tính recommendation scores cho các recipes trong kết quả tìm kiếm
    const [contentScores, collabScores, popularityScores] = await Promise.all([
      weights.content === 0
        ? new Map<number, number>()
        : contentBasedService.scoreRecipesForUser(recipeIds, userId),
      weights.collaborative === 0
        ? new Map<number, number>()
        : collaborativeFilteringService.scoreRecipesForUser(userId, recipeIds, 20),
      popularityService.getPopularityScores(recipeIds),
    ]);

    // 4. Normalize scores
    const normalizedPopularity = popularityService.normalizeScores(popularityScores);

    // 5. Tính combined recommendation score cho mỗi recipe
    const maxContent = Math.max(...Array.from(contentScores.values()), 0.001);
    const maxCollab = Math.max(...Array.from(collabScores.values()), 0.001);
    const maxPopularity = Math.max(...Array.from(normalizedPopularity.values()), 0.001);

    const scoreBreakdown: ReRankedSearchResult['metadata']['scoreBreakdown'] = [];

    // 6. Tính final score = searchWeight * searchRelevance + recommendationWeight * recommendationScore
    const rerankedResults = searchResults.map(recipe => {
      const recipeId = recipe.id;

      // Search score (đã có trong matchMetadata.weightedScore hoặc matchPercentage)
      const baseSearchScore = recipe.matchMetadata?.weightedScore 
        ?? (recipe.matchMetadata?.matchPercentage ?? 50) / 100;
      const normalizedSearchScore = Math.min(1, baseSearchScore);

      // Recommendation score từ hybrid signals
      const contentScore = (contentScores.get(recipeId) || 0) / maxContent;
      const collabScore = (collabScores.get(recipeId) || 0) / maxCollab;
      const popularityScore = (normalizedPopularity.get(recipeId) || 0) / maxPopularity;

      const recommendationScore =
        weights.content * contentScore +
        weights.collaborative * collabScore +
        weights.popularity * popularityScore;

      // Final score kết hợp search + recommendation
      const finalScore = searchWeight * normalizedSearchScore + recommendationWeight * recommendationScore;

      scoreBreakdown.push({
        recipeId,
        searchScore: normalizedSearchScore,
        recommendationScore,
        finalScore,
      });

      return {
        ...recipe,
        searchScore: normalizedSearchScore,
        _recommendationScore: recommendationScore,
        _finalScore: finalScore,
      };
    });

    // 7. Sort theo final score
    rerankedResults.sort((a, b) => (b._finalScore || 0) - (a._finalScore || 0));

    // 8. Trả về top N results (loại bỏ internal fields)
    const topResults = rerankedResults.slice(0, effectiveLimit).map(recipe => {
      const { _recommendationScore, _finalScore, ...cleanRecipe } = recipe;
      return cleanRecipe as SearchResultItem;
    });

    return {
      recipes: topResults,
      metadata: {
        reranked: true,
        userId,
        weights,
        scoreBreakdown: scoreBreakdown.slice(0, effectiveLimit),
      },
    };
  }

  /**
   * Thêm personalized boost vào search results mà không thay đổi thứ tự quá nhiều
   * Chỉ nudge các recipes lên/xuống một chút dựa trên user preferences
   */
  async personalizeSearchResults(
    searchResults: SearchResultItem[],
    userId: number,
    limit: number = 12
  ): Promise<ReRankedSearchResult> {
    return this.rerankSearchResults(searchResults, {
      userId,
      searchWeight: 0.85, // Giữ search relevance là chủ đạo
      recommendationWeight: 0.15, // Chỉ nudge nhẹ
      limit,
    });
  }
}

export const searchRerankService = new SearchRerankService();
export default searchRerankService;
