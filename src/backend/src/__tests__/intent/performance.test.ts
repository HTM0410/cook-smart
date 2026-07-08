/**
 * Performance baseline tests
 */

import { describe, it, expect } from '@jest/globals';
import { classifyIntent } from '../../services/intent/classifier';
import { getSessionContext, addMessageToSession } from '../../services/intent/sessionStore';
import { resolveReferences, buildConversationContext } from '../../services/intent/contextBuilder';

describe('Performance', () => {
  it('classifier latency < 5ms (avg)', () => {
    const queries = [
      'phở bò',
      'cách làm gà kho',
      'bao nhiêu calo',
      'thời tiết hôm nay',
      'xin chào',
      'cách thay thế thịt bò',
      'món chay dễ làm',
      'gợi ý món từ thịt gà',
      'tạm biệt',
      'cảm ơn bạn',
    ];

    // Warm-up
    for (const q of queries) classifyIntent(q);

    const start = performance.now();
    const ITERATIONS = 1000;
    for (let i = 0; i < ITERATIONS; i++) {
      classifyIntent(queries[i % queries.length]);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / ITERATIONS;

    // eslint-disable-next-line no-console
    console.log(`[perf] classifier avg: ${avgMs.toFixed(3)}ms over ${ITERATIONS} iterations`);
    expect(avgMs).toBeLessThan(5);
  });

  it('session lookup < 1ms (avg)', () => {
    // Warm-up
    for (let i = 0; i < 100; i++) getSessionContext(`warm-${i}`);

    const start = performance.now();
    const ITERATIONS = 10000;
    for (let i = 0; i < ITERATIONS; i++) {
      getSessionContext(`perf-${i % 100}`);
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / ITERATIONS;

    // eslint-disable-next-line no-console
    console.log(`[perf] session lookup avg: ${avgMs.toFixed(4)}ms over ${ITERATIONS} iterations`);
    expect(avgMs).toBeLessThan(1);
  });

  it('resolveReferences + buildConversationContext < 2ms', () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
      timestamp: i,
      metadata:
        i % 2 === 1
          ? { dishReferences: [`Món ${i}A`, `Món ${i}B`] }
          : undefined,
    }));
    const dishes = ['Món 1A', 'Món 1B', 'Món 3A', 'Món 3B'];

    // Warm-up
    for (let i = 0; i < 50; i++) {
      resolveReferences('cách làm món thứ 2', messages, dishes);
      buildConversationContext(messages, 'cách làm món thứ 2');
    }

    const start = performance.now();
    const ITERATIONS = 1000;
    for (let i = 0; i < ITERATIONS; i++) {
      resolveReferences('cách làm món thứ 2', messages, dishes);
      buildConversationContext(messages, 'cách làm món thứ 2');
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / ITERATIONS;

    // eslint-disable-next-line no-console
    console.log(`[perf] context build avg: ${avgMs.toFixed(3)}ms over ${ITERATIONS} iterations`);
    expect(avgMs).toBeLessThan(2);
  });
});