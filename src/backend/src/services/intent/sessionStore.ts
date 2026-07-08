/**
 * Session Store (In-Memory)
 *
 * Lưu conversation context trong RAM của 1 server instance.
 * - Auto cleanup session quá hạn (mặc định 30 phút không hoạt động)
 * - Giữ tối đa N tin nhắn gần nhất (FIFO)
 * - KHÔNG lưu DB dài hạn - khi restart server sẽ mất context
 *
 * Khi nào cần nâng cấp:
 *   - Multi-server (cần Redis shared)
 *   - Lưu lịch sử lâu dài (cần DB)
 *   - Phân tích log hội thoại (cần DB)
 */

import { ChatMessage, IntentType, SessionContext } from './types';

// Config
export const MAX_MESSAGES_PER_SESSION = 10;
export const SESSION_TTL_MS = 30 * 60 * 1000;        // 30 phút
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;    // 5 phút quét 1 lần
export const MAX_ACTIVE_INGREDIENTS = 5;

const sessionStore = new Map<string, SessionContext>();

/**
 * Lấy context của session. Nếu chưa có → tạo mới.
 * Mỗi lần gọi sẽ tự cập nhật `lastActivityAt`.
 */
export function getSessionContext(sessionId: string): SessionContext {
  let ctx = sessionStore.get(sessionId);

  if (!ctx) {
    ctx = {
      sessionId,
      messages: [],
      currentIngredients: [],
      lastActivityAt: Date.now(),
    };
    sessionStore.set(sessionId, ctx);
  } else {
    ctx.lastActivityAt = Date.now();
  }

  return ctx;
}

/**
 * Thêm 1 message vào session. Tự cập nhật:
 *   - FIFO: nếu quá MAX_MESSAGES_PER_SESSION thì bỏ message cũ nhất
 *   - currentDish: lấy món cuối từ assistant's dishReferences
 *   - currentIngredients: thêm nguyên liệu mới (không trùng), giữ tối đa MAX_ACTIVE_INGREDIENTS
 */
export function addMessageToSession(
  sessionId: string,
  message: ChatMessage,
): void {
  const ctx = getSessionContext(sessionId);
  ctx.messages.push(message);

  // FIFO - giữ tối đa N tin nhắn
  if (ctx.messages.length > MAX_MESSAGES_PER_SESSION) {
    ctx.messages.shift();
  }

  // Cập nhật currentDish
  if (message.metadata?.dishReferences && message.metadata.dishReferences.length > 0) {
    ctx.currentDish = message.metadata.dishReferences[message.metadata.dishReferences.length - 1];
  }

  // Cập nhật currentIngredients (chỉ thêm, không trùng)
  if (message.metadata?.entities?.ingredients) {
    const newIngredients = message.metadata.entities.ingredients.filter(
      (i: string) => !ctx.currentIngredients.includes(i),
    );
    ctx.currentIngredients.push(...newIngredients);

    if (ctx.currentIngredients.length > MAX_ACTIVE_INGREDIENTS) {
      ctx.currentIngredients = ctx.currentIngredients.slice(-MAX_ACTIVE_INGREDIENTS);
    }
  }
}

/**
 * Xoá toàn bộ context của 1 session.
 * Gọi khi user logout / clear chat / đóng tab.
 */
export function clearSessionContext(sessionId: string): void {
  sessionStore.delete(sessionId);
}

/**
 * Lấy danh sách sessionId đang active (cho monitoring / debug).
 */
export function listActiveSessions(): string[] {
  return Array.from(sessionStore.keys());
}

/**
 * Đếm số session đang active.
 */
export function getActiveSessionCount(): number {
  return sessionStore.size;
}

// Auto cleanup mỗi CLEANUP_INTERVAL_MS - xóa session hết hạn
let cleanupTimer: NodeJS.Timeout | null = null;

export function startSessionCleanup(): void {
  if (cleanupTimer) return;

  cleanupTimer = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [sessionId, ctx] of sessionStore.entries()) {
      if (now - ctx.lastActivityAt > SESSION_TTL_MS) {
        sessionStore.delete(sessionId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      // eslint-disable-next-line no-console
      console.log(`[sessionStore] Cleaned up ${cleaned} expired session(s)`);
    }
  }, CLEANUP_INTERVAL_MS);
}

export function stopSessionCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

// Tự động start cleanup khi module được load (an toàn - process exit sẽ kill timer)
startSessionCleanup();