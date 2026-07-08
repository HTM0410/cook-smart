/**
 * Unit tests cho Session Store (in-memory)
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  getSessionContext,
  addMessageToSession,
  clearSessionContext,
  listActiveSessions,
  getActiveSessionCount,
  MAX_MESSAGES_PER_SESSION,
  MAX_ACTIVE_INGREDIENTS,
} from '../../services/intent/sessionStore';
import { ChatMessage } from '../../services/intent/types';

describe('SessionStore', () => {
  beforeEach(() => {
    // Xoá hết session giữa các test
    for (const sid of listActiveSessions()) {
      clearSessionContext(sid);
    }
  });

  describe('getSessionContext', () => {
    it('tạo mới session khi chưa tồn tại', () => {
      const ctx = getSessionContext('session-A');
      expect(ctx.sessionId).toBe('session-A');
      expect(ctx.messages).toEqual([]);
      expect(ctx.currentIngredients).toEqual([]);
      expect(ctx.currentDish).toBeUndefined();
      expect(ctx.lastActivityAt).toBeGreaterThan(0);
    });

    it('trả về cùng context khi gọi nhiều lần', () => {
      const ctx1 = getSessionContext('session-B');
      ctx1.currentDish = 'Phở bò';
      const ctx2 = getSessionContext('session-B');
      expect(ctx2.currentDish).toBe('Phở bò');
      expect(ctx2).toBe(ctx1);
    });

    it('cập nhật lastActivityAt khi gọi', async () => {
      const ctx1 = getSessionContext('session-C');
      const t1 = ctx1.lastActivityAt;
      await new Promise((r) => setTimeout(r, 5));
      const ctx2 = getSessionContext('session-C');
      expect(ctx2.lastActivityAt).toBeGreaterThanOrEqual(t1);
    });
  });

  describe('addMessageToSession', () => {
    it('thêm message vào session', () => {
      const msg: ChatMessage = {
        role: 'user',
        content: 'gợi ý món',
        timestamp: Date.now(),
      };
      addMessageToSession('session-D', msg);
      const ctx = getSessionContext('session-D');
      expect(ctx.messages.length).toBe(1);
      expect(ctx.messages[0].content).toBe('gợi ý món');
    });

    it('FIFO - giữ tối đa MAX_MESSAGES_PER_SESSION tin nhắn', () => {
      for (let i = 0; i < MAX_MESSAGES_PER_SESSION + 5; i++) {
        addMessageToSession('session-E', {
          role: 'user',
          content: `msg ${i}`,
          timestamp: Date.now(),
        });
      }
      const ctx = getSessionContext('session-E');
      expect(ctx.messages.length).toBe(MAX_MESSAGES_PER_SESSION);
      expect(ctx.messages[0].content).toBe('msg 5');
      expect(ctx.messages[ctx.messages.length - 1].content).toBe(
        `msg ${MAX_MESSAGES_PER_SESSION + 4}`,
      );
    });

    it('cập nhật currentDish từ assistant dishReferences', () => {
      addMessageToSession('session-F', {
        role: 'assistant',
        content: '1. Gà kho, 2. Gà xào',
        timestamp: Date.now(),
        metadata: { dishReferences: ['Gà kho', 'Gà xào'] },
      });
      const ctx = getSessionContext('session-F');
      expect(ctx.currentDish).toBe('Gà xào');
    });

    it('cập nhật currentIngredients - không trùng lặp', () => {
      addMessageToSession('session-G', {
        role: 'user',
        content: 'thịt gà, hành',
        timestamp: Date.now(),
        metadata: { entities: { ingredients: ['gà', 'hành'] } },
      });
      addMessageToSession('session-G', {
        role: 'user',
        content: 'thịt gà, tỏi',
        timestamp: Date.now(),
        metadata: { entities: { ingredients: ['gà', 'tỏi'] } },
      });
      const ctx = getSessionContext('session-G');
      expect(ctx.currentIngredients).toEqual(['gà', 'hành', 'tỏi']);
    });

    it('giữ tối đa MAX_ACTIVE_INGREDIENTS', () => {
      const ingredients = Array.from({ length: MAX_ACTIVE_INGREDIENTS + 3 }, (_, i) => `ngl-${i}`);
      addMessageToSession('session-H', {
        role: 'user',
        content: 'test',
        timestamp: Date.now(),
        metadata: { entities: { ingredients } },
      });
      const ctx = getSessionContext('session-H');
      expect(ctx.currentIngredients.length).toBe(MAX_ACTIVE_INGREDIENTS);
      expect(ctx.currentIngredients[ctx.currentIngredients.length - 1]).toBe(`ngl-${ingredients.length - 1}`);
    });
  });

  describe('clearSessionContext', () => {
    it('xoá session', () => {
      getSessionContext('session-I');
      expect(getActiveSessionCount()).toBeGreaterThan(0);
      clearSessionContext('session-I');
      const list = listActiveSessions();
      expect(list).not.toContain('session-I');
    });

    it('không lỗi khi xoá session không tồn tại', () => {
      expect(() => clearSessionContext('not-exist')).not.toThrow();
    });
  });

  describe('listActiveSessions / getActiveSessionCount', () => {
    it('liệt kê và đếm session active', () => {
      getSessionContext('a');
      getSessionContext('b');
      getSessionContext('c');
      expect(getActiveSessionCount()).toBe(3);
      expect(listActiveSessions().sort()).toEqual(['a', 'b', 'c']);
    });
  });
});