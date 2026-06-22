/**
 * Weighted Scoring Service for Recipe Search Results
 * Tính điểm tổng hợp dựa trên nhiều tiêu chí
 */

interface ScoringWeights {
  ingredientMatch: number; // Trọng số cho độ khớp nguyên liệu
  fuzzyMatch: number; // Trọng số cho fuzzy match score
  recipePopularity: number; // Trọng số cho độ phổ biến (favorites count)
  recipeRating: number; // Trọng số cho rating
  recipeRecency: number; // Trọng số cho độ mới của recipe
  difficulty: number; // Trọng số cho độ khó
}

interface RecipeScoreInput {
  // Ingredient matching
  matchedIngredientsCount: number;
  totalIngredientsCount: number;
  searchTermsCount: number;
  fuzzyMatchScore: number;

  // Recipe popularity (will be implemented later with UserFavorite)
  favoritesCount?: number;
  viewCount?: number;

  // Recipe rating (will be implemented later with RecipeReview)
  averageRating?: number;
  reviewCount?: number;

  // Recipe metadata
  createdAt: Date;
  difficulty: 'easy' | 'medium' | 'hard';
}

class ScoringService {
  // Default weights (tổng = 1.0)
  private defaultWeights: ScoringWeights = {
    ingredientMatch: 0.4, // 40% - Quan trọng nhất
    fuzzyMatch: 0.25, // 25% - Độ chính xác của match
    recipePopularity: 0.15, // 15% - Độ phổ biến
    recipeRating: 0.10, // 10% - Đánh giá
    recipeRecency: 0.05, // 5% - Độ mới
    difficulty: 0.05, // 5% - Độ khó (ưu tiên easy)
  };

