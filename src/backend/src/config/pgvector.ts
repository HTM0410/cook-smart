/**
 * pgvector configuration and helper functions for vector search
 * Uses Gemini embeddings API for creating vectors
 */

import { sequelize } from './database-supabase';

const EMBEDDING_DIMENSION = parseInt(process.env.EMBEDDING_DIMENSION || '768', 10);

/**
 * Enable pgvector extension and create required tables
 */
export async function initializeVectorStore(): Promise<void> {
  try {
    console.log('🔧 Initializing vector store...');

    // Enable pgvector extension
    await sequelize.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);
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

    // Create index for vector similarity search
    try {
      await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_recipe_embeddings_embedding 
        ON recipe_embeddings USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
      `);
      console.log('✅ Vector index created');
    } catch (indexError: any) {
      // Index might already exist or ivfflat not available
      console.log('⚠️ Vector index creation skipped:', indexError.message);
    }

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

    console.log('✅ Vector store initialization complete');
  } catch (error) {
    console.error('❌ Error initializing vector store:', error);
    throw error;
  }
}

/**
 * Perform vector similarity search using cosine distance
 */
export async function vectorSearch(
  queryEmbedding: number[],
  limit: number = 5,
  matchThreshold: number = 0.7
): Promise<Array<{
  id: number;
  recipe_id: number;
  chunk_index: number;
  content: string;
  content_type: string;
  similarity: number;
}>> {
  const embeddingStr = `[${queryEmbedding.join(',')}]`;
  
  const [results] = await sequelize.query(`
    SELECT 
      id,
      recipe_id,
      chunk_index,
      content,
      content_type,
      1 - (embedding <=> '${embeddingStr}'::vector) as similarity
    FROM recipe_embeddings
    WHERE 1 - (embedding <=> '${embeddingStr}'::vector) > ${matchThreshold}
    ORDER BY embedding <=> '${embeddingStr}'::vector
    LIMIT ${limit};
  `, {
    type: 'SELECT',
  });

  return results as any[];
}

/**
 * Insert a vector embedding into the database
 */
export async function insertEmbedding(
  recipeId: number,
  content: string,
  embedding: number[],
  chunkIndex: number = 0,
  contentType: string = 'general'
): Promise<number> {
  const embeddingStr = `[${embedding.join(',')}]`;
  
  const [result] = await sequelize.query(`
    INSERT INTO recipe_embeddings (recipe_id, chunk_index, content, content_type, embedding)
    VALUES (${recipeId}, ${chunkIndex}, $1, $2, '${embeddingStr}'::vector)
    RETURNING id;
  `, {
    replacements: [content, contentType],
    type: 'INSERT',
  });

  return (result as any)[0]?.id || 0;
}

/**
 * Delete all embeddings for a recipe
 */
export async function deleteRecipeEmbeddings(recipeId: number): Promise<void> {
  await sequelize.query(`
    DELETE FROM recipe_embeddings WHERE recipe_id = ${recipeId};
  `);
}

/**
 * Get embedding dimension
 */
export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}

export default {
  initializeVectorStore,
  vectorSearch,
  insertEmbedding,
  deleteRecipeEmbeddings,
  getEmbeddingDimension,
};
