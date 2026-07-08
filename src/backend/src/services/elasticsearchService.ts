import { elasticsearchClient, ELASTICSEARCH_INDICES, checkElasticsearchHealth } from '../config/elasticsearch';
import Ingredient from '../models/Ingredient';
import Recipe from '../models/Recipe';
import { Op, Sequelize } from 'sequelize';

// Cache cho ingredients từ database để không query liên tục
let cachedIngredients: Array<{ id: number; name: string }> = [];
let lastCacheUpdate: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 phút

export interface AutocompleteResult {
  id: number;
  text: string;
  score?: number;
}

export interface SuggestionResult {
  suggestions: Array<{
    text: string;
    score: number;
  }>;
}

class ElasticsearchService {
  private isHealthy: boolean = false;

  constructor() {
    // Fire-and-forget health check, but swallow rejections so they don't
    // become unhandled rejections and crash the process on newer Node versions.
    this.initHealth().catch((err) => {
      console.warn('⚠️  Elasticsearch health check rejected:', err?.message || err);
      this.isHealthy = false;
    });
  }

  /**
   * Initialize health check
   */
  private async initHealth(): Promise<void> {
    try {
      this.isHealthy = await checkElasticsearchHealth();
    } catch (err: any) {
      this.isHealthy = false;
      console.warn('⚠️  Elasticsearch health check error:', err?.message || err);
      return;
    }
    console.log(`🔍 Elasticsearch health: ${this.isHealthy ? '✅ Healthy' : '❌ Unhealthy (using fallback)'}`);
  }

  /**
   * Get ingredient autocomplete suggestions
   */
  async getIngredientSuggestions(query: string, limit: number = 10): Promise<AutocompleteResult[]> {
    if (!elasticsearchClient || !this.isHealthy) {
      return await this.getFallbackIngredientSuggestions(query, limit);
    }

    try {
      const response = await elasticsearchClient.search({
        index: ELASTICSEARCH_INDICES.INGREDIENTS,
        suggest: {
          ingredient_suggest: {
            prefix: query.toLowerCase(),
            completion: {
              field: 'ingredientName.suggest',
              size: limit,
              skip_duplicates: true
            }
          }
        },
        _source: ['id', 'ingredientName']
      });

      const suggestions = response.suggest?.ingredient_suggest?.[0]?.options || [];
      
      return Array.isArray(suggestions) ? suggestions.map((suggestion: any) => ({
        id: suggestion._source.id,
        text: suggestion._source.ingredientName,
        score: suggestion._score
      })) : [];
    } catch (error) {
      console.error('Elasticsearch autocomplete error:', error);
      return await this.getFallbackIngredientSuggestions(query, limit);
    }
  }

  /**
   * Get ingredient autocomplete with fuzzy search
   */
  async getIngredientAutocomplete(query: string, limit: number = 10): Promise<AutocompleteResult[]> {
    if (!elasticsearchClient || !this.isHealthy) {
      return await this.getFallbackIngredientSuggestions(query, limit);
    }

    try {
      const response = await elasticsearchClient.search({
        index: ELASTICSEARCH_INDICES.INGREDIENTS,
        query: {
          multi_match: {
            query: query,
            fields: ['ingredientName.autocomplete^2', 'ingredientName^1.5', 'description'],
            type: 'best_fields',
            fuzziness: 'AUTO',
            prefix_length: 1,
            max_expansions: 50
          }
        },
        size: limit,
        _source: ['id', 'ingredientName', 'description'],
        highlight: {
          fields: {
            'ingredientName.autocomplete': {},
            'ingredientName': {}
          }
        }
      });

      return response.hits.hits.map((hit: any) => ({
        id: hit._source.id,
        text: hit._source.ingredientName,
        score: hit._score
      }));
    } catch (error) {
      console.error('Elasticsearch autocomplete error:', error);
      return await this.getFallbackIngredientSuggestions(query, limit);
    }
  }

