/**
 * Embedding Service using LangChain
 * Handles text chunking and embedding generation for recipes
 */

import { getEmbedding, getBatchEmbeddings } from './geminiService';

export interface TextChunk {
  text: string;
  chunkIndex: number;
  contentType: 'title' | 'description' | 'ingredient' | 'step' | 'category';
  metadata?: Record<string, any>;
}

export interface RecipeContent {
  recipeId: number;
  recipeName: string;
  description?: string;
  ingredients?: Array<{ name: string; quantity?: string; unit?: string }>;
  steps?: Array<{ stepNumber: number; instruction: string }>;
  categories?: string[];
}

/**
 * Chunk recipe content into smaller pieces for embedding
 */
export function chunkRecipeContent(recipe: RecipeContent): TextChunk[] {
  const chunks: TextChunk[] = [];
  let chunkIndex = 0;

  // Title chunk
  if (recipe.recipeName) {
    chunks.push({
      text: `Công thức: ${recipe.recipeName}. ${recipe.description || ''}`.trim(),
      chunkIndex: chunkIndex++,
      contentType: 'title',
      metadata: { recipeId: recipe.recipeId, recipeName: recipe.recipeName },
    });
  }

  // Description chunk
  if (recipe.description && recipe.description.length > 50) {
    chunks.push({
      text: `Mô tả công thức ${recipe.recipeName}: ${recipe.description}`,
      chunkIndex: chunkIndex++,
      contentType: 'description',
      metadata: { recipeId: recipe.recipeId },
    });
  }

  // Ingredient chunks
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    const ingredientTexts = recipe.ingredients.map((ing) => {
      const qty = ing.quantity ? `${ing.quantity} ${ing.unit || ''}` : '';
      return `${ing.name}${qty ? ` - ${qty.trim()}` : ''}`;
    });

    // Group ingredients into chunks of ~10 items
    const groupSize = 10;
    for (let i = 0; i < ingredientTexts.length; i += groupSize) {
      const group = ingredientTexts.slice(i, i + groupSize);
      chunks.push({
        text: `Nguyên liệu cho công thức ${recipe.recipeName}: ${group.join(', ')}.`,
        chunkIndex: chunkIndex++,
        contentType: 'ingredient',
        metadata: { recipeId: recipe.recipeId },
      });
    }
  }

  // Step chunks
  if (recipe.steps && recipe.steps.length > 0) {
    for (const step of recipe.steps) {
      if (step.instruction) {
        chunks.push({
          text: `Bước ${step.stepNumber} - ${recipe.recipeName}: ${step.instruction}`,
          chunkIndex: chunkIndex++,
          contentType: 'step',
          metadata: { recipeId: recipe.recipeId, stepNumber: step.stepNumber },
        });
      }
    }
  }

  // Category chunk
  if (recipe.categories && recipe.categories.length > 0) {
    chunks.push({
      text: `Danh mục công thức ${recipe.recipeName}: ${recipe.categories.join(', ')}.`,
      chunkIndex: chunkIndex++,
      contentType: 'category',
      metadata: { recipeId: recipe.recipeId },
    });
  }

  return chunks;
}

/**
 * Generate embeddings for text chunks using LangChain
 */
export async function generateEmbeddingsForChunks(
  chunks: TextChunk[]
): Promise<Array<{ chunk: TextChunk; embedding: number[] }>> {
  if (chunks.length === 0) {
    return [];
  }

  // Get texts for batch processing
  const texts = chunks.map((c) => c.text);

  // Batch embeddings via LangChain
  const results = await getBatchEmbeddings(texts);

  return chunks.map((chunk, index) => ({
    chunk,
    embedding: results[index]?.embedding || [],
  }));
}

/**
 * Generate embedding for a single text using LangChain
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const result = await getEmbedding(text);
  return result.embedding;
}

/**
 * Create embedding content from recipe data
 */
export function createEmbeddingContent(recipe: RecipeContent): string {
  const parts: string[] = [];

  parts.push(`Công thức: ${recipe.recipeName}`);

  if (recipe.description) {
    parts.push(`Mô tả: ${recipe.description}`);
  }

  if (recipe.categories && recipe.categories.length > 0) {
    parts.push(`Danh mục: ${recipe.categories.join(', ')}`);
  }

  if (recipe.ingredients && recipe.ingredients.length > 0) {
    const ingredientList = recipe.ingredients
      .map((ing) => {
        const qty = ing.quantity ? `${ing.quantity} ${ing.unit || ''}` : '';
        return `${ing.name}${qty ? ` (${qty.trim()})` : ''}`;
      })
      .join(', ');
    parts.push(`Nguyên liệu: ${ingredientList}`);
  }

  if (recipe.steps && recipe.steps.length > 0) {
    const stepList = recipe.steps
      .map((s) => `Bước ${s.stepNumber}: ${s.instruction}`)
      .join(' | ');
    parts.push(`Các bước thực hiện: ${stepList}`);
  }

  return parts.join('. ');
}

export default {
  chunkRecipeContent,
  generateEmbeddingsForChunks,
  generateEmbedding,
  createEmbeddingContent,
};
