import Fuse from 'fuse.js';
import { Op } from 'sequelize';
import { Recipe, Ingredient, RecipeIngredient, IngredientCategory } from '../models';
import scoringService from './scoringService';
import { normalizeText } from '../utils/stringUtils';

/**
 * Service for searching recipes by ingredients
 */
class SearchService {
  /**
   * Search recipes by ingredient names
   * @param ingredientNames - Array of ingredient names to search
   * @param options - Search options (limit, offset, minMatch)
   */
  async searchRecipesByIngredients(
    ingredientNames: string[],
    options: {
      limit?: number;
      offset?: number;
      minMatchPercentage?: number; // % of ingredients that must match
      sortBy?: 'relevance' | 'createdAt' | 'name';
      order?: 'ASC' | 'DESC';
      // Advanced filters
      difficulty?: string[];
      prepTimeMax?: number;
      cookTimeMax?: number;
      servingsMin?: number;
      servingsMax?: number;
      ratingMin?: number;
      dietary?: string[];
    } = {}
  ) {
    const {
      limit = 10,
      offset = 0,
      minMatchPercentage = 50,
      sortBy = 'relevance',
      order = 'DESC',
      difficulty,
      prepTimeMax,
      cookTimeMax,
      servingsMin,
      servingsMax,
      ratingMin,
      dietary,
    } = options;

    try {
      // Step 1: Find matching ingredients using fuzzy search
      const allIngredients = await Ingredient.findAll({
        include: [
          {
            model: IngredientCategory,
            as: 'category',
            attributes: ['id', 'categoryName'],
          },
        ],
      });

      const normalizedIngredientMap = new Map<
        string,
        { id: number; name: string; category: string }
      >();

      const fuse = new Fuse(
        allIngredients.map((ing) => {
          const normalizedName = normalizeText(ing.ingredientName);
          normalizedIngredientMap.set(normalizedName, {
            id: ing.id,
            name: ing.ingredientName,
            category: ing.category?.categoryName || '',
          });
          return {
            id: ing.id,
            name: ing.ingredientName,
            normalizedName,
            category: ing.category?.categoryName || '',
          };
        }),
        {
          keys: [
            { name: 'name', weight: 0.85 },
            { name: 'category', weight: 0.15 },
          ],
          threshold: 0.3,
          distance: 60,
          ignoreLocation: true,
          minMatchCharLength: 2,
        }
      );

      // Find matching ingredient IDs for each search term
      const matchedIngredientIds = new Set<number>();
      const ingredientMatchScores = new Map<number, number>();
      let matchedSearchTermsCount = 0;

      for (const searchTerm of ingredientNames) {
        const normalizedTerm = normalizeText(searchTerm);
        const termMatches: Array<{ id: number; score: number }> = [];

        // Step 1: exact normalized match
        const exact = normalizedIngredientMap.get(normalizedTerm);
        if (exact) {
          termMatches.push({ id: exact.id, score: 100 });
        } else {
          // Step 2: fuzzy fallback (limit top 3 confident matches)
          // Note: In Fuse.js, lower scores = better matches (0 = perfect, 1 = no match)
          // With threshold 0.3, we only want matches with score <= 0.3
          const results = fuse.search(searchTerm, { limit: 3 });
          results.forEach((result, index) => {
            // Skip poor matches (score > threshold means low confidence)
            if (result.score !== undefined && result.score > 0.3) {
              return;
            }
            termMatches.push({
              id: result.item.id,
              score: (1 - (result.score ?? 0)) * (15 - index * 2),
            });
          });
        }

        if (termMatches.length > 0) {
          matchedSearchTermsCount++;
          termMatches.forEach(({ id, score }) => {
            matchedIngredientIds.add(id);
            ingredientMatchScores.set(id, (ingredientMatchScores.get(id) || 0) + score);
          });
        }
      }

      if (matchedIngredientIds.size === 0) {
        return {
          recipes: [],
          total: 0,
          matchedIngredients: [],
          searchTerms: ingredientNames,
        };
      }

      // Step 2: Find recipes that contain these ingredients
      const recipeIngredients = await RecipeIngredient.findAll({
        where: {
          ingredientId: {
            [Op.in]: Array.from(matchedIngredientIds),
          },
        },
        attributes: ['recipeId', 'ingredientId', 'quantity', 'unit'],
      });

      // Group by recipe and count matches
      const recipeMatches = new Map<
        number,
        {
          count: number;
          matchedIngredients: Array<{ id: number; quantity: string; unit?: string; score: number }>;
          totalScore: number;
        }
      >();

      recipeIngredients.forEach((ri) => {
        const existing = recipeMatches.get(ri.recipeId) || {
          count: 0,
          matchedIngredients: [],
          totalScore: 0,
        };

        const ingredientScore = ingredientMatchScores.get(ri.ingredientId) || 0;

        existing.count++;
        existing.matchedIngredients.push({
          id: ri.ingredientId,
          quantity: ri.quantity,
          unit: ri.unit,
          score: ingredientScore,
        });
        existing.totalScore += ingredientScore;

        recipeMatches.set(ri.recipeId, existing);
      });

      // Step 3: Filter recipes by minimum match percentage
      const effectiveSearchTermCount = matchedSearchTermsCount || ingredientNames.length;
      const minMatches = Math.max(
        1,
        Math.ceil((effectiveSearchTermCount * minMatchPercentage) / 100)
      );
      const qualifiedRecipeIds = Array.from(recipeMatches.entries())
        .filter(([_, data]) => data.count >= minMatches)
        .map(([recipeId, data]) => ({ recipeId, ...data }));

      if (qualifiedRecipeIds.length === 0) {
        return {
          recipes: [],
          total: 0,
          matchedIngredients: Array.from(matchedIngredientIds),
          searchTerms: ingredientNames,
        };
      }

      // Step 4: Calculate weighted scores and sort
      const recipesWithScores = qualifiedRecipeIds.map((item) => {
        // Pre-calculate weighted score for sorting
        // Note: We'll recalculate with full recipe data later
        const weightedScore = scoringService.calculateScore({
          matchedIngredientsCount: item.count,
          totalIngredientsCount: item.count, // Will be updated with actual recipe data
          searchTermsCount: ingredientNames.length,
          fuzzyMatchScore: item.totalScore,
          createdAt: new Date(), // Placeholder, will use actual recipe date
          difficulty: 'medium', // Placeholder
          favoritesCount: 0,
          viewCount: 0,
          averageRating: 0,
          reviewCount: 0,
        });

        return {
          ...item,
          weightedScore,
        };
      });

      // Sort by weighted relevance score
      if (sortBy === 'relevance') {
        recipesWithScores.sort((a, b) => {
          return order === 'DESC' ? b.weightedScore - a.weightedScore : a.weightedScore - b.weightedScore;
        });
      }

      // Step 5: Fetch ALL qualified recipe details (before pagination)
      const allQualifiedRecipeIds = recipesWithScores.map((r) => r.recipeId);

      // Build where clause with filters
      const whereClause: any = {
        id: {
          [Op.in]: allQualifiedRecipeIds,
        },
        status: 'visible',
      };

      // Apply advanced filters
      if (difficulty && difficulty.length > 0) {
        whereClause.difficulty = {
          [Op.in]: difficulty,
        };
      }

      if (prepTimeMax) {
        whereClause.prepTime = {
          [Op.lte]: prepTimeMax,
        };
      }

      if (cookTimeMax) {
        whereClause.cookTime = {
          [Op.lte]: cookTimeMax,
        };
      }

      if (servingsMin || servingsMax) {
        whereClause.servings = {};
        if (servingsMin) {
          whereClause.servings[Op.gte] = servingsMin;
        }
        if (servingsMax) {
          whereClause.servings[Op.lte] = servingsMax;
        }
      }

      // Fetch filtered recipes
      const recipes = await Recipe.findAll({
        where: whereClause,
        include: [
          {
            model: Ingredient,
            as: 'ingredients',
            through: {
              attributes: ['quantity', 'unit'],
            },
            include: [
              {
                model: IngredientCategory,
                as: 'category',
                attributes: ['id', 'categoryName'],
              },
            ],
          },
        ],
        order:
          sortBy === 'relevance'
            ? [] // Already sorted by relevance
            : sortBy === 'createdAt'
            ? [['createdAt', order]]
            : [['recipeName', order]],
      });

      // Add match metadata and calculate weighted scores for each recipe
      const recipesWithMetadata = recipes.map((recipe) => {
        const matchData = recipeMatches.get(recipe.id);
        const matchedCount = matchData?.count || 0;
        const totalCount = recipe.ingredients?.length || 0;
        const fuzzyScore = matchData?.totalScore || 0;

        // Calculate weighted score using scoring service
        const weightedScore = scoringService.calculateScore({
          matchedIngredientsCount: matchedCount,
          totalIngredientsCount: totalCount,
          searchTermsCount: ingredientNames.length,
          fuzzyMatchScore: fuzzyScore,
          createdAt: recipe.createdAt,
          difficulty: recipe.difficulty,
          // These will be populated later when favorites/reviews are implemented
          favoritesCount: 0,
          viewCount: 0,
          averageRating: 0,
          reviewCount: 0,
        });

        return {
          ...recipe.toJSON(),
          matchMetadata: {
            matchedIngredientsCount: matchedCount,
            totalIngredientsCount: totalCount,
            matchPercentage: totalCount > 0
              ? Math.round((matchedCount / totalCount) * 100)
              : 0,
            fuzzyScore: fuzzyScore,
            weightedScore: weightedScore, // New: comprehensive weighted score
            matchedIngredients: matchData?.matchedIngredients || [],
          },
        };
      });

      // Sort by weighted score for relevance
      if (sortBy === 'relevance') {
        recipesWithMetadata.sort((a, b) => {
          return order === 'DESC' 
            ? b.matchMetadata.weightedScore - a.matchMetadata.weightedScore 
            : a.matchMetadata.weightedScore - b.matchMetadata.weightedScore;
        });
      }

      // Apply pagination AFTER filtering
      const totalFiltered = recipesWithMetadata.length;
      const paginatedRecipes = recipesWithMetadata.slice(offset, offset + limit);

      return {
        recipes: paginatedRecipes,
        total: totalFiltered,
        matchedIngredients: Array.from(matchedIngredientIds),
        searchTerms: ingredientNames,
        pagination: {
          limit,
          offset,
          currentPage: Math.floor(offset / limit) + 1,
          totalPages: Math.ceil(totalFiltered / limit),
        },
      };
    } catch (error) {
      console.error('Error in searchRecipesByIngredients:', error);
      throw error;
    }
  }

