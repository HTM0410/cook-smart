/**
 * Popularity Service
 * Gợi ý dựa trên độ phổ biến của công thức
 * Tính toán popularity score từ views, favorites, ratings
 */

import { Op, literal, fn, col } from 'sequelize';
import { Recipe, UserView, UserFavorite, RecipeReview, RecipeCategory } from '../../models';
import { RecipePopularity } from '../../types/recommendation';

class PopularityService {
  /**
   * Tính popularity score cho tất cả công thức
   */
  async calculatePopularityScores(): Promise<Map<number, number>> {
    const recipes = await Recipe.findAll({
      where: { status: 'visible' },
      attributes: ['id'],
      include: [
        {
          model: UserView,
          as: 'views',
          attributes: [],
          required: false,
        },
        {
          model: UserFavorite,
          as: 'favoritedBy',
          attributes: [],
          required: false,
        },
        {
          model: RecipeReview,
          as: 'reviews',
          attributes: [],
          where: { isActive: true },
          required: false,
        },
      ],
    });

    const popularityMap = new Map<number, number>();

    for (const recipe of recipes) {
      const recipeId = recipe.id;
      const views = (recipe as any).views?.length || 0;
      const favorites = (recipe as any).favoritedBy?.length || 0;
      const reviews = (recipe as any).reviews || [];
      const reviewCount = reviews.length;
      const avgRating = reviewCount > 0
        ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount
        : 0;

      // Popularity formula:
      // views * 0.1 + favorites * 2.0 + avgRating * reviewCount * 0.5
      const popularityScore = 
        views * 0.1 + 
        favorites * 2.0 + 
        avgRating * reviewCount * 0.5;

      popularityMap.set(recipeId, popularityScore);
    }

    return popularityMap;
  }

  /**
   * Lấy top công thức phổ biến
   */
  async getPopularRecipes(
    limit: number = 10,
    categoryFilter?: string
  ): Promise<RecipePopularity[]> {
    const { QueryTypes } = await import('sequelize');
    const { sequelize } = await import('../../models');

    let sql = `
      SELECT 
        r.id AS recipe_id,
        r.recipe_name,
        r.image_url,
        r.prep_time,
        r.cook_time,
        r.servings,
        r.difficulty,
        COALESCE(vc.view_count, 0) AS total_views,
        COALESCE(fc.favorite_count, 0) AS total_favorites,
        COALESCE(rc.avg_rating, 0) AS avg_rating,
        COALESCE(rc.rating_count, 0) AS rating_count,
        (
          COALESCE(vc.view_count, 0) * 0.1 + 
          COALESCE(fc.favorite_count, 0) * 2.0 + 
          COALESCE(rc.avg_rating, 0) * COALESCE(rc.rating_count, 0) * 0.5
        ) AS popularity_score
      FROM recipes r
      LEFT JOIN (
        SELECT recipe_id, SUM(view_count) as view_count
        FROM user_views
        GROUP BY recipe_id
      ) vc ON r.id = vc.recipe_id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as favorite_count
        FROM user_favorites
        GROUP BY recipe_id
      ) fc ON r.id = fc.recipe_id
      LEFT JOIN (
        SELECT recipe_id, AVG(rating)::float as avg_rating, COUNT(*) as rating_count
        FROM recipe_reviews
        WHERE is_active = true
        GROUP BY recipe_id
      ) rc ON r.id = rc.recipe_id
      WHERE r.status = 'visible'
    `;

    const replacements: any[] = [];

    if (categoryFilter) {
      sql += `
        AND r.id IN (
          SELECT rcm.recipe_id 
          FROM recipe_category_maps rcm
          JOIN recipe_categories rc ON rcm.category_id = rc.id
          WHERE rc.category_name ILIKE ?
        )
      `;
      replacements.push(`%${categoryFilter}%`);
    }

    sql += `
      ORDER BY popularity_score DESC
      LIMIT ?
    `;
    replacements.push(limit);

    const results = await sequelize.query(sql, {
      replacements,
      type: 'SELECT',
    }) as any[];

    return results.map((row, index) => ({
      recipeId: row.recipe_id,
      recipeName: row.recipe_name,
      totalViews: parseInt(row.total_views, 10),
      totalFavorites: parseInt(row.total_favorites, 10),
      avgRating: parseFloat(row.avg_rating) || 0,
      ratingCount: parseInt(row.rating_count, 10),
      popularityScore: parseFloat(row.popularity_score) || 0,
      rank: index + 1,
    }));
  }

