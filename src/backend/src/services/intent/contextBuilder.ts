/**
 * Conversation Context Builder + Reference Resolver
 *
 * resolveReferences:
 *   - "món thứ N" → lấy món thứ N từ assistant's dishReferences gần nhất
 *   - "nó", "cái đó", "món đó", "món này" → thay bằng currentDish
 *   - "tiếp", "tiếp đi" → giữ nguyên (LLM tự hiểu)
 *
 * buildConversationContext:
 *   - Lấy N tin nhắn gần nhất từ session
 *   - Trích dishReferences, ingredients, previousIntent
 *   - Resolve tham chiếu để tạo resolvedQuery
 */

import { ChatMessage, IntentType } from './types';
import { REFERENCE_PRONOUNS } from './keywords';
import { normalizeVietnamese } from './normalizer';

export interface ConversationContext {
  recentMessages: ChatMessage[];
  currentDish?: string;
  currentIngredients: string[];
  previousIntent?: IntentType;
  resolvedQuery: string;
}

/**
 * Resolve các tham chiếu mơ hồ trong query dựa trên messages trước.
 * - "món thứ 2" → dish thứ 2 trong assistant's dishReferences gần nhất
 * - "nó", "cái đó", "món đó", "món này" → currentDish (món cuối)
 * Trả về query mới (đã resolve).
 */
export function resolveReferences(
  query: string,
  messages: ChatMessage[],
  knownDishes: string[],
): string {
  const normalizedQuery = normalizeVietnamese(query);
  console.log('[DEBUG resolveReferences] raw:', JSON.stringify(query), '→ normalized:', JSON.stringify(normalizedQuery), 'knownDishes:', JSON.stringify(knownDishes));

  // Pattern 1: "mon thu N" (normalized) - lấy món thứ N từ assistant gần nhất
  const nthMatch = normalizedQuery.match(/mon thu\s*(\d+)/);
  if (nthMatch) {
    const index = parseInt(nthMatch[1], 10) - 1; // 1-based → 0-based
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.metadata?.dishReferences) {
        const dishes = msg.metadata.dishReferences;
        if (index >= 0 && index < dishes.length) {
          // Replace trên normalized query
          return normalizedQuery.replace(
            new RegExp(escapeRegex(nthMatch[0]), 'i'),
            dishes[index],
          );
        }
      }
    }
  }

  // Pattern 2: Pronouns (đã normalized) → thay bằng currentDish
  if (knownDishes.length > 0) {
    const lastDish = knownDishes[knownDishes.length - 1];
    let resolved = normalizedQuery;
    let wasReplaced = false;

    for (const pronoun of REFERENCE_PRONOUNS) {
      const regex = new RegExp(`\\b${escapeRegex(pronoun)}\\b`, 'gi');
      if (regex.test(resolved)) {
        resolved = resolved.replace(regex, lastDish);
        wasReplaced = true;
      }
    }

    if (wasReplaced) return resolved;
  }

  // Không có tham chiếu → return normalized query
  return normalizedQuery;
}

/**
 * Escape regex special chars để dùng trong RegExp constructor an toàn.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build ConversationContext từ session messages + query hiện tại.
 */
export function buildConversationContext(
  sessionMessages: ChatMessage[],
  currentQuery: string,
): ConversationContext {
  // 1. Lấy N tin nhắn gần nhất (đã được SessionStore filter FIFO)
  const recentMessages = sessionMessages.slice(-10);

  // DEBUG
  console.log('[DEBUG buildConversationContext] recentMessages:',
    recentMessages.map((m) => m.role + ':' + JSON.stringify(m.content).substring(0, 80))
  );

  // 2. Trích entities từ tất cả messages
  const allDishes: string[] = [];
  const allIngredients = new Set<string>();
  let lastIntent: IntentType | undefined;

  for (const msg of recentMessages) {
    // dishReferences (chỉ từ assistant)
    if (msg.role === 'assistant' && msg.metadata?.dishReferences) {
      for (const dish of msg.metadata.dishReferences) {
        if (!allDishes.includes(dish)) allDishes.push(dish);
      }
    }
    // Ingredients (từ user hoặc assistant)
    if (msg.metadata?.entities?.ingredients) {
      for (const ing of msg.metadata.entities.ingredients) {
        allIngredients.add(ing);
      }
    }
    // Last intent (từ user message gần nhất)
    if (msg.role === 'user' && msg.metadata?.intent) {
      lastIntent = msg.metadata.intent;
    }
  }

  // 3. Resolve tham chiếu
  const resolvedQuery = resolveReferences(
    currentQuery,
    recentMessages,
    allDishes,
  );

  return {
    recentMessages,
    currentDish: allDishes[allDishes.length - 1],
    currentIngredients: Array.from(allIngredients),
    previousIntent: lastIntent,
    resolvedQuery,
  };
}