  /**
   * Autocomplete ingredient names
   * @param searchTerm - Partial ingredient name
   * @param limit - Maximum number of suggestions
   */
  async autocompleteIngredients(searchTerm: string, limit: number = 10) {
    try {
      if (!searchTerm || searchTerm.length < 2) {
        return [];
      }

      const allIngredients = await Ingredient.findAll({
        include: [
          {
            model: IngredientCategory,
            as: 'category',
            attributes: ['id', 'categoryName'],
          },
        ],
      });

      const fuse = new Fuse(
        allIngredients.map((ing) => ({
          id: ing.id,
          name: ing.ingredientName,
          category: ing.category?.categoryName || '',
          description: ing.description || '',
        })),
        {
          keys: [
            { name: 'name', weight: 0.7 },
            { name: 'category', weight: 0.2 },
            { name: 'description', weight: 0.1 },
          ],
          threshold: 0.3,
          distance: 100,
          ignoreLocation: true,
        }
      );

      const results = fuse.search(searchTerm, { limit });

      return results.map((result) => ({
        id: result.item.id,
        name: result.item.name,
        category: result.item.category,
        score: result.score,
      }));
    } catch (error) {
      console.error('Error in autocompleteIngredients:', error);
      throw error;
    }
  }
}

export default new SearchService();

