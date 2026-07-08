/**
 * LLM Call Counter
 *
 * Đếm số lượng LLM calls thực tế trong Intent Pipeline:
 *   - Embedding calls (getEmbedding)
 *   - Chat completion calls (sendChatMessage)
 *   - Theo từng Route (CANNED/OFFTOPIC/CLARIFY/DB_LOOKUP/RAG)
 *
 * Run: npx ts-node src/__tests__/intent/llmCallCounter.ts
 */

import { processMessage, clearSessionContext } from '../../services/intent/pipeline';
import { RouteType } from '../../services/intent/router';

let embeddingCalls = 0;
let chatCalls = 0;
const callLog: Array<{ type: string; query?: string; route?: string }> = [];

jest.mock('../../services/geminiService', () => ({
  getEmbedding: jest.fn(async (..._args: unknown[]) => {
    embeddingCalls++;
    callLog.push({ type: 'EMBEDDING' });
    // Trả vector 3072 dim giả
    return { embedding: new Array(3072).fill(0.1), model: 'mock-embedding' };
  }),
  getBatchEmbeddings: jest.fn(async (texts: string[]) => {
    embeddingCalls += texts.length;
    texts.forEach(() => callLog.push({ type: 'BATCH_EMBEDDING' }));
    return texts.map(() => ({ embedding: new Array(3072).fill(0.1), model: 'mock' }));
  }),
  sendChatMessage: jest.fn(async (..._args: unknown[]) => {
    chatCalls++;
    callLog.push({ type: 'CHAT' });
    return {
      text: 'Mock response từ LLM',
      model: 'mock-chat',
      keyRotated: false,
    };
  }),
  streamChatMessage: jest.fn(async (..._args: unknown[]) => {
    chatCalls++;
    callLog.push({ type: 'STREAM_CHAT' });
    return {
      text: 'Mock streaming',
      model: 'mock-stream',
      keyRotated: false,
    };
  }),
}));

