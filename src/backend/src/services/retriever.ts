/**
 * LangChain Retriever for Recipe Vector Store
 * Creates a retriever that integrates with LangChain
 */

import { Document } from '@langchain/core/documents';
import { searchSimilar } from './vectorService';
import { getEmbedding } from './geminiService';

export interface RetrieverConfig {
  k?: number;
  minSimilarity?: number;
  contentTypes?: string[];
}

const DEFAULT_K = 5;
const DEFAULT_MIN_SIMILARITY = 0.5;

/**
 * Create a custom LangChain retriever for recipe embeddings
 */
export function createRetriever(config: RetrieverConfig = {}) {
  const { k = DEFAULT_K, minSimilarity = DEFAULT_MIN_SIMILARITY, contentTypes } = config;

  return new RecipeRetriever(k, minSimilarity, contentTypes);
}

/**
 * Custom Retriever class for Recipe embeddings
 */
class RecipeRetriever {
  k: number;
  minSimilarity: number;
  contentTypes?: string[];
  
  constructor(k: number, minSimilarity: number, contentTypes?: string[]) {
    this.k = k;
    this.minSimilarity = minSimilarity;
    this.contentTypes = contentTypes;
  }

  async getRelevantDocuments(query: string): Promise<Document[]> {
    try {
      const { embedding } = await getEmbedding(query);

      const results = await searchSimilar(
        embedding,
        this.k,
        this.minSimilarity,
        this.contentTypes
      );

      return results.map((result) => 
        new Document({
          pageContent: result.content,
          metadata: {
            recipeId: result.recipeId,
            chunkIndex: result.chunkIndex,
            contentType: result.contentType,
            similarity: result.similarity,
          },
        })
      );
    } catch (error) {
      console.error('Error in RecipeRetriever:', error);
      return [];
    }
  }
}

export default createRetriever;