  /**
   * Get recipe suggestions
   */
  async getRecipeSuggestions(query: string, limit: number = 10): Promise<AutocompleteResult[]> {
    if (!elasticsearchClient || !this.isHealthy) {
      return this.getFallbackRecipeSuggestions(query, limit);
    }

    try {
      const response = await elasticsearchClient.search({
        index: ELASTICSEARCH_INDICES.RECIPES,
        suggest: {
          recipe_suggest: {
            prefix: query.toLowerCase(),
            completion: {
              field: 'recipeName.suggest',
              size: limit,
              skip_duplicates: true
            }
          }
        },
        _source: ['id', 'recipeName']
      });

      const suggestions = response.suggest?.recipe_suggest?.[0]?.options || [];
      
      return Array.isArray(suggestions) ? suggestions.map((suggestion: any) => ({
        id: suggestion._source.id,
        text: suggestion._source.recipeName,
        score: suggestion._score
      })) : [];
    } catch (error) {
      console.error('Elasticsearch recipe suggestions error:', error);
      return this.getFallbackRecipeSuggestions(query, limit);
    }
  }

  /**
   * Index ingredient to Elasticsearch
   */
  async indexIngredient(ingredient: Ingredient): Promise<boolean> {
    if (!elasticsearchClient || !this.isHealthy) {
      console.warn('Elasticsearch not available, skipping ingredient indexing');
      return false;
    }

    try {
      await elasticsearchClient.index({
        index: ELASTICSEARCH_INDICES.INGREDIENTS,
        id: ingredient.id.toString(),
        document: {
          id: ingredient.id,
          ingredientName: ingredient.ingredientName,
          category: ingredient.category,
          description: ingredient.description,
          createdAt: ingredient.createdAt,
          updatedAt: ingredient.updatedAt
        }
      });

      console.log(`✅ Indexed ingredient: ${ingredient.ingredientName}`);
      return true;
    } catch (error) {
      console.error('Failed to index ingredient:', error);
      return false;
    }
  }

  /**
   * Index recipe to Elasticsearch
   */
  async indexRecipe(recipe: Recipe): Promise<boolean> {
    if (!elasticsearchClient || !this.isHealthy) {
      console.warn('Elasticsearch not available, skipping recipe indexing');
      return false;
    }

    try {
      await elasticsearchClient.index({
        index: ELASTICSEARCH_INDICES.RECIPES,
        id: recipe.id.toString(),
        document: {
          id: recipe.id,
          recipeName: recipe.recipeName,
          description: recipe.description,
          difficulty: recipe.difficulty,
          prepTime: recipe.prepTime,
          cookTime: recipe.cookTime,
          servings: recipe.servings,
          createdAt: recipe.createdAt,
          updatedAt: recipe.updatedAt
        }
      });

      console.log(`✅ Indexed recipe: ${recipe.recipeName}`);
      return true;
    } catch (error) {
      console.error('Failed to index recipe:', error);
      return false;
    }
  }

