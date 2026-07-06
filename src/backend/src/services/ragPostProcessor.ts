/**
 * RAG Post-Processor
 *
 * Sau khi ragService có câu trả lời "thô" (từ exact match hoặc Gemini RAG),
 * gọi 1 lần LLM nhẹ để viết lại câu trả lời cho chuyên nghiệp, gọn gàng,
 * thân thiện bằng tiếng Việt.
 *
 * Nguyên tắc:
 *   - Input: raw answer + context (danh sách recipes + original query)
 *   - Output: text đã được viết lại theo persona "concise, friendly Vietnamese"
 *   - Failsafe: nếu LLM fail / timeout > 1500ms → trả về raw answer nguyên bản
 *   - KHÔNG thêm thông tin ngoài context (tránh hallucination)
 */

import { sendChatMessage } from './geminiService';

export interface PostProcessContext {
  originalQuery: string;
  rawAnswer: string;
  recipes?: Array<{
    recipeId?: number;
    recipeName?: string;
    content?: string;
    similarity?: number;
  }>;
  route?: string; // 'exact_match' | 'rag' | 'fallback' | ...
}

const POST_PROCESS_TIMEOUT_MS = 1500;

const SYSTEM_PROMPT = `Bạn là trợ lý CookSmart - đầu bếp chuyên nghiệp, thân thiện, nói tiếng Việt.

Nhiệm vụ: VIẾT LẠI câu trả lời dưới đây cho người dùng.

Quy tắc bắt buộc:
1. CHỈ dùng thông tin có trong "Câu trả lời gốc" và "Danh sách công thức". KHÔNG tự bịa thêm nguyên liệu, bước nấu, calo hay số liệu khác.
2. Giữ ngắn gọn (tối đa ~120 từ), đi thẳng vào món ăn, ưu tiên 1-2 tip nấu ngon thực tế.
3. Giọng thân thiện, tự nhiên như đầu bếp tư vấn, dùng emoji vừa phải (0-2 emoji).
4. Nếu raw answer đã tự giới thiệu món + thời gian + độ khó → giữ format đó, chỉ làm mượt câu văn.
5. Nếu có nhiều món → liệt kê 3-5 món kèm 1 dòng mô tả ngắn cho mỗi món.
6. Luôn kết thúc bằng 1 gợi ý tiếp (ví dụ: "Bạn muốn xem chi tiết cách làm món nào?").

Định dạng: markdown ngắn gọn, KHÔNG block code, KHÔNG bảng dài.

Chỉ trả về câu trả lời đã viết lại, không giải thích gì thêm.`;

function buildUserPrompt(ctx: PostProcessContext): string {
  const recipesBlock =
    ctx.recipes && ctx.recipes.length > 0
      ? ctx.recipes
          .slice(0, 5)
          .map((r, i) => {
            const name = r.recipeName || `Món #${r.recipeId ?? i + 1}`;
            const desc = r.content ? `\n${r.content}` : '';
            return `- ${name}${desc}`;
          })
          .join('\n')
      : '(không có)';

  return `Câu hỏi của người dùng: "${ctx.originalQuery}"

Câu trả lời gốc cần viết lại:
"""
${ctx.rawAnswer}
"""

Danh sách công thức tham khảo:
${recipesBlock}

Hãy viết lại câu trả lời gốc theo đúng quy tắc đã nêu.`;
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
 * Viết lại câu trả lời RAG bằng 1 lần gọi LLM nhẹ.
 * Trả về raw answer nếu LLM lỗi/timeout (failsafe để không chặn user).
 */
export async function rewriteAnswerWithLLM(ctx: PostProcessContext): Promise<string> {
  // Skip nếu raw answer quá ngắn hoặc không có recipes → không đáng gọi LLM
  if (!ctx.rawAnswer || ctx.rawAnswer.trim().length < 10) {
    return ctx.rawAnswer;
  }

  try {
    const messages = [{ role: 'user' as const, content: buildUserPrompt(ctx) }];

    const response = await withTimeout(
      sendChatMessage(messages, SYSTEM_PROMPT),
      POST_PROCESS_TIMEOUT_MS,
      `Post-process timeout after ${POST_PROCESS_TIMEOUT_MS}ms`
    );

    const rewritten = response.text?.trim();
    if (!rewritten || rewritten.length < 5) {
      console.warn('[ragPostProcessor] LLM returned empty/short, using raw');
      return ctx.rawAnswer;
    }

    // Safety: nếu LLM trả về quá giống raw (no-op) thì vẫn OK, giữ nguyên
    // Safety: nếu rewritten dài bất thường (> 3x raw) → có thể bị lặp/loop, fallback
    if (rewritten.length > ctx.rawAnswer.length * 3 && ctx.rawAnswer.length > 50) {
      console.warn('[ragPostProcessor] rewritten suspiciously long, fallback to raw');
      return ctx.rawAnswer;
    }

    return rewritten;
  } catch (error) {
    console.warn('[ragPostProcessor] Failsafe → using raw answer:', (error as Error).message);
    return ctx.rawAnswer;
  }
}

export default {
  rewriteAnswerWithLLM,
};