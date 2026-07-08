/**
 * Unit tests cho Conversation Context Builder + Reference Resolver
 */

import { describe, it, expect } from '@jest/globals';
import {
  resolveReferences,
  buildConversationContext,
} from '../../services/intent/contextBuilder';
import { buildRAGPrompt } from '../../services/intent/ragPrompt';
import { ChatMessage, IntentType } from '../../services/intent/types';

describe('resolveReferences', () => {
  it('"món thứ 2" với context 3 món → resolve thành tên món thứ 2', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: '1. Gà kho, 2. Gà xào, 3. Gà nướng',
        timestamp: Date.now(),
        metadata: { dishReferences: ['Gà kho', 'Gà xào', 'Gà nướng'] },
      },
    ];
    const result = resolveReferences('cách làm món thứ 2', messages, [
      'Gà kho',
      'Gà xào',
      'Gà nướng',
    ]);
    expect(result).toContain('Gà xào');
    expect(result).not.toMatch(/món thứ 2/i);
  });

  it('"món thứ 1" → lấy món đầu tiên', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'Gợi ý: Phở bò, Bún chả',
        timestamp: Date.now(),
        metadata: { dishReferences: ['Phở bò', 'Bún chả'] },
      },
    ];
    const result = resolveReferences('nguyên liệu món thứ 1', messages, [
      'Phở bò',
      'Bún chả',
    ]);
    expect(result).toContain('Phở bò');
  });

  it('"nó" với currentDish → thay bằng tên món', () => {
    const result = resolveReferences('nó cần nguyên liệu gì', [], ['Pho bo']);
    expect(result).toContain('Pho bo');
    expect(result).not.toMatch(/\bno\b/i);
  });

  it('"món đó" / "món này" / "cái đó" → replace (normalized)', () => {
    expect(resolveReferences('mon do', [], ['Bun cha'])).toContain('Bun cha');
    expect(resolveReferences('cach lam mon nay', [], ['Com tam'])).toContain('Com tam');
    expect(resolveReferences('cai do ngon khong', [], ['Chao ga'])).toContain('Chao ga');
  });

  it('không có context → trả về normalized query', () => {
    const result = resolveReferences('món gì ngon', [], []);
    expect(result).toBe('mon gi ngon');  // normalized, không có tham chiếu
  });

  it('"tiếp đi" giữ nguyên - không bị thay bằng dish', () => {
    const result = resolveReferences('tiếp đi', [], ['Phở bò']);
    // Không match REFERENCE_PRONOUNS → giữ nguyên (normalized)
    expect(result).not.toContain('Phở bò');
    expect(result).toMatch(/tiep/);  // normalized
  });

  it('chỉ lấy dishReferences từ assistant GẦN NHẤT', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'Món cũ',
        timestamp: 1,
        metadata: { dishReferences: ['Món cũ A', 'Món cũ B'] },
      },
      {
        role: 'user',
        content: 'tiếp',
        timestamp: 2,
      },
      {
        role: 'assistant',
        content: 'Món mới',
        timestamp: 3,
        metadata: { dishReferences: ['Món mới 1', 'Món mới 2'] },
      },
    ];
    const result = resolveReferences('món thứ 1', messages, [
      'Món cũ A',
      'Món cũ B',
      'Món mới 1',
      'Món mới 2',
    ]);
    // Nên lấy từ assistant gần nhất có dishReferences
    expect(result).toContain('Món mới 1');
  });
});

describe('buildConversationContext', () => {
  it('extract currentDish từ assistant message cuối', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'gợi ý món',
        timestamp: 1,
      },
      {
        role: 'assistant',
        content: 'Thử Phở bò nhé',
        timestamp: 2,
        metadata: { dishReferences: ['Phở bò'] },
      },
    ];
    const ctx = buildConversationContext(messages, 'cách làm?');
    expect(ctx.currentDish).toBe('Phở bò');
  });

  it('extract currentIngredients từ user entities', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'có thịt gà, hành',
        timestamp: 1,
        metadata: { entities: { ingredients: ['gà', 'hành'] } },
      },
    ];
    const ctx = buildConversationContext(messages, 'cách nấu?');
    expect(ctx.currentIngredients).toContain('gà');
    expect(ctx.currentIngredients).toContain('hành');
  });

  it('extract previousIntent từ user message gần nhất', () => {
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'gợi ý món từ thịt gà',
        timestamp: 1,
        metadata: { intent: IntentType.RECIPE_SEARCH },
      },
      {
        role: 'assistant',
        content: '...',
        timestamp: 2,
      },
    ];
    const ctx = buildConversationContext(messages, 'cách làm?');
    expect(ctx.previousIntent).toBe(IntentType.RECIPE_SEARCH);
  });

  it('resolvedQuery chứa tham chiếu đã được resolve', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: '1. Phở bò, 2. Bún chả',
        timestamp: 1,
        metadata: { dishReferences: ['Phở bò', 'Bún chả'] },
      },
    ];
    const ctx = buildConversationContext(messages, 'cách làm món thứ 2');
    expect(ctx.resolvedQuery).toContain('Bún chả');
  });

  it('recentMessages giữ tối đa 10 tin nhắn', () => {
    const messages: ChatMessage[] = Array.from({ length: 15 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: `msg ${i}`,
      timestamp: i,
    }));
    const ctx = buildConversationContext(messages, 'next?');
    expect(ctx.recentMessages.length).toBe(10);
    expect(ctx.recentMessages[0].content).toBe('msg 5');
  });
});

describe('buildRAGPrompt', () => {
  it('có dish + ingredients context → include vào prompt', () => {
    const ctx = {
      recentMessages: [
        { role: 'user' as const, content: 'gợi ý món', timestamp: 1 },
      ],
      currentDish: 'Phở bò',
      currentIngredients: ['gà', 'hành'],
      resolvedQuery: 'cách làm?',
    };
    const prompt = buildRAGPrompt('cách làm?', ctx);
    expect(prompt).toContain('Phở bò');
    expect(prompt).toContain('gà');
    expect(prompt).toContain('hành');
    expect(prompt).toContain('cách làm?');
  });

  it('không có context → chỉ có câu hỏi', () => {
    const ctx = {
      recentMessages: [],
      currentIngredients: [],
      resolvedQuery: 'món gì ngon',
    };
    const prompt = buildRAGPrompt('món gì ngon', ctx);
    expect(prompt).toContain('món gì ngon');
    expect(prompt).not.toContain('Món đang thảo luận:');
    expect(prompt).not.toContain('Nguyên liệu đang thảo luận:');
  });

  it('query khác resolvedQuery → thêm resolved note', () => {
    const ctx = {
      recentMessages: [
        {
          role: 'assistant' as const,
          content: '1. A, 2. B',
          timestamp: 1,
          metadata: { dishReferences: ['A', 'B'] },
        },
      ],
      currentDish: 'B',
      currentIngredients: [],
      resolvedQuery: 'cách làm B',
    };
    const prompt = buildRAGPrompt('cách làm món thứ 2', ctx);
    expect(prompt).toContain('cách làm món thứ 2');
    expect(prompt).toContain('Đã được resolve');
    expect(prompt).toContain('B');
  });
});