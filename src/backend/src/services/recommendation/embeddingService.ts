/**
 * Embedding Service
 * Service để tạo và quản lý vector embeddings cho recipes
 * Sử dụng YOLO inference service endpoint hoặc local sentence-transformers
 */

import axios from 'axios';
import { Recipe, RecipeEmbedding, RecipeIngredient, Ingredient, RecipeCategory, sequelize } from '../../models';
import { Op } from 'sequelize';

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'http://localhost:8001';
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'BAAI/bge-m3';
const EMBEDDING_BATCH_SIZE = parseInt(process.env.EMBEDDING_BATCH_SIZE || '32', 10);

interface EmbeddingResult {
  vectors: number[][];
  model: string;
  dim: number;
  normalized: boolean;
}

class EmbeddingService {
  private apiUrl: string;
  private modelName: string;
  private batchSize: number;

  constructor() {
    this.apiUrl = EMBEDDING_API_URL;
    this.modelName = EMBEDDING_MODEL;
    this.batchSize = EMBEDDING_BATCH_SIZE;
  }

  /**
   * Tạo text content từ recipe metadata
   * Kết hợp recipe name, description, ingredients, categories
   */
  async generateRecipeTextContent(recipe: any): Promise<string> {
    const parts: string[] = [];

    // Thêm tên recipe
    if (recipe.recipeName) {
      parts.push(recipe.recipeName);
    }

    // Thêm description
    if (recipe.description) {
      parts.push(recipe.description);
    }

    // Thêm ingredients
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
      const ingredientNames = recipe.ingredients
        .map((ing: any) => ing.ingredientName || ing.ingredient_name)
        .filter(Boolean);
      if (ingredientNames.length > 0) {
        parts.push(`Nguyên liệu: ${ingredientNames.join(', ')}`);
      }
    }

    // Thêm categories
    if (recipe.categories && Array.isArray(recipe.categories)) {
      const categoryNames = recipe.categories
        .map((cat: any) => cat.categoryName || cat.category_name)
        .filter(Boolean);
      if (categoryNames.length > 0) {
        parts.push(`Danh mục: ${categoryNames.join(', ')}`);
      }
    }

