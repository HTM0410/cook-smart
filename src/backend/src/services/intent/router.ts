/**
 * Router - Phân luồng xử lý dựa trên IntentResult.
 *
 * RouteType:
 *   - CANNED           → trả lời mẫu cố định (greeting/farewell/thanks/...)
 *   - DB_LOOKUP        → query Recipe DB (nutrition, recipe_detail cụ thể)
 *   - RAG              → gọi Gemini RAG (recipe_search/substitute/variant)
 *   - CLARIFY          → hỏi user làm rõ
 *   - OFFTOPIC_RESPONSE → từ chối lịch sự, hướng về cooking
 */

import { IntentType, IntentResult } from './types';

export enum RouteType {
  CANNED = 'canned',
  DB_LOOKUP = 'db_lookup',
  RAG = 'rag',
  CLARIFY = 'clarify',
  OFFTOPIC_RESPONSE = 'offtopic_response',
}

const CANNED_RESPONSES: Record<IntentType, string[]> = {
  [IntentType.GREETING]: [
    'Xin chào bạn! Mình là trợ lý CookSmart, sẵn sàng giúp bạn tìm món ngon. Bạn muốn hỏi gì nào?',
    'Chào bạn! Hôm nay bạn muốn khám phá món gì?',
  ],
  [IntentType.FAREWELL]: [
    'Tạm biệt bạn! Chúc bạn nấu ăn vui vẻ nhé!',
    'Hẹn gặp lại bạn lần sau!',
  ],
  [IntentType.THANKS]: [
    'Không có gì bạn nhé! Bạn cần hỏi thêm gì không?',
    'Rất vui khi được giúp bạn!',
  ],
  [IntentType.WHO_ARE_YOU]: [
    'Mình là trợ lý nấu ăn CookSmart, được tạo ra để giúp bạn tìm công thức, gợi ý món ăn và trả lời các câu hỏi về nấu ăn.',
  ],
  [IntentType.HELP]: [
    'Mình có thể giúp bạn: gợi ý món ăn, hướng dẫn cách nấu, tìm nguyên liệu thay thế, hoặc cung cấp thông tin dinh dưỡng.',
  ],
  [IntentType.OFFTOPIC]: [],
  [IntentType.NUTRITION]: [],
  [IntentType.RECIPE_DETAIL]: [],
  [IntentType.RECIPE_SEARCH]: [],
  [IntentType.RECIPE_VARIANT]: [],
  [IntentType.RECIPE_SUBSTITUTE]: [],
  [IntentType.CLARIFY]: [],
};

/**
 * Quyết định route dựa trên intent result.
 * - confidence < 0.5 → CLARIFY (mặc dù tier đã chọn)
 */
export function routeByIntent(result: IntentResult): RouteType {
  if (result.confidence < 0.5) {
    return RouteType.CLARIFY;
  }

  switch (result.primaryIntent) {
    case IntentType.GREETING:
    case IntentType.FAREWELL:
    case IntentType.THANKS:
    case IntentType.WHO_ARE_YOU:
    case IntentType.HELP:
      return RouteType.CANNED;

    case IntentType.OFFTOPIC:
      return RouteType.OFFTOPIC_RESPONSE;

    case IntentType.NUTRITION:
      return RouteType.DB_LOOKUP;

    case IntentType.RECIPE_DETAIL:
      return RouteType.DB_LOOKUP; // Thử DB trước, fallback RAG

    case IntentType.RECIPE_SEARCH:
    case IntentType.RECIPE_VARIANT:
    case IntentType.RECIPE_SUBSTITUTE:
      return RouteType.RAG;

    case IntentType.CLARIFY:
    default:
      return RouteType.CLARIFY;
  }
}

export function getCannedResponse(intent: IntentType): string {
  const responses = CANNED_RESPONSES[intent];
  if (!responses || responses.length === 0) {
    return 'Xin lỗi, mình chưa hiểu ý bạn.';
  }
  return responses[Math.floor(Math.random() * responses.length)];
}

export function getClarifyResponse(): string {
  return 'Bạn có thể mô tả rõ hơn không? Ví dụ: "Gợi ý món từ thịt gà" hoặc "Cách làm phở bò".';
}

export function getOfftopicResponse(): string {
  return 'Mình là trợ lý nấu ăn nên chỉ hỗ trợ các câu hỏi về công thức, nguyên liệu, hoặc dinh dưỡng. Bạn có muốn hỏi về món ăn nào không?';
}