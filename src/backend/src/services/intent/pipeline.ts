/**
 * Pipeline Orchestrator
 *
 * Flow đầy đủ:
 *   1. getSessionContext() → lấy session trong RAM
 *   2. classifyIntent() → phân loại (5 tiers + context awareness)
 *   3. routeByIntent() → chọn route (CANNED / DB_LOOKUP / RAG / CLARIFY / OFFTOPIC)
 *   4. Execute theo route:
 *      - CANNED → getCannedResponse()
 *      - OFFTOPIC_RESPONSE → getOfftopicResponse()
 *      - CLARIFY → getClarifyResponse()
 *      - DB_LOOKUP / RAG → processRAGQuery(resolvedQuery, history, context)
 *   5. extractDishReferences() từ response → lưu vào session
 *   6. addMessageToSession() cho cả user + assistant
 *
 * Logging mỗi bước để debug.
 */

import {
  getSessionContext,
  addMessageToSession,
  clearSessionContext,
} from './sessionStore';
import { classifyIntent } from './classifier';
import {
  routeByIntent,
  RouteType,
  getCannedResponse,
  getClarifyResponse,
  getOfftopicResponse,
} from './router';
import { buildConversationContext } from './contextBuilder';
import { ChatMessage, IntentResult, IntentType } from './types';
import { normalizeVietnamese } from './normalizer';

export interface PipelineResponse {
  intent: IntentResult;
  route: RouteType;
  text: string;
  sources?: any[];
  resolvedQuery?: string;
  dishReferences?: string[];
}

// Logger nhẹ - tránh phụ thuộc winston để test dễ
function logDecision(data: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log('[IntentClassifier]', JSON.stringify(data));
}

/**
 * Xử lý 1 message từ user: classify → route → action → save context.
 *
 * @param sessionId Session ID (DB) - convert sang string để dùng làm Map key
 * @param userQuery Câu hỏi gốc của user
 * @param ragProcessor Optional - function để gọi RAG (để tránh circular import)
 */
export async function processMessage(
  sessionId: string,
  userQuery: string,
  ragProcessor?: (
    query: string,
    history: Array<{ role: 'user' | 'model'; content: string }>,
    context?: any,
  ) => Promise<{ text: string; sources?: any[] }>,
): Promise<PipelineResponse> {
  // 1. Lấy session context
  const sessionCtx = getSessionContext(sessionId);
  const recentMessages = sessionCtx.messages.slice(-10);

  // 2. Build conversation context (để resolve tham chiếu)
  const convContext = buildConversationContext(recentMessages, userQuery);

  // 3. Classify intent (dùng resolvedQuery để context-aware hoạt động đúng)
  const intentResult = classifyIntent(convContext.resolvedQuery, recentMessages);

  // 4. Log decision
  logDecision({
    timestamp: new Date().toISOString(),
    rawQuery: userQuery,
    rawQueryHex: Buffer.from(userQuery, 'utf8').toString('hex'),
    normalized: normalizeVietnamese(userQuery),
    normalizedHex: Buffer.from(normalizeVietnamese(userQuery), 'utf8').toString('hex'),
    resolvedQuery: convContext.resolvedQuery,
    resolvedQueryHex: Buffer.from(convContext.resolvedQuery, 'utf8').toString('hex'),
    intent: intentResult.primaryIntent,
    confidence: intentResult.confidence,
    matchedTier: intentResult.matchedTier,
    hasContext: recentMessages.length > 0,
    contextSize: recentMessages.length,
  });

  // 5. Save user message vào session (in-memory)
  addMessageToSession(sessionId, {
    role: 'user',
    content: userQuery,
    timestamp: Date.now(),
    metadata: {
      intent: intentResult.primaryIntent,
      entities: intentResult.entities,
    },
  });

  // 6. Route
  const route = routeByIntent(intentResult);
  let responseText = '';
  let sources: any[] = [];

  switch (route) {
    case RouteType.CANNED:
      responseText = getCannedResponse(intentResult.primaryIntent);
      break;

    case RouteType.OFFTOPIC_RESPONSE:
      responseText = getOfftopicResponse();
      break;

    case RouteType.CLARIFY:
      responseText = getClarifyResponse();
      break;

    case RouteType.DB_LOOKUP:
    case RouteType.RAG: {
      if (ragProcessor) {
        const history = convertToGeminiHistory(recentMessages);
        try {
          const ragResp = await ragProcessor(
            convContext.resolvedQuery,
            history,
            convContext,
          );
          responseText = ragResp.text;
          sources = ragResp.sources || [];
        } catch (error) {
          responseText =
            'Xin lỗi, mình đang gặp chút vấn đề. Bạn thử lại sau nhé!';
          // eslint-disable-next-line no-console
          console.error('[pipeline] RAG error:', error);
        }
      } else {
        // Không có RAG processor (test mode) → trả response giả
        responseText = `[mock] Bạn hỏi: ${convContext.resolvedQuery}`;
      }
      break;
    }
  }

  // 7. Extract dishReferences từ response
  const dishRefs = extractDishReferences(responseText);

  // 8. Save assistant message vào session
  addMessageToSession(sessionId, {
    role: 'assistant',
    content: responseText,
    timestamp: Date.now(),
    metadata: {
      dishReferences: dishRefs,
    },
  });

  return {
    intent: intentResult,
    route,
    text: responseText,
    sources,
    resolvedQuery: convContext.resolvedQuery,
    dishReferences: dishRefs,
  };
}

function convertToGeminiHistory(
  messages: ChatMessage[],
): Array<{ role: 'user' | 'model'; content: string }> {
  return messages.map((m) => ({
    role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
    content: m.content,
  }));
}

/**
 * Trích dishReferences từ response text.
 * Pattern: "1. Tên món, 2. Tên món, 3. Tên món"
 */
export function extractDishReferences(responseText: string): string[] {
  if (!responseText) return [];

  // Match patterns: "1. Tên", "2. Tên", ...
  const regex = /(\d+)\.\s+([^,.\n]+)/g;
  const refs: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(responseText)) !== null) {
    const dish = match[2].trim();
    // Lọc: không quá ngắn (< 3 ký tự), không quá dài (< 50)
    if (dish.length >= 3 && dish.length <= 50) {
      refs.push(dish);
    }
  }

  return refs;
}

export { clearSessionContext };