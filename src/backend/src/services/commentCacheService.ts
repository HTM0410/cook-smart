import { redisClient } from '../config/redis';
import Comment from '../models/Comment';
import CommentLike from '../models/CommentLike';

// Cache TTL (Time To Live) in seconds
const CACHE_TTL = {
  COMMENTS_LIST: 300, // 5 minutes
  COMMENT_DETAIL: 600, // 10 minutes
  USER_LIKES: 300, // 5 minutes
  POPULAR_RECIPES: 1800, // 30 minutes
};

// Cache key prefixes
const CACHE_KEYS = {
  COMMENTS: (recipeId: number, page: number, sortBy: string) => 
    `comments:recipe:${recipeId}:page:${page}:sort:${sortBy}`,
  COMMENT_DETAIL: (commentId: number) => `comment:${commentId}`,
  USER_LIKES: (userId: number, commentId: number) => `user:${userId}:likes:comment:${commentId}`,
  COMMENT_COUNT: (recipeId: number) => `comments:count:recipe:${recipeId}`,
  POPULAR_COMMENTS: (recipeId: number) => `comments:popular:recipe:${recipeId}`,
};

// In-memory cache fallback when Redis is not available
const memoryCache = new Map<string, { data: any; expiry: number }>();

/**
 * Comment Cache Service
 * Provides caching functionality for comment-related operations
 */
class CommentCacheService {
  private isRedisAvailable: boolean = false;

  constructor() {
    this.checkRedisConnection();
  }

