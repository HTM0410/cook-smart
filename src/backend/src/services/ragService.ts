/**
 * RAG Service using LangChain
 * Implements Retrieval-Augmented Generation for recipe chatbot with LangChain chains
 */

import { searchSimilar } from './vectorService';
import { getEmbedding, sendChatMessage, streamChatMessage } from './geminiService';
import { createRetriever } from './retriever';
import { createRAGChain, createConversationalRAGChain } from './ragChain';
import { rewriteAnswerWithLLM } from './ragPostProcessor';
import Recipe from '../models/Recipe';
import { Op } from 'sequelize';
import { sequelize } from '../config/database-supabase';
import { Document } from '@langchain/core/documents';
import { normalizeVietnamese } from './intent/normalizer';

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
const CONTEXT_TIMEOUT_MS = 15000;
const CHAT_TIMEOUT_MS = 25000;

// Stopwords để lọc ra khi extract keywords cho exact-match search
// Lưu ý: PHẢI được normalizeVietnamese() trước khi so sánh (lowercase + bỏ dấu)
const STOP_WORDS = new Set([
  // Đại từ, chỉ từ
  'món', 'mon', 'ăn', 'an', 'với', 'voi', 'cho', 'của', 'cua', 'tôi', 'toi',
  'bạn', 'ban', 'mình', 'minh', 'tớ', 'to', 'tao', 'tui',
  // Từ nối, trợ từ
  'gợi', 'goi', 'ý', 'y', 'và', 'va', 'hoặc', 'hoac', 'có', 'co', 'cần', 'can',
  'thì', 'thi', 'mà', 'ma', 'rằng', 'rang', 'nếu', 'neu', 'khi', 'lúc', 'luc',
  'là', 'la', 'như', 'nhu', 'nhé', 'nhe', 'vậy', 'vay', 'đây', 'day', 'đó', 'do',
  'rồi', 'roi', 'bằng', 'bang', 'từ', 'tu', 'trong', 'ngoài', 'ngoai', 'trên', 'tren',
  'dưới', 'duoi', 'nhiều', 'nhieu', 'ít', 'it', 'lắm', 'lam', 'quá', 'qua',
  'chỉ', 'chi', 'mỗi', 'moi', 'mọi', 'moi',
  // Động từ nấu ăn chung chung (không phải tên món)
  'cách', 'cach', 'làm', 'lam', 'nấu', 'nau', 'nào', 'nao', 'thế', 'the', 'sao',
  'gì', 'gi', 'để', 'de', 'ngon', 'công', 'cong', 'thức', 'thuc',
  'nướng', 'nuong', 'hấp', 'hap', 'chiên', 'chien', 'xào', 'xao', 'luộc', 'luoc',
  // Từ phổ biến trong query
  'chỉ', 'chi', 'đó', 'do', 'thôi', 'thoi', 'giúp', 'giup', 'tìm', 'tim',
  'muốn', 'muon', 'cần', 'can', 'nên', 'nen', 'phải', 'phai',
  'về', 've', 'cho', 'tôi', 'toi', 'mình', 'minh',
  'nhé', 'nhe', 'nha', 'ha',
]);

/**
 * Tách query thành các từ khóa tiềm năng để tìm recipe_name trong DB.
 *   "nấu phở bò" → ["phở", "bò"]
 *   "cách làm phở bò" → ["phở", "bò"]
 *   "Phở bò" → ["phở", "bò"]
 */
function extractDishKeywords(query: string): string[] {
  const normalized = normalizeVietnamese(query.toLowerCase());
  const tokens = normalized.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  // Nếu query ngắn (≤ 4 từ), dùng full token list thử exact match
  // Nếu dài (> 4), chỉ lấy cặp từ cuối + cuối-1 (thường là tên món)
  if (tokens.length <= 4) {
    return tokens;
  }

  // Lấy 2 cụm: toàn bộ tokens + cặp token cuối cùng (skip stopwords)
  const filtered = tokens.filter((t) => !STOP_WORDS.has(t));
  const last2 = filtered.slice(-2).join(' ');
  return [filtered.join(' '), last2];
}

