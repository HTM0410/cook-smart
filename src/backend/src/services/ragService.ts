/**
 * RAG Service using LangChain
 * Implements Retrieval-Augmented Generation for recipe chatbot with LangChain chains
 */

import { searchSimilar } from './vectorService';
import { getEmbedding, sendChatMessage, streamChatMessage } from './geminiService';
import { createRetriever } from './retriever';
import { createRAGChain, createConversationalRAGChain } from './ragChain';
import Recipe from '../models/Recipe';
import { sequelize } from '../config/database-supabase';
import { Document } from '@langchain/core/documents';

export interface RAGContext {
  recipeId?: number;
  recipeName?: string;
  content: string;
  similarity: number;
}

export interface RAGResponse {
  text: string;
  sources: Array<{
    recipeId: number;
    recipeName: string;
    content: string;
    similarity: number;
  }>;
}

/**
 * System prompt for the recipe chatbot
 */
const SYSTEM_PROMPT = `Bạn là một trợ lý nấu ăn thông minh của ứng dụng CookSmart. 
Nhiệm vụ của bạn là giúp người dùng:
1. Tìm kiếm và gợi ý công thức nấu ăn
2. Hướng dẫn cách chế biến món ăn
3. Trả lời các câu hỏi về nguyên liệu và cách nấu
4. Đề xuất món ăn phù hợp với khẩu vị và điều kiện của người dùng

Hãy trả lời bằng tiếng Việt, thân thiện và nhiệt tình.
Chỉ đề xuất các công thức có trong dữ liệu của chúng tôi.
Nếu không có thông tin, hãy nói rõ là bạn không biết.

Khi đề cập đến công thức, hãy bao gồm:
- Tên công thức
- Thành phần chính
- Thời gian nấu ước tính
- Link đến công thức đầy đủ nếu có thể`;

const MAX_CONTEXT_CHUNKS = 5;
const MIN_SIMILARITY = 0.5;

/**
 * Get recipe names for search results
 */
async function getRecipeNames(recipeIds: number[]): Promise<Map<number, string>> {
  if (recipeIds.length === 0) {
    return new Map();
  }

  const placeholders = recipeIds.map((_, i) => `$${i + 1}`).join(', ');

  try {
    const [results] = await sequelize.query(
      `SELECT id, recipe_name FROM recipes WHERE id IN (${placeholders})`,
      {
        replacements: recipeIds,
        type: 'SELECT',
      }
    );

    return new Map((results as any[]).map((r) => [r.id, r.recipe_name]));
  } catch (error) {
    console.error('Error fetching recipe names:', error);
    return new Map();
  }
}

/**
 * Retrieve relevant context from the vector store
 */
async function retrieveContext(query: string, limit: number = MAX_CONTEXT_CHUNKS): Promise<RAGContext[]> {
  try {
    // Generate embedding for the query
    const { embedding } = await getEmbedding(query);

    // Search for similar content
    const searchResults = await searchSimilar(embedding, limit, MIN_SIMILARITY);

    if (searchResults.length === 0) {
      console.log('⚠️ No similar content found for query:', query.substring(0, 50));
      return [];
    }

    // Get recipe names
    const recipeIds = [...new Set(searchResults.map((r) => r.recipeId))];
    const recipeMap = await getRecipeNames(recipeIds);

    return searchResults.map((result) => ({
      recipeId: result.recipeId,
      recipeName: recipeMap.get(result.recipeId) || 'Unknown Recipe',
      content: result.content,
      similarity: result.similarity,
    }));
  } catch (error) {
    console.error('❌ Error retrieving context:', error);
    return [];
  }
}

/**
 * Build prompt with retrieved context (for non-chain version)
 */
function buildPromptWithContext(query: string, context: RAGContext[]): string {
  if (context.length === 0) {
    return query;
  }

  const contextSection = context
    .map(
      (ctx, index) =>
        `[Nguồn ${index + 1} - Công thức: ${ctx.recipeName}]\n${ctx.content}`
    )
    .join('\n\n');

  return `Dựa trên các thông tin sau đây về công thức nấu ăn, hãy trả lời câu hỏi của người dùng:

=== NGỮ CẢNH ===
${contextSection}
=== HẾT NGỮ CẢNH ===

Câu hỏi của người dùng: ${query}

Hãy trả lời dựa trên ngữ cảnh được cung cấp ở trên. Nếu câu hỏi không liên quan đến công thức nấu ăn, hãy trả lời một cách tự nhiên nhưng vẫn cố gắng liên quan đến ẩm thực.`;
}

/**
 * Process a RAG query using LangChain chain
 */
export async function processRAGQuery(
  query: string,
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = []
): Promise<RAGResponse> {
  try {
    console.log('🔍 Processing RAG query with LangChain:', query.substring(0, 50));

    // Step 1: Retrieve relevant context
    const context = await retrieveContext(query);

    // Step 2: Build prompt with context
    const promptWithContext = buildPromptWithContext(query, context);

    // Step 3: Prepare messages for LLM
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: promptWithContext },
    ];

    // Step 4: Generate response using LangChain
    const response = await sendChatMessage(messages, SYSTEM_PROMPT);

    // Step 5: Format sources
    const sources = context
      .filter((ctx) => ctx.recipeId !== undefined && ctx.recipeName !== undefined)
      .map((ctx) => ({
        recipeId: ctx.recipeId!,
        recipeName: ctx.recipeName!,
        content: ctx.content,
        similarity: ctx.similarity,
      }));

    return {
      text: response.text,
      sources,
    };
  } catch (error) {
    console.error('❌ Error processing RAG query:', error);
    throw error;
  }
}

/**
 * Process a streaming RAG query using LangChain
 */
export async function processStreamingRAGQuery(
  query: string,
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = [],
  onChunk?: (text: string) => void
): Promise<RAGResponse> {
  try {
    console.log('🔍 Processing streaming RAG query with LangChain:', query.substring(0, 50));

    // Step 1: Retrieve relevant context
    const context = await retrieveContext(query);

    // Step 2: Build prompt with context
    const promptWithContext = buildPromptWithContext(query, context);

    // Step 3: Prepare messages for LLM
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: promptWithContext },
    ];

    // Step 4: Generate streaming response using LangChain
    const response = await streamChatMessage(messages, SYSTEM_PROMPT, onChunk);

    // Step 5: Format sources
    const sources = context
      .filter((ctx) => ctx.recipeId !== undefined && ctx.recipeName !== undefined)
      .map((ctx) => ({
        recipeId: ctx.recipeId!,
        recipeName: ctx.recipeName!,
        content: ctx.content,
        similarity: ctx.similarity,
      }));

    return {
      text: response.text,
      sources,
    };
  } catch (error) {
    console.error('❌ Error processing streaming RAG query:', error);
    throw error;
  }
}

/**
 * Generate a suggested conversation starter based on available recipes
 */
export async function generateSuggestedQuestions(): Promise<string[]> {
  const suggestions = [
    'Món ăn nào dễ nấu cho người mới bắt đầu?',
    'Gợi ý công thức với nguyên liệu gà và rau',
    'Các món ăn nhanh có thể nấu trong 30 phút?',
    'Món ăn Việt Nam nào được nhiều người yêu thích?',
  ];

  return suggestions;
}

export default {
  processRAGQuery,
  processStreamingRAGQuery,
  generateSuggestedQuestions,
};
