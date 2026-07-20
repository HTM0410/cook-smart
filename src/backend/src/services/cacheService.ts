import { redisClient } from '../config/redis';
import Recipe from '../models/Recipe';

// In-memory cache fallback
const memoryCache = new Map<string, { data: any; expires: number }>();

// Cache key strategies
export const CACHE_KEYS = {
  SEARCH_RESULTS: (query: string, filters: string) => `search:${query}:${filters}`,
  RECIPE_DETAIL: (recipeId: number) => `recipe:${recipeId}`,
  RECIPE_LIST: (params: string) => `recipes:list:${params}`,
  POPULAR_RECIPES: (limit: number) => `popular:${limit}`,
  RECENT_RECIPES: (limit: number) => `recent:${limit}`,
  USER_FAVORITES: (userId: number) => `user:favorites:${userId}`,
  INGREDIENT_RECIPES: (ingredientId: number) => `ingredient:recipes:${ingredientId}`,
} as const;

// Cache TTL (Time To Live) in seconds
export const CACHE_TTL = {
  SEARCH_RESULTS: 15 * 60, // 15 minutes
  RECIPE_DETAIL: 30 * 60, // 30 minutes
  RECIPE_LIST: 10 * 60, // 10 minutes - shorter because admin can edit recipes often
  POPULAR_RECIPES: 10 * 60, // 10 minutes
  RECENT_RECIPES: 5 * 60, // 5 minutes
  USER_FAVORITES: 5 * 60, // 5 minutes
  INGREDIENT_RECIPES: 20 * 60, // 20 minutes
} as const;

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
}

