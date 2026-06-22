import { Request, Response, NextFunction } from 'express';
import recipeSearchService from '../services/recipeSearchService';
import { searchRerankService } from '../services/recommendation/searchRerankService';

export const searchRecipesByKeyword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      keyword = '',
      difficulty,
      min_time,
      max_time,
      servings,
      cuisine,
      course,
      tags,
      limit,
      page,
    } = req.query;

    const parsedDifficulty = typeof difficulty === 'string'
      ? difficulty.split(',').map((item) => item.trim()).filter(Boolean)
      : Array.isArray(difficulty)
      ? (difficulty as string[])
      : undefined;

    const parsedTags = typeof tags === 'string'
      ? tags.split(',').map((item) => item.trim()).filter(Boolean)
      : Array.isArray(tags)
      ? (tags as string[])
      : undefined;

    const data = await recipeSearchService.searchByKeyword({
      keyword: keyword as string,
      difficulty: parsedDifficulty as string[] | undefined,
      minTime: min_time ? parseInt(min_time as string, 10) : undefined,
      maxTime: max_time ? parseInt(max_time as string, 10) : undefined,
      servings: servings ? parseInt(servings as string, 10) : undefined,
      cuisine: cuisine as string | undefined,
      course: course as string | undefined,
      tags: parsedTags as string[] | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      page: page ? parseInt(page as string, 10) : undefined,
    });

    res.json({
      success: true,
      message: 'Keyword search completed',
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const searchRecipesByIngredients = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      ingredients = [],
      excludeIngredients = [],
      difficulty,
      prepTimeMax,
      cookTimeMax,
      servingsMin,
      servingsMax,
      minMatchPercentage,
      cuisine,
      course,
      tags,
      page,
      limit,
      // Re-ranking options
      personalize = false,
      rerank = false,
    } = req.body;

    const parsedDifficulty = Array.isArray(difficulty)
      ? difficulty
      : typeof difficulty === 'string'
      ? difficulty.split(',').map((item: string) => item.trim()).filter(Boolean)
      : undefined;

    const parsedTags = Array.isArray(tags)
      ? tags
      : typeof tags === 'string'
      ? tags.split(',').map((item: string) => item.trim()).filter(Boolean)
      : undefined;

    // Get userId từ auth (nếu có)
    const userId = req.user?.id;

    const data = await recipeSearchService.searchByIngredients({
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      excludeIngredients: Array.isArray(excludeIngredients) ? excludeIngredients : [],
      difficulty: parsedDifficulty,
      prepTimeMax: prepTimeMax ? parseInt(prepTimeMax, 10) : undefined,
      cookTimeMax: cookTimeMax ? parseInt(cookTimeMax, 10) : undefined,
      servingsMin: servingsMin ? parseInt(servingsMin, 10) : undefined,
      servingsMax: servingsMax ? parseInt(servingsMax, 10) : undefined,
      minMatchPercentage: minMatchPercentage ? parseInt(minMatchPercentage, 10) : undefined,
      cuisine: cuisine as string | undefined,
      course: course as string | undefined,
      tags: parsedTags as string[] | undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    // Apply personalized re-ranking nếu user đã đăng nhập và có bật tùy chọn
    let rerankedResult = null;
    if ((personalize || rerank) && userId && data.recipes && data.recipes.length > 0) {
      console.log(`🎯 Applying personalized re-ranking for user ${userId} in recipeSearchService`);
      const rerankWeight = personalize ? 0.15 : 0.4;
      const searchWeight = 1 - rerankWeight;
      
      rerankedResult = await searchRerankService.rerankSearchResults(data.recipes, {
        userId,
        searchWeight,
        recommendationWeight: rerankWeight,
        limit: limit ? parseInt(limit, 10) : 12,
      });
    }

    res.json({
      success: true,
      message: 'Ingredient search completed',
      data: {
        recipes: rerankedResult?.recipes || data.recipes,
        pagination: data.pagination,
        missingIngredients: data.missingIngredients,
        matchedIngredients: data.matchedIngredients,
        searchTerms: data.searchTerms,
        reranked: rerankedResult !== null,
        rerankingMetadata: rerankedResult?.metadata || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

