/**
 * E2E Pipeline Tests
 * Test toàn bộ pipeline với mock RAG processor
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  processMessage,
  extractDishReferences,
} from '../../services/intent/pipeline';
import {
  getSessionContext,
  clearSessionContext,
  listActiveSessions,
} from '../../services/intent/sessionStore';
import { addMessageToSession } from '../../services/intent/sessionStore';
import { IntentType } from '../../services/intent/types';
import { RouteType } from '../../services/intent/router';

describe('extractDishReferences', () => {
  it('extract từ response format "1. A, 2. B, 3. C"', () => {
    const refs = extractDishReferences(
      'Gợi ý cho bạn: 1. Gà kho gừng, 2. Gà xào hành tây, 3. Gà nướng mật ong',
    );
    expect(refs).toEqual(['Gà kho gừng', 'Gà xào hành tây', 'Gà nướng mật ong']);
  });

  it('return [] cho text không có pattern', () => {
    expect(extractDishReferences('Phở bò ngon')).toEqual([]);
  });

  it('lọc dish name quá ngắn (< 3 chars)', () => {
    const refs = extractDishReferences('1. AB, 2. Cơm tấm');
    // "AB" bị lọc vì < 3 ký tự
    expect(refs).toEqual(['Cơm tấm']);
  });
});

describe('Pipeline E2E', () => {
  beforeEach(() => {
    for (const sid of listActiveSessions()) {
      clearSessionContext(sid);
    }
  });

  it('"xin chào" → CANNED route, không gọi RAG', async () => {
    const ragCalls: any[] = [];
    const result = await processMessage('s1', 'xin chào', async (q, h) => {
      ragCalls.push(q);
      return { text: 'RAG called', sources: [] };
    });
    expect(result.route).toBe(RouteType.CANNED);
    expect(result.intent.primaryIntent).toBe(IntentType.GREETING);
    expect(ragCalls).toHaveLength(0); // Không gọi RAG
  });

  it('"thời tiết hôm nay" → OFFTOPIC', async () => {
    const result = await processMessage('s2', 'thời tiết hôm nay');
    expect(result.route).toBe(RouteType.OFFTOPIC_RESPONSE);
  });

  it('"phở bò" → RAG route, có gọi RAG', async () => {
    const ragCalls: any[] = [];
    const result = await processMessage('s3', 'phở bò', async (q) => {
      ragCalls.push(q);
      return {
        text: 'Gợi ý: 1. Phở bò tái, 2. Phở bò viên, 3. Phở gà',
        sources: [{ recipeId: 1, recipeName: 'Phở bò', similarity: 0.9 }],
      };
    });
    expect(result.route).toBe(RouteType.RAG);
    expect(ragCalls).toHaveLength(1);
    // resolvedQuery đã normalize (bỏ dấu)
    expect(ragCalls[0]).toMatch(/pho bo|phở bò/);
  });

  it('lưu dishReferences vào session', async () => {
    await processMessage('s4', 'gợi ý món từ thịt gà', async () => ({
      text: '1. Gà kho, 2. Gà xào, 3. Gà nướng',
      sources: [],
    }));
    const ctx = getSessionContext('s4');
    expect(ctx.currentDish).toBe('Gà nướng');
    // Messages count: 1 user + 1 assistant = 2
    expect(ctx.messages.length).toBe(2);
  });

  it('Turn 2: "cách làm món thứ 2" với context → resolve', async () => {
    // Setup: turn 1 user + assistant
    addMessageToSession('s5', {
      role: 'user',
      content: 'gợi ý món từ thịt gà',
      timestamp: Date.now(),
    });
    addMessageToSession('s5', {
      role: 'assistant',
      content: '1. Gà kho, 2. Gà xào, 3. Gà nướng',
      timestamp: Date.now(),
      metadata: { dishReferences: ['Gà kho', 'Gà xào', 'Gà nướng'] },
    });

    let capturedQuery = '';
    await processMessage('s5', 'cách làm món thứ 2', async (q) => {
      capturedQuery = q;
      return { text: 'Hướng dẫn làm Gà xào...', sources: [] };
    });

    expect(capturedQuery).toContain('Gà xào');
  });

  it('"xyz abc" không rõ ý → CLARIFY', async () => {
    const result = await processMessage('s6', 'xyz abc 123');
    expect(result.route).toBe(RouteType.CLARIFY);
  });

  it('Resolved query được trả về', async () => {
    const result = await processMessage('s7', 'phở bò', async () => ({
      text: 'mock',
      sources: [],
    }));
    expect(result.resolvedQuery).toBeDefined();
  });

  it('Confidence < 0.5 → CLARIFY (override)', async () => {
    // Fallback classifier trả confidence 0.3 cho câu rỗng
    const result = await processMessage('s8', 'xyz', async () => ({
      text: 'mock',
      sources: [],
    }));
    expect(result.route).toBe(RouteType.CLARIFY);
  });

  it('Session context: chỉ giữ 10 tin nhắn gần nhất (FIFO)', async () => {
    for (let i = 0; i < 15; i++) {
      addMessageToSession('s9', {
        role: 'user',
        content: `msg ${i}`,
        timestamp: Date.now(),
      });
    }
    const ctx = getSessionContext('s9');
    expect(ctx.messages.length).toBe(10);
  });

  it('Nutrition intent → DB_LOOKUP route', async () => {
    const result = await processMessage('s10', 'phở bò bao nhiêu calo');
    expect(result.route).toBe(RouteType.DB_LOOKUP);
    expect(result.intent.primaryIntent).toBe(IntentType.NUTRITION);
  });

  it('Recipe detail "cách làm phở bò" → DB_LOOKUP', async () => {
    const result = await processMessage('s11', 'cách làm phở bò');
    expect(result.route).toBe(RouteType.DB_LOOKUP);
    expect(result.intent.primaryIntent).toBe(IntentType.RECIPE_DETAIL);
  });
});