  /**
   * Delete ingredient from Elasticsearch
   */
  async deleteIngredient(ingredientId: number): Promise<boolean> {
    if (!elasticsearchClient || !this.isHealthy) {
      return false;
    }

    try {
      await elasticsearchClient.delete({
        index: ELASTICSEARCH_INDICES.INGREDIENTS,
        id: ingredientId.toString()
      });

      console.log(`🗑️ Deleted ingredient from index: ${ingredientId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete ingredient from index:', error);
      return false;
    }
  }

  /**
   * Delete recipe from Elasticsearch
   */
  async deleteRecipe(recipeId: number): Promise<boolean> {
    if (!elasticsearchClient || !this.isHealthy) {
      return false;
    }

    try {
      await elasticsearchClient.delete({
        index: ELASTICSEARCH_INDICES.RECIPES,
        id: recipeId.toString()
      });

      console.log(`🗑️ Deleted recipe from index: ${recipeId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete recipe from index:', error);
      return false;
    }
  }

  /**
   * Bulk index ingredients
   */
  async bulkIndexIngredients(ingredients: Ingredient[]): Promise<boolean> {
    if (!elasticsearchClient || !this.isHealthy) {
      console.warn('Elasticsearch not available, skipping bulk indexing');
      return false;
    }

    try {
      const operations = ingredients.flatMap(ingredient => [
        { index: { _index: ELASTICSEARCH_INDICES.INGREDIENTS, _id: ingredient.id.toString() } },
        {
          id: ingredient.id,
          ingredientName: ingredient.ingredientName,
          category: ingredient.category,
          description: ingredient.description,
          createdAt: ingredient.createdAt,
          updatedAt: ingredient.updatedAt
        }
      ]);

      const response = await elasticsearchClient.bulk({ operations });
      
      if (response.errors) {
        console.error('Bulk indexing had errors:', response.items);
        return false;
      }

      console.log(`✅ Bulk indexed ${ingredients.length} ingredients`);
      return true;
    } catch (error) {
      console.error('Failed to bulk index ingredients:', error);
      return false;
    }
  }

  /**
   * Refresh ingredient cache từ database
   */
  private async refreshIngredientCache(): Promise<void> {
    const now = Date.now();
    if (cachedIngredients.length > 0 && now - lastCacheUpdate < CACHE_TTL) {
      return; // Cache còn valid
    }

    try {
      const ingredients = await Ingredient.findAll({
        attributes: ['id', 'ingredientName'],
        order: [['ingredientName', 'ASC']],
      });
      
      cachedIngredients = ingredients.map(ing => ({
        id: ing.id,
        name: ing.ingredientName,
      }));
      lastCacheUpdate = now;
      console.log(`📦 Refreshed ingredient cache: ${cachedIngredients.length} items`);
    } catch (error) {
      console.error('Error refreshing ingredient cache:', error);
    }
  }

  /**
   * Fallback ingredient suggestions - Query từ database với fuzzy matching
   * Hỗ trợ partial match: gõ "bún" sẽ tìm được "Bún", "Bún bò Huế", "Bún tươi"
   */
  private async getFallbackIngredientSuggestions(query: string, limit: number): Promise<AutocompleteResult[]> {
    const trimmedQuery = query.trim();
    const normalizedQuery = this.normalizeVietnamese(trimmedQuery.toLowerCase());
    
    if (trimmedQuery.length < 1) {
      return [];
    }

    try {
      // Escape special characters for LIKE
      const escapedQuery = trimmedQuery.replace(/[%_]/g, '\\$&');
      const escapedNormalized = normalizedQuery.replace(/[%_]/g, '\\$&');
      
      // Query trực tiếp từ database - TÌM THEO TỪ HOÀN CHỈNH
      // "gà" chỉ match nguyên liệu có TỪ "gà", không match "gạo", "gan"
      // Sử dụng word boundary: tìm từ bắt đầu hoặc kết thúc bằng khoảng trắng/đầu/cuối
      const ingredients = await Ingredient.findAll({
        attributes: ['id', 'ingredientName'],
        where: {
          [Op.or]: [
            // Exact match toàn bộ tên
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('ingredient_name')),
              escapedQuery.toLowerCase()
            ),
            // Match từ ở đầu tên: "Gà nguyên con" với query "gà"
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('ingredient_name')),
              { [Op.like]: `${escapedQuery.toLowerCase()} %` }
            ),
            // Match từ ở cuối tên: "Thịt gà" với query "gà"  
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('ingredient_name')),
              { [Op.like]: `% ${escapedQuery.toLowerCase()}` }
            ),
            // Match từ ở giữa tên: "Thịt gà rán" với query "gà"
            Sequelize.where(
              Sequelize.fn('LOWER', Sequelize.col('ingredient_name')),
              { [Op.like]: `% ${escapedQuery.toLowerCase()} %` }
            ),
          ],
        },
        order: [
          // Ưu tiên exact match
          [Sequelize.literal(`CASE 
            WHEN LOWER(ingredient_name) = '${escapedQuery.toLowerCase()}' THEN 0
            WHEN LOWER(ingredient_name) LIKE '${escapedQuery.toLowerCase()} %' THEN 1 
            WHEN LOWER(ingredient_name) LIKE '% ${escapedQuery.toLowerCase()}' THEN 2
            ELSE 3 
          END`), 'ASC'],
          ['ingredientName', 'ASC'],
        ],
        limit: limit,
      });

      if (ingredients.length > 0) {
        return ingredients.map(ing => ({
          id: ing.id,
          text: ing.ingredientName,
          score: 1.0,
        }));
      }

      // Nếu không tìm thấy, thử search với cache - MATCH THEO TỪ HOÀN CHỈNH
      await this.refreshIngredientCache();
      
      const queryLower = trimmedQuery.toLowerCase();
      
      // Helper: kiểm tra từ khóa có match với tên theo từ hoàn chỉnh
      const hasWordMatch = (name: string, term: string): boolean => {
        const nameLower = name.toLowerCase();
        // Exact match toàn bộ
        if (nameLower === term) return true;
        // Tách thành các từ và kiểm tra exact match
        const words = nameLower.split(/[\s,\-\/]+/);
        return words.some(word => word === term);
      };
      
      // Tìm trong cache với word matching
      const matchResults = cachedIngredients
        .map(ing => {
          const originalLower = ing.name.toLowerCase();
          const normalizedName = this.normalizeVietnamese(originalLower);
          
          // Tính điểm matching - CHỈ MATCH THEO TỪ HOÀN CHỈNH
          let score = 0;
          
          // Exact match toàn bộ tên (highest priority)
          if (originalLower === queryLower) {
            score = 100;
          }
          // Match theo từ với tên gốc (có dấu)
          else if (hasWordMatch(ing.name, queryLower)) {
            score = 90;
          }
          // Match theo từ với tên normalized (không dấu)
          else if (hasWordMatch(normalizedName, normalizedQuery)) {
            score = 80;
          }
          // KHÔNG dùng includes() hoặc fuzzy match để tránh "gà" match "gạo"
          
          return { ...ing, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return matchResults.map(item => ({
        id: item.id,
        text: item.name,
        score: item.score / 100,
      }));
    } catch (error) {
      console.error('Error in fallback ingredient suggestions:', error);
      return [];
    }
  }

  /**
   * Simple fuzzy matching - kiểm tra có ít nhất n% ký tự giống nhau
   */
  private fuzzyMatch(text: string, query: string): boolean {
    if (query.length < 2) return false;
    
    // Đếm số ký tự của query xuất hiện trong text
    let matchCount = 0;
    const textChars = text.split('');
    
    for (const char of query) {
      const idx = textChars.indexOf(char);
      if (idx !== -1) {
        matchCount++;
        textChars.splice(idx, 1); // Xóa ký tự đã match để tránh đếm trùng
      }
    }
    
    // Match nếu ít nhất 60% ký tự query có trong text
    return matchCount / query.length >= 0.6;
  }

  /**
   * Normalize Vietnamese text (remove diacritics)
   */
  private normalizeVietnamese(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  /**
   * Fallback recipe suggestions
   */
  private getFallbackRecipeSuggestions(query: string, limit: number): AutocompleteResult[] {
    const fallbackRecipes = [
      'Cơm chiên dương châu', 'Phở bò', 'Bún bò huế', 'Bánh mì thịt nướng',
      'Gỏi cuốn', 'Chả cá lã vọng', 'Bún chả', 'Bánh xèo', 'Cao lầu',
      'Mì quảng', 'Bún riêu cua', 'Chè ba màu', 'Bánh flan', 'Kem dừa'
    ];

    const filtered = fallbackRecipes
      .filter(recipe => 
        recipe.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, limit);

    return filtered.map((recipe, index) => ({
      id: index + 2000, // Use high IDs for fallback data
      text: recipe,
      score: 1.0
    }));
  }

  /**
   * Get service status
   */
  getStatus(): { healthy: boolean; client: boolean } {
    return {
      healthy: this.isHealthy,
      client: elasticsearchClient !== null
    };
  }
}

// Export singleton instance
export const elasticsearchService = new ElasticsearchService();
export default elasticsearchService;