    return parts.join('. ');
  }

  /**
   * Tạo embedding cho một text
   */
  async embedText(texts: string[]): Promise<number[][]> {
    try {
      const response = await axios.post<EmbeddingResult>(
        `${this.apiUrl}/embed`,
        { texts, model: this.modelName },
        {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (response.data && response.data.vectors) {
        return response.data.vectors;
      }

      throw new Error('Invalid embedding response');
    } catch (error: any) {
      console.error('[EmbeddingService] Failed to get embeddings from API:', error.message);
      
      // Fallback: return dummy embeddings for testing
      return texts.map(() => this.generateRandomEmbedding(1024));
    }
  }

  /**
   * Tạo embedding cho một recipe
   */
  async embedRecipe(recipeId: number): Promise<{ textContent: string; embedding: number[] } | null> {
    try {
      // Lấy recipe với ingredients và categories
      const recipe = await Recipe.findByPk(recipeId, {
        include: [
          { model: RecipeIngredient, as: 'ingredients', include: [{ model: Ingredient, as: 'ingredient' }] },
          { model: RecipeCategory, as: 'categories' },
        ],
      });

      if (!recipe) {
        console.warn(`[EmbeddingService] Recipe ${recipeId} not found`);
        return null;
      }

      // Tạo text content
      const textContent = await this.generateRecipeTextContent(recipe);

      // Tạo embedding
      const embeddingVectors = await this.embedText([textContent]);
      const embedding = embeddingVectors[0];

      // Lưu vào database
      await RecipeEmbedding.upsert({
        recipeId: recipe.id,
        embedding,
        content: textContent,
      });

      return { textContent, embedding };
    } catch (error: any) {
      console.error(`[EmbeddingService] Failed to embed recipe ${recipeId}:`, error.message);
      throw error;
    }
  }

  /**
   * Tạo embeddings cho tất cả recipes (batch processing)
   */
  async embedAllRecipes(limit?: number, offset: number = 0): Promise<{ processed: number; failed: number }> {
    const stats = { processed: 0, failed: 0 };

    try {
      // Lấy recipes chưa có embedding hoặc cần cập nhật
      const recipes = await Recipe.findAll({
        where: {
          status: 'visible',
          ...(limit && { limit, offset }),
        },
        include: [
          { model: RecipeIngredient, as: 'ingredients', include: [{ model: Ingredient, as: 'ingredient' }] },
          { model: RecipeCategory, as: 'categories' },
        ],
        order: [['id', 'ASC']],
      });

      console.log(`[EmbeddingService] Processing ${recipes.length} recipes...`);

      // Process in batches
      for (let i = 0; i < recipes.length; i += this.batchSize) {
        const batch = recipes.slice(i, i + this.batchSize);
        
        try {
          // Tạo text content cho batch
          const textContents = await Promise.all(
            batch.map((recipe) => this.generateRecipeTextContent(recipe))
          );

          // Tạo embeddings cho batch
          const embeddings = await this.embedText(textContents);

          // Lưu vào database
          await Promise.all(
            batch.map(async (recipe, idx) => {
              try {
          await RecipeEmbedding.upsert({
            recipeId: recipe.id,
            embedding: embeddings[idx],
            content: textContents[idx],
          });
                stats.processed++;
              } catch (err: any) {
                console.error(`[EmbeddingService] Failed to save embedding for recipe ${recipe.id}:`, err.message);
                stats.failed++;
              }
            })
          );

          console.log(`[EmbeddingService] Processed batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(recipes.length / this.batchSize)}`);
        } catch (error: any) {
          console.error(`[EmbeddingService] Batch processing error:`, error.message);
          stats.failed += batch.length;
        }
      }

      return stats;
    } catch (error: any) {
      console.error(`[EmbeddingService] Failed to embed all recipes:`, error.message);
      throw error;
    }
  }

  /**
   * Lấy embedding của một recipe
   */
  async getRecipeEmbedding(recipeId: number): Promise<{ recipeId: number; embedding: number[]; textContent: string } | null> {
    const result = await RecipeEmbedding.findOne({
      where: { recipeId },
    });

    if (result) {
      return {
        recipeId: result.recipeId,
        embedding: result.embedding,
        textContent: result.content,
      };
    }

    return null;
  }

  /**
   * Lấy embeddings của nhiều recipes
   */
  async getRecipeEmbeddings(recipeIds: number[]): Promise<Map<number, number[]>> {
    const results = await RecipeEmbedding.findAll({
      where: {
        recipeId: { [Op.in]: recipeIds },
      },
    });

    const embeddingMap = new Map<number, number[]>();
    results.forEach((r) => {
      embeddingMap.set(r.recipeId, r.embedding);
    });

    return embeddingMap;
  }

  /**
   * Xóa embedding của một recipe
   */
  async deleteRecipeEmbedding(recipeId: number): Promise<boolean> {
    const deleted = await RecipeEmbedding.destroy({
      where: { recipeId },
    });
    return deleted > 0;
  }

  /**
   * Tính cosine similarity giữa hai vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Tính cosine similarities với một query vector
   */
  async findSimilarRecipes(
    queryEmbedding: number[],
    recipeIds: number[],
    limit: number = 10
  ): Promise<{ recipeId: number; similarity: number }[]> {
    const embeddings = await this.getRecipeEmbeddings(recipeIds);
    const similarities: { recipeId: number; similarity: number }[] = [];

    for (const [recipeId, embedding] of embeddings) {
      const similarity = this.cosineSimilarity(queryEmbedding, embedding);
      similarities.push({ recipeId, similarity });
    }

    // Sort by similarity descending and return top N
    similarities.sort((a, b) => b.similarity - a.similarity);
    return similarities.slice(0, limit);
  }

  /**
   * Generate random embedding (fallback for testing)
   */
  private generateRandomEmbedding(dim: number): number[] {
    const embedding: number[] = [];
    let norm = 0;

    for (let i = 0; i < dim; i++) {
      const val = Math.random() * 2 - 1; // Random between -1 and 1
      embedding.push(val);
      norm += val * val;
    }

    // Normalize
    norm = Math.sqrt(norm);
    return embedding.map((v) => v / norm);
  }

  /**
   * Health check cho embedding service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, { timeout: 5000 });
      return response.data?.embedding_model_loaded === true;
    } catch (error) {
      console.warn('[EmbeddingService] Embedding API health check failed:', error);
      return false;
    }
  }
}

export const embeddingService = new EmbeddingService();
export default embeddingService;