  /**
   * Calculate weighted score for a recipe
   * @param input - Recipe data for scoring
   * @param customWeights - Optional custom weights
   * @returns Normalized score (0-100)
   */
  calculateScore(
    input: RecipeScoreInput,
    customWeights?: Partial<ScoringWeights>
  ): number {
    const weights = { ...this.defaultWeights, ...customWeights };

    // 1. Ingredient Match Score (0-100)
    const ingredientMatchScore = this.calculateIngredientMatchScore(
      input.matchedIngredientsCount,
      input.totalIngredientsCount,
      input.searchTermsCount
    );

    // 2. Fuzzy Match Score (0-100)
    const fuzzyScore = this.normalizeFuzzyScore(input.fuzzyMatchScore);

    // 3. Popularity Score (0-100)
    const popularityScore = this.calculatePopularityScore(
      input.favoritesCount || 0,
      input.viewCount || 0
    );

    // 4. Rating Score (0-100)
    const ratingScore = this.calculateRatingScore(
      input.averageRating || 0,
      input.reviewCount || 0
    );

    // 5. Recency Score (0-100)
    const recencyScore = this.calculateRecencyScore(input.createdAt);

    // 6. Difficulty Score (0-100)
    const difficultyScore = this.calculateDifficultyScore(input.difficulty);

    // Calculate weighted total
    const totalScore =
      ingredientMatchScore * weights.ingredientMatch +
      fuzzyScore * weights.fuzzyMatch +
      popularityScore * weights.recipePopularity +
      ratingScore * weights.recipeRating +
      recencyScore * weights.recipeRecency +
      difficultyScore * weights.difficulty;

    return Math.round(totalScore * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate ingredient match score
   * Higher score for more matches and better coverage
   */
  private calculateIngredientMatchScore(
    matchedCount: number,
    totalCount: number,
    searchTermsCount: number
  ): number {
    if (totalCount === 0 || searchTermsCount === 0) return 0;

    // Match percentage (what % of recipe ingredients matched)
    const matchPercentage = (matchedCount / totalCount) * 100;

    // Search coverage (what % of search terms found ingredients)
    const searchCoverage = (matchedCount / searchTermsCount) * 100;

    // Bonus for exact match (all searched ingredients present)
    const exactMatchBonus = matchedCount >= searchTermsCount ? 10 : 0;

    // Weighted average + bonus
    const score = matchPercentage * 0.6 + searchCoverage * 0.4 + exactMatchBonus;

    return Math.min(score, 100);
  }

  /**
   * Normalize fuzzy match score to 0-100
   * Fuse.js score is typically 0-10, lower is better
   */
  private normalizeFuzzyScore(fuzzyScore: number): number {
    // Assuming max fuzzy score is 50 (based on our algorithm)
    // Invert and normalize: higher fuzzy score (better match) = higher normalized score
    const normalized = (fuzzyScore / 50) * 100;
    return Math.min(normalized, 100);
  }

  /**
   * Calculate popularity score based on favorites and views
   */
  private calculatePopularityScore(favoritesCount: number, viewCount: number): number {
    if (favoritesCount === 0 && viewCount === 0) return 0;

    // Logarithmic scaling to avoid huge differences
    const favoriteScore = Math.log10(favoritesCount + 1) * 20;
    const viewScore = Math.log10(viewCount + 1) * 10;

    const score = favoriteScore * 0.7 + viewScore * 0.3;

    return Math.min(score, 100);
  }

  /**
   * Calculate rating score
   * Consider both average rating and number of reviews (Bayesian average)
   */
  private calculateRatingScore(averageRating: number, reviewCount: number): number {
    if (averageRating === 0) return 0;

    // Bayesian average: blend with global average
    const globalAverage = 3.5; // Assume 3.5/5 as baseline
    const minReviews = 5; // Minimum reviews for full weight

    const confidence = Math.min(reviewCount / minReviews, 1);
    const bayesianRating = averageRating * confidence + globalAverage * (1 - confidence);

    // Normalize to 0-100 (assuming 5-star rating)
    return (bayesianRating / 5) * 100;
  }

  /**
   * Calculate recency score
   * Newer recipes get slightly higher scores
   */
  private calculateRecencyScore(createdAt: Date): number {
    const now = new Date();
    const ageInDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    // Decay function: newer = higher score
    // 100 points for brand new, decay over 365 days
    if (ageInDays < 0) return 100; // Handle future dates
    if (ageInDays > 365) return 20; // Minimum score for old recipes

    const score = 100 - (ageInDays / 365) * 80;
    return Math.max(score, 20);
  }

  /**
   * Calculate difficulty score
   * Easy recipes get higher scores (more accessible)
   */
  private calculateDifficultyScore(difficulty: 'easy' | 'medium' | 'hard'): number {
    const difficultyScores = {
      easy: 100,
      medium: 70,
      hard: 40,
    };

    return difficultyScores[difficulty];
  }

  /**
   * Get detailed score breakdown for debugging/display
   */
  getScoreBreakdown(
    input: RecipeScoreInput,
    customWeights?: Partial<ScoringWeights>
  ): {
    totalScore: number;
    components: {
      ingredientMatch: { score: number; weight: number; weighted: number };
      fuzzyMatch: { score: number; weight: number; weighted: number };
      popularity: { score: number; weight: number; weighted: number };
      rating: { score: number; weight: number; weighted: number };
      recency: { score: number; weight: number; weighted: number };
      difficulty: { score: number; weight: number; weighted: number };
    };
  } {
    const weights = { ...this.defaultWeights, ...customWeights };

    const ingredientMatchScore = this.calculateIngredientMatchScore(
      input.matchedIngredientsCount,
      input.totalIngredientsCount,
      input.searchTermsCount
    );
    const fuzzyScore = this.normalizeFuzzyScore(input.fuzzyMatchScore);
    const popularityScore = this.calculatePopularityScore(
      input.favoritesCount || 0,
      input.viewCount || 0
    );
    const ratingScore = this.calculateRatingScore(
      input.averageRating || 0,
      input.reviewCount || 0
    );
    const recencyScore = this.calculateRecencyScore(input.createdAt);
    const difficultyScore = this.calculateDifficultyScore(input.difficulty);

    return {
      totalScore: this.calculateScore(input, customWeights),
      components: {
        ingredientMatch: {
          score: ingredientMatchScore,
          weight: weights.ingredientMatch,
          weighted: ingredientMatchScore * weights.ingredientMatch,
        },
        fuzzyMatch: {
          score: fuzzyScore,
          weight: weights.fuzzyMatch,
          weighted: fuzzyScore * weights.fuzzyMatch,
        },
        popularity: {
          score: popularityScore,
          weight: weights.recipePopularity,
          weighted: popularityScore * weights.recipePopularity,
        },
        rating: {
          score: ratingScore,
          weight: weights.recipeRating,
          weighted: ratingScore * weights.recipeRating,
        },
        recency: {
          score: recencyScore,
          weight: weights.recipeRecency,
          weighted: recencyScore * weights.recipeRecency,
        },
        difficulty: {
          score: difficultyScore,
          weight: weights.difficulty,
          weighted: difficultyScore * weights.difficulty,
        },
      },
    };
  }
}

export default new ScoringService();
export { ScoringWeights, RecipeScoreInput };