/**
 * Tìm recipe theo tên chính xác (hoặc gần đúng) trong DB.
 * Trả về response trực tiếp nếu match chính xác 1 recipe.
 * Trả về null nếu không có → caller sẽ fallback sang RAG.
 *
 * Logic:
 *   1. Tách query thành keywords
 *   2. Search DB: recipe_name ILIKE '%kw1%' AND ILIKE '%kw2%' ...
 *   3. Nếu có đúng 1 recipe → trả về (không gọi LLM)
 *   4. Nếu > 1 → trả về null để RAG search
 */
async function tryExactRecipeMatch(query: string): Promise<RAGResponse | null> {
  try {
    const keywords = extractDishKeywords(query);
    if (keywords.length === 0) {
      return null;
    }

    // CRITICAL: use unaccent() so ILIKE works regardless of diacritics.
    // PostgreSQL ILIKE doesn't auto-remove diacritics, so "pho" wouldn't
    // match "Phở" without unaccent().
    const replacements: Record<string, string> = {};
    const clauses = keywords.map((kw, idx) => {
      replacements[`kw${idx}`] = `%${kw}%`;
      return `unaccent(r.recipe_name) ILIKE unaccent(:kw${idx})`;
    });

    // Query: tìm recipes có TẤT CẢ keywords xuất hiện trong recipe_name (accent-insensitive)
    const whereClause = clauses.join(' AND ');
    const [rows] = await sequelize.query(
      `SELECT r.id, r.recipe_name, r.description, r.prep_time, r.cook_time, r.difficulty, r.status
       FROM recipes r
       WHERE r.status = 'visible' AND ${whereClause}
       ORDER BY LENGTH(r.recipe_name) ASC, r.id ASC
       LIMIT 10`,
      { replacements }
    );

    const recipes = rows as any[];
    console.log(`[tryExactRecipeMatch] keywords=${JSON.stringify(keywords)}, rows=${recipes.length}, names=${JSON.stringify(recipes.slice(0,5).map(r => r.recipe_name))}`);
    if (recipes.length === 0) {
      return null;
    }

    // Ưu tiên recipe có tên NGẮN nhất (đã ORDER BY ở trên)
    const best = recipes[0];

    // Build response (NO LLM)
    const prepTime = (best.prep_time || 0) + (best.cook_time || 0);
    const lines: string[] = [];
    lines.push(`Đây là công thức **${best.recipe_name}** trong dữ liệu của CookSmart:`);
    if (best.description) {
      lines.push('');
      lines.push(String(best.description));
    }
    lines.push('');
    lines.push(`- Thời gian ước tính: ${prepTime} phút`);
    lines.push(`- Độ khó: ${best.difficulty}`);
    lines.push(`- Xem chi tiết: /recipes/${best.id}`);

    const text = lines.join('\n');

    return {
      text,
      sources: [
        {
          recipeId: best.id,
          recipeName: best.recipe_name,
          content: best.description || best.recipe_name,
          similarity: 1.0,
        },
      ],
    };
  } catch (error) {
    console.warn('⚠️ tryExactRecipeMatch failed, falling back to RAG:', (error as Error).message);
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

/**
 * Search fallback recipes when RAG fails (exported for reuse)
 *
 * Cải thiện ranking:
 *   - Recipe có TẤT CẢ keywords trong recipe_name → score cao nhất
 *   - Exact match (regex) cộng bonus lớn
 *   - Tên ngắn hơn được ưu tiên khi cùng score (loại bỏ "Phở bò bắp hoa" khi tìm "phở bò")
 */
export async function searchFallbackRecipes(query: string): Promise<RAGContext[]> {
  // Dùng extractDishKeywords (đã normalize + filter stopwords) để consistency
  // với tryExactRecipeMatch - cùng input sẽ cho cùng keywords.
  const rawKeywords = query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\uFFFD/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word))
    .slice(0, 6);

  try {
    if (rawKeywords.length === 0) {
      return [];
    }

    // CRITICAL: use unaccent() so we match "Phở" with keyword "pho" etc.
    // PostgreSQL ILIKE doesn't auto-remove Vietnamese diacritics.
    // Chỉ match recipe_name (bỏ description/ingredient_name) để tránh nhiễu.
    const replacements: Record<string, string | number> = { limit: 5 };
    const clauses = rawKeywords.map((keyword, index) => {
      replacements[`keyword${index}`] = `%${keyword}%`;
      return `unaccent(r.recipe_name) ILIKE unaccent(:keyword${index})`;
    });

    // Score: 10 điểm mỗi keyword có trong recipe_name (accent-insensitive)
    const scoreParts = rawKeywords.map((_, index) => `
      (CASE WHEN unaccent(r.recipe_name) ILIKE unaccent(:keyword${index}) THEN 10 ELSE 0 END)
    `);

    // Regex bonus: nếu recipe_name chứa toàn bộ keywords nối tiếp nhau (có thể kèm
    // giữa các từ khác) → bonus lớn. Ví dụ: "Phở bò bắp hoa" cho query "pho bo".
    let bonusExpr = '';
    if (rawKeywords.length >= 2) {
      const escapedKeywords = rawKeywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regexPattern = escapedKeywords.join('.*');
      bonusExpr = `
      + CASE WHEN unaccent(r.recipe_name) ~* '${regexPattern}' THEN 1000 ELSE 0 END
      `;
    } else if (rawKeywords.length === 1) {
      const escaped = rawKeywords[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      bonusExpr = `
      + CASE WHEN unaccent(r.recipe_name) ~* '\\m${escaped}\\M' THEN 500 ELSE 0 END
      `;
    }

    const matchExpression = clauses.length > 0 ? clauses.join(' OR ') : 'TRUE';
    const havingClause = `BOOL_OR(${matchExpression})`;
    const scoreExpression = `${scoreParts.join(' + ')}${bonusExpr}`;

    const [rows] = await sequelize.query(
      `
        SELECT
          r.id,
          r.recipe_name,
          r.description,
          r.prep_time,
          r.cook_time,
          r.difficulty,
          (${scoreExpression}) AS relevance_score,
          LENGTH(r.recipe_name) AS name_length
        FROM recipes r
        WHERE r.status = 'visible'
        GROUP BY r.id, r.recipe_name, r.description, r.prep_time, r.cook_time, r.difficulty
        HAVING ${havingClause}
        ORDER BY relevance_score DESC, name_length ASC, r.id ASC
        LIMIT :limit
      `,
      { replacements }
    );

    return (rows as any[]).map((recipe) => ({
      recipeId: recipe.id,
      recipeName: recipe.recipe_name,
      content: [
        recipe.description,
        `Thời gian dự kiến: ${(recipe.prep_time || 0) + (recipe.cook_time || 0)} phút`,
        `Độ khó: ${recipe.difficulty}`,
      ].filter(Boolean).join('\n'),
      similarity: Math.min(1, Number(recipe.relevance_score || 0) / 100),
    }));
  } catch (error) {
    console.error('Error searching fallback recipes:', error);
    return [];
  }
}

function formatSources(context: RAGContext[]): RAGResponse['sources'] {
  return context
    .filter((ctx) => ctx.recipeId !== undefined && ctx.recipeName !== undefined)
    .map((ctx) => ({
      recipeId: ctx.recipeId!,
      recipeName: ctx.recipeName!,
      content: ctx.content,
      similarity: ctx.similarity,
    }));
}

function buildFallbackResponse(query: string, context: RAGContext[], reason?: unknown): RAGResponse {
  const reasonText = reason instanceof Error ? reason.message : String(reason || '');
  const intro = reasonText.includes('GEMINI_API_KEY')
    ? 'Mình chưa được cấu hình khóa Gemini nên tạm thời không thể trả lời bằng AI đầy đủ.'
    : 'Mình đang gặp lỗi khi kết nối dịch vụ AI, nên sẽ trả lời bằng dữ liệu có sẵn trước nhé.';

  if (context.length > 0) {
    const recipeLines = context
      .slice(0, 5)
      .map((ctx, index) => `${index + 1}. ${ctx.recipeName}${ctx.content ? `\n${ctx.content}` : ''}`)
      .join('\n\n');

    return {
      text: `${intro}\n\nVới câu hỏi "${query}", bạn có thể tham khảo:\n\n${recipeLines}\n\nBạn có thể mở trang công thức để xem chi tiết nguyên liệu và các bước nấu.`,
      sources: formatSources(context),
    };
  }

  return {
    text: `${intro}\n\nBạn có thể hỏi mình theo dạng cụ thể hơn, ví dụ: "Gợi ý món với thịt gà", "Món nhanh trong 30 phút", hoặc "Cách nấu món chay dễ làm".`,
    sources: [],
  };
}

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
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = [],
  intentContext?: {
    recentMessages?: Array<{ role: 'user' | 'model'; content: string }>;
    currentDish?: string;
    currentIngredients?: string[];
    resolvedQuery?: string;
  }
): Promise<RAGResponse> {
  let context: RAGContext[] = [];

  try {
    console.log('🔍 Processing RAG query with LangChain:', query.substring(0, 50));

    // ⭐ Step 0 (NEW): Pre-check EXACT recipe match in DB → skip LLM entirely
    // Tránh Gemini hallucinate khi user hỏi món có trong DB (e.g. "phở bò", "bún chả")
    const exactMatch = await tryExactRecipeMatch(query);
    if (exactMatch) {
      console.log('✅ Exact recipe match in DB, rewriting via LLM post-process');
      const rewritten = await rewriteAnswerWithLLM({
        originalQuery: query,
        rawAnswer: exactMatch.text,
        recipes: exactMatch.sources,
        route: 'exact_match',
      });
      return { ...exactMatch, text: rewritten };
    }

    // Step 1: Retrieve relevant context
    context = await withTimeout(
      retrieveContext(query),
      CONTEXT_TIMEOUT_MS,
      'Timed out while retrieving recipe context'
    ).catch((error) => {
      console.error('Context retrieval timed out or failed:', error);
      return [];
    });

    if (context.length === 0) {
      context = await searchFallbackRecipes(query);
    }

    // Step 2: Build prompt with context
    let promptWithContext: string;
    if (intentContext && intentContext.recentMessages) {
      // Có conversation context → dùng RAG Prompt Builder
      const { buildRAGPrompt } = await import('./intent/ragPrompt');
      promptWithContext = buildRAGPrompt(query, {
        recentMessages: intentContext.recentMessages.map((m) => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.content,
          timestamp: 0,
        })),
        currentDish: intentContext.currentDish,
        currentIngredients: intentContext.currentIngredients || [],
        resolvedQuery: intentContext.resolvedQuery || query,
      });
    } else {
      promptWithContext = buildPromptWithContext(query, context);
    }

    // Step 3: Prepare messages for LLM
    const messages = [
      ...conversationHistory,
      { role: 'user' as const, content: promptWithContext },
    ];

    // Step 4: Generate response using LangChain
    const response = await withTimeout(
      sendChatMessage(messages, SYSTEM_PROMPT),
      CHAT_TIMEOUT_MS,
      'Timed out while generating chat response'
    );

    // Step 5: Format sources
    const sources = formatSources(context);

    // Step 6: Post-process via 1 lần LLM nhẹ để câu trả lời chuyên nghiệp hơn
    // (fail-safe: nếu timeout/lỗi sẽ tự trả về response.text nguyên bản)
    const finalText = await rewriteAnswerWithLLM({
      originalQuery: query,
      rawAnswer: response.text,
      recipes: sources,
      route: 'rag',
    });

    return {
      text: finalText,
      sources,
    };
  } catch (error) {
    console.error('❌ Error processing RAG query:', error);
    const fallbackContext = context.length > 0 ? context : await searchFallbackRecipes(query);
    return buildFallbackResponse(query, fallbackContext, error);
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
    const sources = formatSources(context);

    // Step 6: Post-process để câu trả lời chuyên nghiệp hơn (streaming đã flush xong rawText ở đây)
    const finalText = await rewriteAnswerWithLLM({
      originalQuery: query,
      rawAnswer: response.text,
      recipes: sources,
      route: 'rag_stream',
    });

    return {
      text: finalText,
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