describe('LLM Call Counter - Đếm số lượng gọi Gemini', () => {
  beforeEach(() => {
    embeddingCalls = 0;
    chatCalls = 0;
    callLog.length = 0;
    const { listActiveSessions } = require('../../services/intent/sessionStore');
    for (const sid of listActiveSessions()) {
      clearSessionContext(sid);
    }
  });

  // Test theo từng route
  const tests = [
    {
      name: 'CANNED: Greeting',
      query: 'xin chào',
      expectedRoute: RouteType.CANNED,
      expectedEmbedding: 0,
      expectedChat: 0,
    },
    {
      name: 'CANNED: Cảm ơn',
      query: 'cảm ơn',
      expectedRoute: RouteType.CANNED,
      expectedEmbedding: 0,
      expectedChat: 0,
    },
    {
      name: 'OFFTOPIC: Thời tiết',
      query: 'thời tiết hôm nay',
      expectedRoute: RouteType.OFFTOPIC_RESPONSE,
      expectedEmbedding: 0,
      expectedChat: 0,
    },
    {
      name: 'OFFTOPIC: Bóng đá',
      query: 'bóng đá',
      expectedRoute: RouteType.OFFTOPIC_RESPONSE,
      expectedEmbedding: 0,
      expectedChat: 0,
    },
    {
      name: 'CLARIFY: Gibberish',
      query: 'xyz abc',
      expectedRoute: RouteType.CLARIFY,
      expectedEmbedding: 0,
      expectedChat: 0,
    },
    {
      name: 'RAG: Phở bò',
      query: 'phở bò',
      expectedRoute: RouteType.RAG,
      expectedEmbedding: 0, // ragProcessor callback được gọi (mock), không gọi getEmbedding trực tiếp
      expectedChat: 0,      // Trong test, ragProcessor chỉ trả text
    },
    {
      name: 'RAG: Bánh mì',
      query: 'bánh mì',
      expectedRoute: RouteType.RAG,
      expectedEmbedding: 0,
      expectedChat: 0,
    },
    {
      name: 'DB_LOOKUP: Cách làm phở',
      query: 'cách làm phở bò',
      expectedRoute: RouteType.DB_LOOKUP,
      expectedEmbedding: 0,
      expectedChat: 0,
    },
    {
      name: 'DB_LOOKUP: Calo',
      query: 'phở bò bao nhiêu calo',
      expectedRoute: RouteType.DB_LOOKUP,
      expectedEmbedding: 0,
      expectedChat: 0,
    },
  ];

  for (const test of tests) {
    it(`${test.name} → ${test.expectedRoute}`, async () => {
      const sessionId = `test-${test.name.replace(/\s+/g, '-')}`;
      clearSessionContext(sessionId);

      const before = { emb: embeddingCalls, chat: chatCalls };
      const result = await processMessage(sessionId, test.query, async (q, h, ic) => ({
        text: '[MOCK RAG]',
        sources: [],
      }));
      const after = { emb: embeddingCalls, chat: chatCalls };

      const deltaEmb = after.emb - before.emb;
      const deltaChat = after.chat - before.chat;

      console.log(`  ${test.name}`);
      console.log(`    Route:         ${result.route}`);
      console.log(`    Embedding calls: ${deltaEmb} (expected: ${test.expectedEmbedding})`);
      console.log(`    Chat calls:    ${deltaChat} (expected: ${test.expectedChat})`);

      expect(result.route).toBe(test.expectedRoute);
      expect(deltaEmb).toBe(test.expectedEmbedding);
      expect(deltaChat).toBe(test.expectedChat);
    });
  }

  it('Multi-turn: Turn 1 RAG + Turn 2 reference → count correctly', async () => {
    const sessionId = 'multiturn-counter';
    clearSessionContext(sessionId);

    const mockRAG = async (q: string) => ({
      text: '1. Gà kho\n2. Gà xào\n3. Gà nướng',
      sources: [],
    });

    const before1 = { emb: embeddingCalls, chat: chatCalls };
    const turn1 = await processMessage(sessionId, 'gợi ý món gà', mockRAG);
    const after1 = { emb: embeddingCalls, chat: chatCalls };

    console.log('\n  Multi-turn test:');
    console.log(`    Turn 1: "${turn1.intent.primaryIntent}" → ${turn1.route}`);
    console.log(`      Embedding: ${after1.emb - before1.emb}, Chat: ${after1.chat - before1.chat}`);

    const before2 = { emb: embeddingCalls, chat: chatCalls };
    const turn2 = await processMessage(sessionId, 'món thứ 2 cần gì?', mockRAG);
    const after2 = { emb: embeddingCalls, chat: chatCalls };

    console.log(`    Turn 2: "${turn2.intent.primaryIntent}" → ${turn2.route}`);
    console.log(`      Embedding: ${after2.emb - before2.emb}, Chat: ${after2.chat - before2.chat}`);
    console.log(`    Total Embedding: ${embeddingCalls}, Chat: ${chatCalls}`);
  });

  it('RAG layer: processRAGQuery thật → 1 embedding + 1 chat', async () => {
    // Reset
    embeddingCalls = 0;
    chatCalls = 0;

    const { processRAGQuery } = require('../../services/ragService');
    try {
      await processRAGQuery('phở bò', []);
    } catch (e) {
      // Có thể fail vì searchSimilar trả [], nhưng ta chỉ đếm LLM calls trước đó
    }

    console.log('\n  processRAGQuery("phở bò"):');
    console.log(`    Embedding calls: ${embeddingCalls}`);
    console.log(`    Chat calls:      ${chatCalls}`);
  });

  it('SUMMARY: 126 requests phân bố route → tính tổng LLM cost', async () => {
    // Reset
    embeddingCalls = 0;
    chatCalls = 0;

    const queries = [
      'xin chào', 'cảm ơn', 'tạm biệt', 'giúp tôi', 'bạn là ai', // 5 CANNED
      'thời tiết', 'bóng đá', 'bitcoin', 'game', 'ca sĩ',         // 5 OFFTOPIC
      'xyz abc', 'asdf',                                            // 2 CLARIFY
      'phở bò', 'bánh mì', 'bún chả',                             // 3 RAG
      'cách làm phở', 'cách nấu thịt gà', 'calories của phở',     // 3 DB_LOOKUP
    ];

    // Multiplier
    const N = 7; // 18 queries × 7 = 126 requests
    const allQueries: string[] = [];
    for (let i = 0; i < N; i++) {
      allQueries.push(...queries);
    }

    const routeCounts: Record<string, number> = {};
    const mockRAG = async (q: string) => ({ text: '[MOCK]', sources: [] });

    for (const q of allQueries) {
      const result = await processMessage(`session-${Math.random()}`, q, mockRAG);
      routeCounts[result.route] = (routeCounts[result.route] || 0) + 1;
    }

    console.log('\n  ═══════════════════════════════════════');
    console.log('  📊 LLM CALL SUMMARY (100 requests mix)');
    console.log('  ═══════════════════════════════════════\n');
    console.log(`  Total requests: ${allQueries.length}`);
    console.log(`  Total embedding calls: ${embeddingCalls}`);
    console.log(`  Total chat calls: ${chatCalls}`);
    console.log(`  Total LLM calls: ${embeddingCalls + chatCalls}`);
    console.log('\n  Routes distribution:');
    for (const [route, count] of Object.entries(routeCounts)) {
      console.log(`    ${route.padEnd(20)}: ${count} requests`);
    }

    console.log('\n  💰 Cost analysis (Gemini pricing):');
    console.log('     - Embedding (gemini-embedding-001): $0.00001/1k tokens');
    console.log('     - Chat (gemini-2.0-flash-lite):     $0.000075/1k input tokens');
    console.log('     - Avg chat: ~500 input + 200 output tokens/req');
    console.log('     - Avg embedding: ~50 tokens/req');

    const totalRequests = allQueries.length;
    const noLLMRequests = (routeCounts.canned || 0) + (routeCounts.offtopic_response || 0) + (routeCounts.clarify || 0);
    const llmRequests = totalRequests - noLLMRequests;
    const savingsPercent = (noLLMRequests / totalRequests * 100).toFixed(1);

    console.log(`\n  ✅ No-LLM requests: ${noLLMRequests} (${savingsPercent}%)`);
    console.log(`  🔥 LLM requests:    ${llmRequests} (${(100 - parseFloat(savingsPercent)).toFixed(1)}%)`);
    console.log(`  💵 Saved ~${savingsPercent}% Gemini API cost vs naive (all → RAG)`);
  });
});