import { Request, Response, NextFunction } from 'express';
import searchService from '../services/searchService';
import recipeSearchService from '../services/recipeSearchService';
import cacheService from '../services/cacheService';
import elasticsearchService from '../services/elasticsearchService';
import { searchRerankService } from '../services/recommendation/searchRerankService';
import { BadRequestError } from '../utils/errors';

/**
 * Search recipes by ingredients
 * POST /api/search/recipes
 */
export const searchRecipesByIngredients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      ingredients,
      limit = 10,
      offset = 0,
      minMatchPercentage = 50,
      sortBy = 'relevance',
      order = 'DESC',
      // Advanced filters
      difficulty,
      prepTimeMax,
      cookTimeMax,
      servingsMin,
      servingsMax,
      ratingMin,
      dietary,
      // Re-ranking options
      personalize = false, // Bật/tắt personalized re-ranking
      rerank = false, // Bật/tắt re-ranking
    } = req.body;

    // Validation
    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      throw new BadRequestError(
        'Please provide at least one ingredient to search',
        'INVALID_INGREDIENTS'
      );
    }

    if (ingredients.length > 20) {
      throw new BadRequestError(
        'Maximum 20 ingredients allowed per search',
        'TOO_MANY_INGREDIENTS'
      );
    }

    // Filter out empty strings and trim
    const cleanedIngredients = ingredients
      .filter((ing: string) => typeof ing === 'string' && ing.trim().length > 0)
      .map((ing: string) => ing.trim());

    if (cleanedIngredients.length === 0) {
      throw new BadRequestError('Please provide valid ingredient names', 'INVALID_INGREDIENTS');
    }

    // Get userId từ auth (nếu có)
    const userId = req.user?.id;

    // Create cache key from search parameters
    const searchParams = {
      ingredients: cleanedIngredients,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      minMatchPercentage: parseInt(minMatchPercentage as string),
      sortBy: sortBy as 'relevance' | 'createdAt' | 'name',
      order: order as 'ASC' | 'DESC',
      // Advanced filters
      difficulty,
      prepTimeMax: prepTimeMax ? parseInt(prepTimeMax as string) : undefined,
      cookTimeMax: cookTimeMax ? parseInt(cookTimeMax as string) : undefined,
      servingsMin: servingsMin ? parseInt(servingsMin as string) : undefined,
      servingsMax: servingsMax ? parseInt(servingsMax as string) : undefined,
      ratingMin: ratingMin ? parseFloat(ratingMin as string) : undefined,
      dietary,
      personalize,
      rerank,
    };

    const queryString = cleanedIngredients.join(',');
    const filtersString = JSON.stringify(searchParams);

    // Try to get cached results first
    let cachedRecipes = await cacheService.getCachedSearchResults(queryString, searchParams);
    let result: any;

    if (!cachedRecipes) {
      // Cache miss - perform actual search
      console.log('🔍 Cache miss - performing database search');
      result = await searchService.searchRecipesByIngredients(cleanedIngredients, searchParams);
      
      // Cache the results
      await cacheService.cacheSearchResults(queryString, searchParams, result.recipes);
    } else {
      console.log('🎯 Cache hit - returning cached results');
      // For cached results, we need to reconstruct the full result object
      result = {
        recipes: cachedRecipes,
        searchTerms: cleanedIngredients,
        matchedIngredients: cleanedIngredients, // Simplified for cached results
        pagination: {
          limit: searchParams.limit,
          offset: searchParams.offset,
          total: cachedRecipes.length,
        },
        total: cachedRecipes.length,
      };
    }

    // Apply personalized re-ranking nếu user đã đăng nhập và có bật tùy chọn
    let rerankedResult = null;
    if ((personalize || rerank) && userId && result.recipes.length > 0) {
      console.log(`🎯 Applying personalized re-ranking for user ${userId}`);
      const rerankWeight = personalize ? 0.15 : 0.4; // personalize nhẹ hơn
      const searchWeight = 1 - rerankWeight;
      
      rerankedResult = await searchRerankService.rerankSearchResults(result.recipes, {
        userId,
        searchWeight,
        recommendationWeight: rerankWeight,
        limit: searchParams.limit,
      });
    }

    res.json({
      success: true,
      message: 'Search completed successfully',
      data: {
        recipes: rerankedResult?.recipes || result.recipes,
        searchTerms: result.searchTerms,
        matchedIngredients: result.matchedIngredients,
        pagination: {
          ...result.pagination,
          total: result.total,
        },
        cached: cachedRecipes !== null, // Indicate if result was from cache
        reranked: rerankedResult !== null,
        rerankingMetadata: rerankedResult?.metadata || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Autocomplete ingredient names with Elasticsearch
 * GET /api/search/ingredients/autocomplete
 */
export const autocompleteIngredients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, limit = 10, fuzzy = 'false' } = req.query;

    if (!q || typeof q !== 'string') {
      throw new BadRequestError('Search query parameter "q" is required', 'MISSING_QUERY');
    }

    if (q.length < 1) {
      res.json({
        success: true,
        message: 'Please provide at least 1 character',
        data: {
          query: q,
          suggestions: [],
          source: 'fallback'
        },
      });
      return;
    }

    // Use Elasticsearch for autocomplete
    const suggestions = fuzzy === 'true' 
      ? await elasticsearchService.getIngredientAutocomplete(q, parseInt(limit as string))
      : await elasticsearchService.getIngredientSuggestions(q, parseInt(limit as string));

    const status = elasticsearchService.getStatus();
    
    res.json({
      success: true,
      message: 'Autocomplete suggestions retrieved',
      data: {
        query: q,
        suggestions: suggestions.map(s => ({
          id: s.id,
          text: s.text,
          score: s.score
        })),
        source: status.healthy ? 'elasticsearch' : 'fallback'
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Autocomplete recipe names
 * GET /api/search/recipes/autocomplete
 */
export const autocompleteRecipes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || typeof q !== 'string') {
      throw new BadRequestError('Search query parameter "q" is required', 'MISSING_QUERY');
    }

    if (q.length < 1) {
      res.json({
        success: true,
        message: 'Please provide at least 1 character',
        data: {
          query: q,
          suggestions: [],
          source: 'fallback'
        },
      });
      return;
    }

    // Use Elasticsearch for recipe autocomplete
    const suggestions = await elasticsearchService.getRecipeSuggestions(q, parseInt(limit as string));

    const status = elasticsearchService.getStatus();
    
    res.json({
      success: true,
      message: 'Recipe autocomplete suggestions retrieved',
      data: {
        query: q,
        suggestions: suggestions.map(s => ({
          id: s.id,
          text: s.text,
          score: s.score
        })),
        source: status.healthy ? 'elasticsearch' : 'fallback'
      },
    });
  } catch (error) {
    next(error);
  }
};