class CacheService {
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0,
  };

  /**
   * Get cached data by key
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;
    
    // Try Redis first
    if (redisClient) {
      try {
        const cached = await redisClient.get(key);
        
        if (cached) {
          this.stats.hits++;
          this.updateHitRate();
          console.log(`🎯 Redis Cache HIT: ${key}`);
          return JSON.parse(cached);
        }
      } catch (error) {
        console.warn(`⚠️ Redis GET failed for ${key}, trying memory cache`);
      }
    }
    
    // Fallback to memory cache
    const memoryItem = memoryCache.get(key);
    if (memoryItem && memoryItem.expires > Date.now()) {
      this.stats.hits++;
      this.updateHitRate();
      console.log(`🎯 Memory Cache HIT: ${key}`);
      return memoryItem.data;
    }
    
    // Clean expired memory cache
    if (memoryItem && memoryItem.expires <= Date.now()) {
      memoryCache.delete(key);
    }
    
    this.stats.misses++;
    this.updateHitRate();
    console.log(`❌ Cache MISS: ${key}`);
    return null;
  }

  /**
   * Set cached data with TTL
   */
  async set(key: string, data: any, ttl: number = 300): Promise<boolean> {
    // Try Redis first
    if (redisClient) {
      try {
        const serialized = JSON.stringify(data);
        await redisClient.setex(key, ttl, serialized);
        console.log(`💾 Redis Cache SET: ${key} (TTL: ${ttl}s)`);
        return true;
      } catch (error) {
        console.warn(`⚠️ Redis SET failed for ${key}, using memory cache`);
      }
    }
    
    // Fallback to memory cache
    try {
      const expires = Date.now() + (ttl * 1000);
      memoryCache.set(key, { data, expires });
      console.log(`💾 Memory Cache SET: ${key} (TTL: ${ttl}s)`);
      return true;
    } catch (error) {
      console.error(`❌ Memory Cache SET error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  async del(key: string): Promise<boolean> {
    // Try Redis first
    if (redisClient) {
      try {
        const result = await redisClient.del(key);
        console.log(`🗑️ Redis Cache DEL: ${key}`);
        return result > 0;
      } catch (error) {
        console.warn(`⚠️ Redis DEL failed for ${key}, trying memory cache`);
      }
    }
    
    // Fallback to memory cache
    try {
      const existed = memoryCache.has(key);
      memoryCache.delete(key);
      console.log(`🗑️ Memory Cache DEL: ${key}`);
      return existed;
    } catch (error) {
      console.error(`❌ Memory Cache DEL error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async delPattern(pattern: string): Promise<number> {
    // Try Redis first
    if (redisClient) {
      try {
        const keys = await redisClient.keys(pattern);
        if (keys.length === 0) return 0;
        
        const result = await redisClient.del(...keys);
        console.log(`🗑️ Redis Cache DEL pattern: ${pattern} (${result} keys deleted)`);
        return result;
      } catch (error) {
        console.warn(`⚠️ Redis DEL pattern failed for ${pattern}, trying memory cache`);
      }
    }
    
    // Fallback to memory cache (simple pattern matching)
    try {
      let deletedCount = 0;
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      
      for (const key of memoryCache.keys()) {
        if (regex.test(key)) {
          memoryCache.delete(key);
          deletedCount++;
        }
      }
      
      console.log(`🗑️ Memory Cache DEL pattern: ${pattern} (${deletedCount} keys deleted)`);
      return deletedCount;
    } catch (error) {
      console.error(`❌ Memory Cache DEL pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    // Try Redis first
    if (redisClient) {
      try {
        const result = await redisClient.exists(key);
        return result === 1;
      } catch (error) {
        console.warn(`⚠️ Redis EXISTS failed for ${key}, trying memory cache`);
      }
    }
    
    // Fallback to memory cache
    const memoryItem = memoryCache.get(key);
    if (memoryItem && memoryItem.expires > Date.now()) {
      return true;
    }
    
    // Clean expired memory cache
    if (memoryItem && memoryItem.expires <= Date.now()) {
      memoryCache.delete(key);
    }
    
    return false;
  }

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    // Try Redis first
    if (redisClient) {
      try {
        return await redisClient.ttl(key);
      } catch (error) {
        console.warn(`⚠️ Redis TTL failed for ${key}, trying memory cache`);
      }
    }
    
    // Fallback to memory cache
    const memoryItem = memoryCache.get(key);
    if (memoryItem) {
      const remaining = Math.ceil((memoryItem.expires - Date.now()) / 1000);
      return remaining > 0 ? remaining : -1;
    }
    
    return -1;
  }

  /**
   * Cache search results
   */
  async cacheSearchResults(
    query: string, 
    filters: any, 
    results: Recipe[], 
    ttl: number = CACHE_TTL.SEARCH_RESULTS
  ): Promise<boolean> {
    const filterString = JSON.stringify(filters);
    const key = CACHE_KEYS.SEARCH_RESULTS(query, filterString);
    return await this.set(key, results, ttl);
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(query: string, filters: any): Promise<Recipe[] | null> {
    const filterString = JSON.stringify(filters);
    const key = CACHE_KEYS.SEARCH_RESULTS(query, filterString);
    return await this.get<Recipe[]>(key);
  }

  /**
   * Cache recipe detail
   */
  async cacheRecipeDetail(recipeId: number, recipe: Recipe): Promise<boolean> {
    const key = CACHE_KEYS.RECIPE_DETAIL(recipeId);
    return await this.set(key, recipe, CACHE_TTL.RECIPE_DETAIL);
  }

  /**
   * Get cached recipe detail
   */
  async getCachedRecipeDetail(recipeId: number): Promise<Recipe | null> {
    const key = CACHE_KEYS.RECIPE_DETAIL(recipeId);
    return await this.get<Recipe>(key);
  }

  /**
   * Cache recipe list (paginated)
   */
  async cacheRecipeList(params: string, data: any, ttl: number = CACHE_TTL.RECIPE_LIST): Promise<boolean> {
    const key = CACHE_KEYS.RECIPE_LIST(params);
    return await this.set(key, data, ttl);
  }

  /**
   * Get cached recipe list
   */
  async getCachedRecipeList(params: string): Promise<any | null> {
    const key = CACHE_KEYS.RECIPE_LIST(params);
    return await this.get<any>(key);
  }

  /**
   * Invalidate all recipe list caches (called when any recipe is created/updated/deleted)
   */
  async invalidateRecipeListCaches(): Promise<number> {
    return await this.delPattern('recipes:list:*');
  }

  /**
   * Invalidate recipe-related caches
   */
  async invalidateRecipeCaches(recipeId: number): Promise<void> {
    try {
      // Delete recipe detail cache
      await this.del(CACHE_KEYS.RECIPE_DETAIL(recipeId));

      // Delete all search result caches (they might contain this recipe)
      await this.delPattern('search:*');

      // Delete popular and recent recipe caches
      await this.delPattern('popular:*');
      await this.delPattern('recent:*');

      // Delete recipe list caches (paginated lists)
      await this.delPattern('recipes:list:*');

      console.log(`🔄 Invalidated caches for recipe ${recipeId}`);
    } catch (error) {
      console.error(`❌ Error invalidating caches for recipe ${recipeId}:`, error);
    }
  }

  /**
   * Invalidate user-related caches
   */
  async invalidateUserCaches(userId: number): Promise<void> {
    try {
      await this.del(CACHE_KEYS.USER_FAVORITES(userId));
      console.log(`🔄 Invalidated caches for user ${userId}`);
    } catch (error) {
      console.error(`❌ Error invalidating caches for user ${userId}:`, error);
    }
  }

  /**
   * Warm up cache with popular recipes
   */
  async warmUpCache(): Promise<void> {
    try {
      console.log('🔥 Starting cache warm-up...');
      
      // This would typically fetch popular recipes and cache them
      // For now, we'll just log the warm-up process
      console.log('✅ Cache warm-up completed');
    } catch (error) {
      console.error('❌ Cache warm-up failed:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
    };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    if (this.stats.totalRequests > 0) {
      this.stats.hitRate = (this.stats.hits / this.stats.totalRequests) * 100;
    }
  }

  /**
   * Get Redis memory usage info
   */
  async getMemoryInfo(): Promise<any> {
    if (redisClient) {
      try {
        const info = await redisClient.memory('STATS');
        return info;
      } catch (error) {
        console.error('❌ Error getting Redis memory info:', error);
        return null;
      }
    }
    
    // Fallback: return memory cache info
    return {
      memoryCache: {
        size: memoryCache.size,
        keys: Array.from(memoryCache.keys())
      }
    };
  }

  /**
   * Clear all cache data (use with caution)
   */
  async clearAll(): Promise<boolean> {
    // Try Redis first
    if (redisClient) {
      try {
        await redisClient.flushdb();
        console.log('🧹 All Redis cache data cleared');
      } catch (error) {
        console.warn('⚠️ Redis flushdb failed, clearing memory cache');
      }
    }
    
    // Clear memory cache
    try {
      memoryCache.clear();
      console.log('🧹 All memory cache data cleared');
      return true;
    } catch (error) {
      console.error('❌ Error clearing memory cache:', error);
      return false;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;
