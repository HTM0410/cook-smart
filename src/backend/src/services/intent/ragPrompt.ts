/**
 * RAG Prompt Builder
 *
 * Format prompt có:
 *   - System role: "Bạn là trợ lý CookSmart"
 *   - Current dish + ingredients đang active
 *   - Lịch sử hội thoại gần nhất (format User/Bot)
 *   - Câu hỏi hiện tại (đã resolve)
 *   - Yêu cầu: trả lời theo context, giữ ngắn gọn
 */

import { ConversationContext } from './contextBuilder';

export function buildRAGPrompt(
  query: string,
  context: ConversationContext,
): string {
  const {
    recentMessages,
    currentDish,
    currentIngredients,
    resolvedQuery,
  } = context;

  const historyText = recentMessages
    .map((m) => `${m.role === 'user' ? 'Người dùng' : 'CookSmart'}: ${m.content}`)
    .join('\n');

  const ingredientsText = currentIngredients.length > 0
    ? `Nguyên liệu đang thảo luận: ${currentIngredients.join(', ')}`
    : '';

  const dishText = currentDish ? `Món đang thảo luận: ${currentDish}` : '';

  const resolvedNote = query !== resolvedQuery
    ? `(Đã được resolve từ: "${query}")`
    : '';

  return `
Bạn là trợ lý CookSmart - chuyên về nấu ăn và dinh dưỡng Việt Nam.

${dishText}
${ingredientsText}

Lịch sử hội thoại gần đây:
${historyText || '(chưa có lịch sử)'}

Câu hỏi hiện tại: "${resolvedQuery}" ${resolvedNote}

Yêu cầu:
1. Trả lời dựa trên ngữ cảnh hội thoại (nếu có)
2. Nếu user dùng tham chiếu ("nó", "món đó", "món thứ 2"), hiểu là món trong context
3. Giữ câu trả lời ngắn gọn, thân thiện, bằng tiếng Việt
4. Khi gợi ý nhiều món, format: "1. Tên món, 2. Tên món, 3. Tên món" để user dễ chọn
5. Nếu thiếu thông tin, hỏi lại cụ thể thay vì đoán
`.trim();
}