  /**
   * Check if Redis is available
   */
  private async checkRedisConnection(): Promise<void> {
    if (!redisClient) {
      this.isRedisAvailable = false;
      return;
    }

    try {
      await redisClient.ping();
      this.isRedisAvailable = true;
      console.log('✅ Comment cache using Redis');
    } catch (error) {
      this.isRedisAvailable = false;
      console.log('⚠️ Comment cache using in-memory fallback');
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isRedisAvailable && redisClient) {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
      }

      // Fallback to memory cache
      const cached = memoryCache.get(key);
      if (cached && cached.expiry > Date.now()) {
        return cached.data;
      }
      if (cached) {
        memoryCache.delete(key);
      }
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set data in cache
   */
  async set(key: string, data: any, ttl: number): Promise<void> {
    try {
      if (this.isRedisAvailable && redisClient) {
        await redisClient.setex(key, ttl, JSON.stringify(data));
        return;
      }

      // Fallback to memory cache
      memoryCache.set(key, {
        data,
        expiry: Date.now() + ttl * 1000,
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete cache entry
   */
  async del(key: string | string[]): Promise<void> {
    try {
      if (this.isRedisAvailable && redisClient) {
        if (Array.isArray(key)) {
          if (key.length > 0) {
            await redisClient.del(...key);
          }
        } else {
          await redisClient.del(key);
        }
        return;
      }

      // Fallback to memory cache
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach(k => memoryCache.delete(k));
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete cache entries by pattern
   */
  async delPattern(pattern: string): Promise<void> {
    try {
      if (this.isRedisAvailable && redisClient) {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
        return;
      }

      // Fallback to memory cache
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      const keysToDelete: string[] = [];
      memoryCache.forEach((_, key) => {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => memoryCache.delete(key));
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Get comments for a recipe (cached)
   */
  async getCommentsForRecipe(
    recipeId: number,
    page: number,
    sortBy: string
  ): Promise<any | null> {
    const key = CACHE_KEYS.COMMENTS(recipeId, page, sortBy);
    return this.get(key);
  }

  /**
   * Set comments for a recipe in cache
   */
  async setCommentsForRecipe(
    recipeId: number,
    page: number,
    sortBy: string,
    data: any
  ): Promise<void> {
    const key = CACHE_KEYS.COMMENTS(recipeId, page, sortBy);
    await this.set(key, data, CACHE_TTL.COMMENTS_LIST);
  }

  /**
   * Invalidate all comment cache for a recipe
   */
  async invalidateRecipeComments(recipeId: number): Promise<void> {
    await this.delPattern(`comments:recipe:${recipeId}:*`);
  }

  /**
   * Get comment detail (cached)
   */
  async getCommentDetail(commentId: number): Promise<any | null> {
    const key = CACHE_KEYS.COMMENT_DETAIL(commentId);
    return this.get(key);
  }

  /**
   * Set comment detail in cache
   */
  async setCommentDetail(commentId: number, data: any): Promise<void> {
    const key = CACHE_KEYS.COMMENT_DETAIL(commentId);
    await this.set(key, data, CACHE_TTL.COMMENT_DETAIL);
  }

  /**
   * Invalidate comment detail cache
   */
  async invalidateCommentDetail(commentId: number): Promise<void> {
    const key = CACHE_KEYS.COMMENT_DETAIL(commentId);
    await this.del(key);
  }

  /**
   * Get user like status (cached)
   */
  async getUserLikeStatus(userId: number, commentId: number): Promise<boolean | null> {
    const key = CACHE_KEYS.USER_LIKES(userId, commentId);
    return this.get<boolean>(key);
  }

  /**
   * Set user like status in cache
   */
  async setUserLikeStatus(userId: number, commentId: number, isLiked: boolean): Promise<void> {
    const key = CACHE_KEYS.USER_LIKES(userId, commentId);
    await this.set(key, isLiked, CACHE_TTL.USER_LIKES);
  }

  /**
   * Invalidate user like status
   */
  async invalidateUserLikeStatus(userId: number, commentId: number): Promise<void> {
    const key = CACHE_KEYS.USER_LIKES(userId, commentId);
    await this.del(key);
  }

  /**
   * Get comment count for recipe (cached)
   */
  async getCommentCount(recipeId: number): Promise<number | null> {
    const key = CACHE_KEYS.COMMENT_COUNT(recipeId);
    return this.get<number>(key);
  }

  /**
   * Set comment count in cache
   */
  async setCommentCount(recipeId: number, count: number): Promise<void> {
    const key = CACHE_KEYS.COMMENT_COUNT(recipeId);
    await this.set(key, count, CACHE_TTL.COMMENTS_LIST);
  }

  /**
   * Increment comment count in cache
   */
  async incrementCommentCount(recipeId: number): Promise<void> {
    const count = await this.getCommentCount(recipeId);
    if (count !== null) {
      await this.setCommentCount(recipeId, count + 1);
    }
  }

  /**
   * Decrement comment count in cache
   */
  async decrementCommentCount(recipeId: number): Promise<void> {
    const count = await this.getCommentCount(recipeId);
    if (count !== null && count > 0) {
      await this.setCommentCount(recipeId, count - 1);
    }
  }

  /**
   * Warm up cache for popular recipes
   */
  async warmPopularRecipes(recipeIds: number[]): Promise<void> {
    console.log(`🔥 Warming cache for ${recipeIds.length} popular recipes...`);
    
    for (const recipeId of recipeIds) {
      try {
        // Cache first page of comments with default sorting
        const comments = await Comment.getCommentsByRecipe(recipeId, {
          page: 1,
          limit: 20,
          sortBy: 'newest',
          includeReplies: true,
          maxDepth: 3,
        });

        await this.setCommentsForRecipe(recipeId, 1, 'newest', comments);

        // Cache comment count
        const count = await Comment.count({
          where: { recipeId, parentId: null, isDeleted: false },
        });
        await this.setCommentCount(recipeId, count);

        console.log(`  ✅ Cached comments for recipe ${recipeId}`);
      } catch (error) {
        console.error(`  ❌ Failed to cache recipe ${recipeId}:`, error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    try {
      if (this.isRedisAvailable && redisClient) {
        const info = await redisClient.info('stats');
        const keyspace = await redisClient.info('keyspace');
        
        return {
          type: 'redis',
          available: true,
          info: {
            stats: info,
            keyspace: keyspace,
          },
        };
      }

      return {
        type: 'memory',
        available: true,
        entries: memoryCache.size,
        keys: Array.from(memoryCache.keys()),
      };
    } catch (error) {
      return {
        type: 'unknown',
        available: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Clear all comment-related cache
   */
  async clearAll(): Promise<void> {
    console.log('🗑️ Clearing all comment cache...');
    
    try {
      if (this.isRedisAvailable && redisClient) {
        const patterns = ['comments:*', 'comment:*', 'user:*:likes:*'];
        for (const pattern of patterns) {
          await this.delPattern(pattern);
        }
        console.log('✅ Redis cache cleared');
      } else {
        memoryCache.clear();
        console.log('✅ Memory cache cleared');
      }
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }
}

// Export singleton instance
export const commentCacheService = new CommentCacheService();
export default commentCacheService;
