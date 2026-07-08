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
  const tokens = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  if (tokens.length === 0) return [];

  // Trả về nhiều candidate: full + các prefix liền kề để bắt tên món đầy đủ.
  //   "cách nấu phở bò bắp hoa" → ["phở bò bắp hoa", "phở bò bắp", "phở bò", "phở", "bò", "bắp", "hoa"]
  const candidates = new Set<string>();
  for (let i = tokens.length; i >= 1; i--) {
    candidates.add(tokens.slice(0, i).join(' '));
  }

  return Array.from(candidates);
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
    const candidates = extractDishKeywords(query);
    if (candidates.length === 0) {
      return null;
    }

    // Sắp xếp candidates: dài nhất trước (ưu tiên cụm cụ thể)
    const sortedCandidates = [...candidates].sort((a, b) => b.length - a.length);

    // Loại candidate quá ngắn (1-3 ký tự) để tránh match trùng lặp
    const usableCandidates = sortedCandidates.filter((c) => c.replace(/\s/g, '').length >= 4);
    if (usableCandidates.length === 0) return null;

    // CRITICAL: use unaccent() so ILIKE works regardless of diacritics.
    const replacements: Record<string, string> = {};
    const clauses = usableCandidates.map((cand, idx) => {
      replacements[`kw${idx}`] = `%${cand}%`;
      return `unaccent(r.recipe_name) ILIKE unaccent(:kw${idx})`;
    });

    // OR các candidates - lấy union recipes match bất kỳ candidate nào
    const whereClause = clauses.join(' OR ');
    const [rows] = await sequelize.query(
      `SELECT r.id, r.recipe_name, r.description, r.prep_time, r.cook_time, r.difficulty, r.status
       FROM recipes r
       WHERE r.status = 'visible' AND (${whereClause})
       ORDER BY LENGTH(r.recipe_name) ASC, r.id ASC
       LIMIT 20`,
      { replacements }
    );

    const recipes = rows as any[];
    if (recipes.length === 0) {
      console.log(`[tryExactRecipeMatch] no ILIKE match for candidates=${JSON.stringify(usableCandidates.slice(0,3))}`);
      return null;
    }

    // Match winner: candidate DÀI NHẤT có tokens đứng LIỀN KỀ (đúng thứ tự) trong recipe_name.
    //
    // Ví dụ query "cách nấu phở bò bắp hoa":
    //   candidates (length desc): ["phở bò bắp hoa", "phở bò bắp", "phở bò", "phở", "bò", "bắp", "hoa"]
    //   recipes (name length asc): ["Phở bò", "Phở bò bắp hoa", "Bò nướng lá cách", ...]
    //   → "phở bò bắp hoa" test trên "Phở bò bắp hoa" → match nguyên vẹn WINNER
    //   → "phở bò" test trên "Phở bò" → match ngắn hơn, không phải winner
    //   → "hoa" test trên "Bò nướng lá cách" → fail vì không có "hoa" đứng 1 mình
    let bestMatch: { recipe: any; candidateLength: number; matchedCandidate: string } | null = null;

    for (const candidate of usableCandidates) {
      const candidateNormalized = candidate;
      const candidateLength = candidateNormalized.replace(/\s/g, '').length;

      // Tối ưu: candidate này ngắn hơn bestMatch hiện tại thì không thể thắng → break
      if (bestMatch && candidateLength <= bestMatch.candidateLength) break;

      const tokens = candidateNormalized.split(/\s+/).filter(Boolean);
      if (tokens.length === 0) continue;

      // Build regex yêu cầu tokens đứng liền kề theo đúng thứ tự,
      // với word boundary ở đầu/cuối để tránh match 1 phần của từ khác.
      // VD: candidate "bánh" KHÔNG được match "bánh mì", "bánh hẹ" với \b boundaries.
      // Multi-token (>=2): cũng cần \b ở 2 đầu để match nguyên cụm.
      const escapedTokens = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regexPattern = `\\b${escapedTokens.join('\\s+')}\\b`;
      const regex = new RegExp(regexPattern, 'i');

      for (const recipe of recipes) {
        const recipeNameNormalized = normalizeVietnamese(recipe.recipe_name);
        if (regex.test(recipeNameNormalized)) {
          if (!bestMatch || candidateLength > bestMatch.candidateLength) {
            bestMatch = { recipe, candidateLength, matchedCandidate: candidate };
          }
        }
      }
    }

    if (!bestMatch) {
      console.log(`[tryExactRecipeMatch] no exact phrase match for candidates=${JSON.stringify(usableCandidates.slice(0,3))}, recipes=${recipes.map(r => r.recipe_name).join(', ')}`);
      return null;
    }

    const best = bestMatch.recipe;

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

    console.log(`[tryExactRecipeMatch] matched ${best.recipe_name} (id=${best.id}) for query=${query.substring(0, 50)} via candidate=${bestMatch.matchedCandidate}`);
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