  /**
   * Lấy trending recipes (dựa trên recent activity)
   */
  async getTrendingRecipes(
    limit: number = 10,
    days: number = 7
  ): Promise<RecipePopularity[]> {
    const { sequelize } = await import('../../models');

    const results = await sequelize.query(`
      SELECT 
        r.id AS recipe_id,
        r.recipe_name,
        r.image_url,
        COALESCE(recent_views.view_count, 0) AS total_views,
        COALESCE(recent_favs.favorite_count, 0) AS total_favorites,
        COALESCE(recent_ratings.avg_rating, 0) AS avg_rating,
        COALESCE(recent_ratings.rating_count, 0) AS rating_count,
        (
          COALESCE(recent_views.view_count, 0) * 0.1 +
          COALESCE(recent_favs.favorite_count, 0) * 2.0 +
          COALESCE(recent_ratings.avg_rating, 0) * COALESCE(recent_ratings.rating_count, 0) * 0.5
        ) AS popularity_score
      FROM recipes r
      LEFT JOIN (
        SELECT recipe_id, SUM(view_count) as view_count
        FROM user_views
        WHERE last_viewed_at >= NOW() - INTERVAL '${days} days'
        GROUP BY recipe_id
      ) recent_views ON r.id = recent_views.recipe_id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as favorite_count
        FROM user_favorites
        WHERE created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY recipe_id
      ) recent_favs ON r.id = recent_favs.recipe_id
      LEFT JOIN (
        SELECT recipe_id, AVG(rating)::float as avg_rating, COUNT(*) as rating_count
        FROM recipe_reviews
        WHERE is_active = true AND created_at >= NOW() - INTERVAL '${days} days'
        GROUP BY recipe_id
      ) recent_ratings ON r.id = recent_ratings.recipe_id
      WHERE r.status = 'visible'
      AND (
        recent_views.view_count > 0 OR
        recent_favs.favorite_count > 0 OR
        recent_ratings.rating_count > 0
      )
      ORDER BY popularity_score DESC
      LIMIT ?
    `, {
      replacements: [limit],
      type: 'SELECT',
    }) as any[];

    return results.map((row, index) => ({
      recipeId: row.recipe_id,
      recipeName: row.recipe_name,
      totalViews: parseInt(row.total_views, 10),
      totalFavorites: parseInt(row.total_favorites, 10),
      avgRating: parseFloat(row.avg_rating) || 0,
      ratingCount: parseInt(row.rating_count, 10),
      popularityScore: parseFloat(row.popularity_score) || 0,
      rank: index + 1,
    }));
  }

  /**
   * Lấy popularity score cho một công thức
   */
  async getRecipePopularity(recipeId: number): Promise<RecipePopularity | null> {
    const recipe = await Recipe.findByPk(recipeId, {
      include: [
        { model: UserView, as: 'views', attributes: [] },
        { model: UserFavorite, as: 'favoritedBy', attributes: [] },
        { model: RecipeReview, as: 'reviews', where: { isActive: true }, required: false },
      ],
    });

    if (!recipe) {
      return null;
    }

    const views = (recipe as any).views?.length || 0;
    const favorites = (recipe as any).favoritedBy?.length || 0;
    const reviews = (recipe as any).reviews || [];
    const reviewCount = reviews.length;
    const avgRating = reviewCount > 0
      ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviewCount
      : 0;

    const popularityScore = views * 0.1 + favorites * 2.0 + avgRating * reviewCount * 0.5;

    return {
      recipeId: recipe.id,
      recipeName: recipe.recipeName,
      totalViews: views,
      totalFavorites: favorites,
      avgRating,
      ratingCount: reviewCount,
      popularityScore,
    };
  }

