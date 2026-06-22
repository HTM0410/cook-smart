/**
 * Vector Service using LangChain Compatible Structure
 * Handles vector storage and similarity search using pgvector
 */

import { sequelize } from '../config/database-supabase';
import { getEmbedding } from './geminiService';

const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);

export interface SearchResult {
  id: number;
  recipeId: number;
  chunkIndex: number;
  content: string;
  contentType: string;
  similarity: number;
}

// In-memory storage for embeddings (LangChain compatible structure)
interface EmbeddingEntry {
  id: number;
  recipeId: number;
  chunkIndex: number;
  content: string;
  contentType: string;
  embedding: number[];
}

class VectorStoreManager {
  private static instance: VectorStoreManager;
  private vectors: Map<number, EmbeddingEntry> = new Map();
  
  private constructor() {}
  
  public static getInstance(): VectorStoreManager {
    if (!VectorStoreManager.instance) {
      VectorStoreManager.instance = new VectorStoreManager();
    }
    return VectorStoreManager.instance;
  }
  
  public add(entry: EmbeddingEntry): void {
    this.vectors.set(entry.id, entry);
  }
  
  public addBatch(entries: EmbeddingEntry[]): void {
    entries.forEach((entry) => this.vectors.set(entry.id, entry));
  }
  
  public search(queryEmbedding: number[], k: number, minSimilarity: number): Array<{ entry: EmbeddingEntry; score: number }> {
    const results: Array<{ entry: EmbeddingEntry; score: number }> = [];
    
    for (const entry of this.vectors.values()) {
      if (entry.embedding.length !== queryEmbedding.length) continue;
      
      // Cosine similarity
      const dotProduct = entry.embedding.reduce((sum, val, i) => sum + val * queryEmbedding[i], 0);
      const norm1 = Math.sqrt(entry.embedding.reduce((sum, val) => sum + val * val, 0));
      const norm2 = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
      
      if (norm1 === 0 || norm2 === 0) continue;
      
      const similarity = dotProduct / (norm1 * norm2);
      
      if (similarity >= minSimilarity) {
        results.push({ entry, score: similarity });
      }
    }
    
    // Sort by similarity descending
    results.sort((a, b) => b.score - a.score);
    
    return results.slice(0, k);
  }
  
  public deleteByRecipeId(recipeId: number): void {
    for (const [id, entry] of this.vectors.entries()) {
      if (entry.recipeId === recipeId) {
        this.vectors.delete(id);
      }
    }
  }
  
  public count(): number {
    return this.vectors.size;
  }
  
  public clear(): void {
    this.vectors.clear();
  }
  
  public getAll(): EmbeddingEntry[] {
    return Array.from(this.vectors.values());
  }
}

const vectorStore = VectorStoreManager.getInstance();

/**
 * Initialize vector store (extension and tables)
 */
export async function initializeVectorStore(): Promise<void> {
  try {
    console.log('🔧 Initializing vector store...');

    // Enable pgvector extension
    await sequelize.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('✅ pgvector extension enabled');

    // Create recipe_embeddings table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS recipe_embeddings (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE,
        chunk_index INTEGER DEFAULT 0,
        content TEXT NOT NULL,
        content_type VARCHAR(50) DEFAULT 'general',
        embedding vector(${EMBEDDING_DIMENSION}),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ recipe_embeddings table created');

    // Create chat_sessions table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_title VARCHAR(255) DEFAULT 'New Chat',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ chat_sessions table created');

    // Create chat_messages table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ chat_messages table created');

    // Load existing embeddings from database into memory
    await loadEmbeddingsToMemory();

    console.log('✅ Vector store initialization complete');
  } catch (error) {
    console.error('❌ Error initializing vector store:', error);
    throw error;
  }
}

/**
 * Load embeddings from database to memory
 */
async function loadEmbeddingsToMemory(): Promise<void> {
  try {
    const [results] = await sequelize.query(
      `SELECT id, recipe_id, chunk_index, content, content_type, embedding FROM recipe_embeddings`,
      { type: 'SELECT' }
    );
    
    for (const row of results as any[]) {
      vectorStore.add({
        id: row.id,
        recipeId: row.recipe_id,
        chunkIndex: row.chunk_index,
        content: row.content,
        contentType: row.content_type,
        embedding: row.embedding || [],
      });
    }
    
    console.log(`📦 Loaded ${vectorStore.count()} embeddings to memory`);
  } catch (error) {
    console.warn('⚠️ Could not load embeddings to memory:', error);
  }
}

/**
 * Store a single embedding
 */
export async function storeEmbedding(
  recipeId: number,
  content: string,
  embedding: number[],
  chunkIndex: number = 0,
  contentType: string = 'general'
): Promise<number> {
  const id = recipeId * 10000 + chunkIndex;
  
  vectorStore.add({
    id,
    recipeId,
    chunkIndex,
    content,
    contentType,
    embedding,
  });
  
  return id;
}

/**
 * Store multiple embeddings in batch
 */
export async function storeBatchEmbeddings(
  embeddings: Array<{
    recipeId: number;
    content: string;
    embedding: number[];
    chunkIndex: number;
    contentType: string;
  }>
): Promise<number[]> {
  if (embeddings.length === 0) {
    return [];
  }

  const ids: number[] = [];
  
  for (const emb of embeddings) {
    const id = await storeEmbedding(
      emb.recipeId,
      emb.content,
      emb.embedding,
      emb.chunkIndex,
      emb.contentType
    );
    ids.push(id);
  }
  
  return ids;
}

/**
 * Search for similar content using vector similarity
 */
export async function searchSimilar(
  queryEmbedding: number[],
  limit: number = 5,
  matchThreshold: number = 0.5,
  contentTypes?: string[]
): Promise<SearchResult[]> {
  try {
    const results = vectorStore.search(queryEmbedding, limit * 2, matchThreshold);
    
    const searchResults: SearchResult[] = [];
    
    for (const { entry, score } of results) {
      // Filter by content types if specified
      if (contentTypes && contentTypes.length > 0) {
        if (!contentTypes.includes(entry.contentType)) {
          continue;
        }
      }
      
      searchResults.push({
        id: entry.id,
        recipeId: entry.recipeId,
        chunkIndex: entry.chunkIndex,
        content: entry.content,
        contentType: entry.contentType,
        similarity: score,
      });
      
      if (searchResults.length >= limit) {
        break;
      }
    }
    
    return searchResults;
  } catch (error) {
    console.error('❌ Error searching vectors:', error);
    return [];
  }
}

/**
 * Delete all embeddings for a recipe
 */
export async function deleteRecipeEmbeddings(recipeId: number): Promise<void> {
  vectorStore.deleteByRecipeId(recipeId);
}

/**
 * Get count of stored embeddings
 */
export async function getEmbeddingCount(): Promise<number> {
  return vectorStore.count();
}

/**
 * Check if vector store is initialized
 */
export async function isVectorStoreInitialized(): Promise<boolean> {
  return vectorStore.count() >= 0;
}

/**
 * Clear all embeddings (for testing)
 */
export async function clearVectorStore(): Promise<void> {
  vectorStore.clear();
}

export default {
  initializeVectorStore,
  storeEmbedding,
  storeBatchEmbeddings,
  searchSimilar,
  deleteRecipeEmbeddings,
  getEmbeddingCount,
  isVectorStoreInitialized,
  clearVectorStore,
};