  /**
   * Lấy popularity scores cho nhiều công thức
   */
  async getPopularityScores(recipeIds: number[]): Promise<Map<number, number>> {
    if (recipeIds.length === 0) {
      return new Map();
    }

    const { sequelize } = await import('../../models');

    const results = await sequelize.query(`
      SELECT 
        r.id AS recipe_id,
        COALESCE(vc.view_count, 0) AS total_views,
        COALESCE(fc.favorite_count, 0) AS total_favorites,
        COALESCE(rc.avg_rating, 0) AS avg_rating,
        COALESCE(rc.rating_count, 0) AS rating_count,
        (
          COALESCE(vc.view_count, 0) * 0.1 + 
          COALESCE(fc.favorite_count, 0) * 2.0 + 
          COALESCE(rc.avg_rating, 0) * COALESCE(rc.rating_count, 0) * 0.5
        ) AS popularity_score
      FROM recipes r
      LEFT JOIN (
        SELECT recipe_id, SUM(view_count) as view_count
        FROM user_views
        GROUP BY recipe_id
      ) vc ON r.id = vc.recipe_id
      LEFT JOIN (
        SELECT recipe_id, COUNT(*) as favorite_count
        FROM user_favorites
        GROUP BY recipe_id
      ) fc ON r.id = fc.recipe_id
      LEFT JOIN (
        SELECT recipe_id, AVG(rating)::float as avg_rating, COUNT(*) as rating_count
        FROM recipe_reviews
        WHERE is_active = true
        GROUP BY recipe_id
      ) rc ON r.id = rc.recipe_id
      WHERE r.id = ANY(?)
    `, {
      replacements: [recipeIds],
      type: 'SELECT',
    }) as any[];

    const scoreMap = new Map<number, number>();
    results.forEach((row: any) => {
      scoreMap.set(row.recipe_id, parseFloat(row.popularity_score) || 0);
    });

    // Fill missing recipes with 0
    recipeIds.forEach(id => {
      if (!scoreMap.has(id)) {
        scoreMap.set(id, 0);
      }
    });

    return scoreMap;
  }

  /**
   * Normalize scores to 0-1 range
   */
  normalizeScores(scores: Map<number, number>): Map<number, number> {
    if (scores.size === 0) {
      return scores;
    }

    const values = Array.from(scores.values());
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;

    if (range === 0) {
      return new Map(Array.from(scores.keys()).map(id => [id, 0.5]));
    }

    const normalized = new Map<number, number>();
    scores.forEach((score, id) => {
      normalized.set(id, (score - min) / range);
    });

    return normalized;
  }

  /**
   * Get rank of a recipe among all visible recipes
   */
  async getRecipeRank(recipeId: number): Promise<number | null> {
    const { sequelize } = await import('../../models');

    const results = await sequelize.query(`
      WITH ranked AS (
        SELECT 
          r.id,
          ROW_NUMBER() OVER (ORDER BY 
            COALESCE(vc.view_count, 0) * 0.1 + 
            COALESCE(fc.favorite_count, 0) * 2.0 + 
            COALESCE(rc.avg_rating, 0) * COALESCE(rc.rating_count, 0) * 0.5 DESC
          ) as rank
        FROM recipes r
        LEFT JOIN (
          SELECT recipe_id, SUM(view_count) as view_count
          FROM user_views
          GROUP BY recipe_id
        ) vc ON r.id = vc.recipe_id
        LEFT JOIN (
          SELECT recipe_id, COUNT(*) as favorite_count
          FROM user_favorites
          GROUP BY recipe_id
        ) fc ON r.id = fc.recipe_id
        LEFT JOIN (
          SELECT recipe_id, AVG(rating)::float as avg_rating, COUNT(*) as rating_count
          FROM recipe_reviews
          WHERE is_active = true
          GROUP BY recipe_id
        ) rc ON r.id = rc.recipe_id
        WHERE r.status = 'visible'
      )
      SELECT rank FROM ranked WHERE id = ?
    `, {
      replacements: [recipeId],
      type: 'SELECT',
    }) as { rank: number }[];

    return results.length > 0 ? results[0].rank : null;
  }
}

export const popularityService = new PopularityService();
export default popularityService;
