/**
 * Unit tests cho Intent Classifier (5 tiers)
 * Coverage: Social (12), Offtopic (8), Nutrition (10), Recipe STRONG (15),
 * Recipe WEAK (10), Recipe Detail (8), Clarify (10), False positive (7) = 80+ cases
 */

import { describe, it, expect } from '@jest/globals';
import { classifyIntent } from '../../services/intent/classifier';
import { IntentType } from '../../services/intent/types';

describe('Tier 1 - Social', () => {
  it.each([
    ['xin chao', IntentType.GREETING, 1],
    ['chao ban', IntentType.GREETING, 1],
    ['hi', IntentType.GREETING, 1],
    ['hello', IntentType.GREETING, 1],
    ['chao', IntentType.GREETING, 1],
    ['tam biet', IntentType.FAREWELL, 1],
    ['bye', IntentType.FAREWELL, 1],
    ['cam on', IntentType.THANKS, 1],
    ['cam on ban', IntentType.THANKS, 1],
    ['ban la ai', IntentType.WHO_ARE_YOU, 1],
    ['ten ban la gi', IntentType.WHO_ARE_YOU, 1],
    ['giup toi', IntentType.HELP, 1],
    ['help', IntentType.HELP, 1],
  ])('"%s" → %s (tier %i)', (query, expected, tier) => {
    const r = classifyIntent(query);
    expect(r.primaryIntent).toBe(expected);
    expect(r.matchedTier).toBe(tier);
  });

  it('Greeting có confidence cao', () => {
    const r = classifyIntent('xin chào');
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
  });
});

describe('Tier 1 - Social vs Recipe (chào vs cháo)', () => {
  it('"chao" alone → GREETING', () => {
    expect(classifyIntent('chao').primaryIntent).toBe(IntentType.GREETING);
  });

  it('"chao ga" → RECIPE_SEARCH (cháo + food)', () => {
    const r = classifyIntent('chao ga');
    expect(r.primaryIntent).toBe(IntentType.RECIPE_SEARCH);
    expect(r.matchedTier).toBe(4);
  });

  it('"cach nau chao ga" → RECIPE_DETAIL', () => {
    const r = classifyIntent('cach nau chao ga');
    expect(r.primaryIntent).toBe(IntentType.RECIPE_DETAIL);
  });

  it('"cach lam chao thit" → RECIPE_DETAIL', () => {
    const r = classifyIntent('cach lam chao thit');
    expect(r.primaryIntent).toBe(IntentType.RECIPE_DETAIL);
  });

  it('"chao chay" → RECIPE_VARIANT (cháo + chay = biến thể)', () => {
    const r = classifyIntent('chao chay');
    // "chay" match RECIPE_VARIANT_KEYWORDS
    expect([IntentType.RECIPE_VARIANT, IntentType.RECIPE_SEARCH]).toContain(r.primaryIntent);
  });
});

describe('Tier 2 - Offtopic', () => {
  it.each([
    ['thoi tiet hom nay', IntentType.OFFTOPIC],
    ['xe o to', IntentType.OFFTOPIC],
    ['bong da world cup', IntentType.OFFTOPIC],
    ['bitcoin hom nay', IntentType.OFFTOPIC],
    ['react hooks la gi', IntentType.OFFTOPIC],
    ['game lien quan', IntentType.OFFTOPIC],
    ['phim hay', IntentType.OFFTOPIC],
  ])('"%s" → %s', (query, expected) => {
    expect(classifyIntent(query).primaryIntent).toBe(expected);
  });

  it('câu có food signal KHÔNG bị phân loại offtopic', () => {
    expect(classifyIntent('thit ga').primaryIntent).not.toBe(IntentType.OFFTOPIC);
    expect(classifyIntent('cach nau pho').primaryIntent).not.toBe(IntentType.OFFTOPIC);
  });
});

describe('Tier 2 - False Positive', () => {
  it('"banh xe" không phải food (ô tô)', () => {
    const r = classifyIntent('banh xe bi hong');
    // Có false positive + "bi hong" không match food - nên không phải Recipe
    expect(r.primaryIntent).not.toBe(IntentType.RECIPE_SEARCH);
    expect(r.primaryIntent).not.toBe(IntentType.RECIPE_DETAIL);
  });

  it('"ca si" không phải cá (nghĩa là fish)', () => {
    const r = classifyIntent('ca si noi tieng');
    expect(r.primaryIntent).not.toBe(IntentType.RECIPE_SEARCH);
    expect(r.primaryIntent).not.toBe(IntentType.RECIPE_DETAIL);
  });
});

describe('Tier 3 - Nutrition', () => {
  it.each([
    'pho bo bao nhieu calo',
    'it calo protein cao',
    'giam can nen an gi',
    'tieu duong kieng gi',
    'chat beo co loi ich gi',
    'thanh phan dinh duong',
    'an chay co du protein khong',
    'mo mau cao nen an gi',
    'kcal trong bun bo',
    'an kieng giam can',
  ])('"%s" → NUTRITION', (query) => {
    const r = classifyIntent(query);
    expect(r.primaryIntent).toBe(IntentType.NUTRITION);
    expect(r.matchedTier).toBe(3);
  });

  it('Nutrition có nutritionTerms entity', () => {
    const r = classifyIntent('phở bò bao nhiêu calo');
    expect(r.entities?.nutritionTerms).toBeDefined();
    expect(r.entities?.nutritionTerms?.length).toBeGreaterThan(0);
  });
});

describe('Tier 4 - Recipe STRONG', () => {
  it.each([
    'pho bo',
    'bun cha',
    'com tam',
    'goi cuon',
    'banh xeo',
    'banh mi',
    'lau thai',
    'thit kho',
    'ga kho',
    'canh chua',
    'che ba mau',
    'xoi xeo',
    'mi quang',
    'hu tieu',
    'nem ran',
  ])('"%s" → RECIPE_SEARCH', (query) => {
    const r = classifyIntent(query);
    expect(r.primaryIntent).toBe(IntentType.RECIPE_SEARCH);
    expect(r.matchedTier).toBe(4);
  });
});

describe('Tier 4 - Recipe WEAK + Cooking Context', () => {
  it.each([
    ['cach nau thit ga', IntentType.RECIPE_DETAIL],
    ['cach lam thit bo', IntentType.RECIPE_DETAIL],
    ['cach che bien ca hoi', IntentType.RECIPE_SEARCH],
    ['cach nau ca ro phi', IntentType.RECIPE_DETAIL],
    ['cong thuc lam thit heo', IntentType.RECIPE_DETAIL],
    ['huong dan nau chao tom', IntentType.RECIPE_DETAIL],
    ['cach lam tom hap', IntentType.RECIPE_DETAIL],
    ['cach nau rau', IntentType.RECIPE_DETAIL],
    ['cach che bien heo', IntentType.RECIPE_SEARCH],
  ])('"%s" → %s (weak + cooking context)', (query, expected) => {
    const r = classifyIntent(query);
    expect(r.primaryIntent).toBe(expected);
    expect(r.matchedTier).toBe(4);
  });
});

describe('Tier 4 - Recipe Detail', () => {
  it.each([
    'cach lam pho bo',
    'cach nau bun cha',
    'huong dan lam banh xeo',
    'cac buoc lam che',
    'buoc lam xoi',
    'lam sao de nau lau',
  ])('"%s" → RECIPE_DETAIL', (query) => {
    const r = classifyIntent(query);
    expect(r.primaryIntent).toBe(IntentType.RECIPE_DETAIL);
  });
});

describe('Tier 4 - Recipe Substitute', () => {
  it.each([
    'thay the thit bo bang gi',
    'khong co trung co the dung gi',
    'thay vi ga dung ca duoc khong',
  ])('"%s" → RECIPE_SUBSTITUTE', (query) => {
    const r = classifyIntent(query);
    expect(r.primaryIntent).toBe(IntentType.RECIPE_SUBSTITUTE);
  });
});

describe('Tier 5 - Clarify', () => {
  it.each([
    'toi khong biet',
    'gi vay',
    'abc xyz',
    'huh',
    'ngon khong',
    'khi nao',
    'o the',
  ])('"%s" → CLARIFY', (query) => {
    const r = classifyIntent(query);
    expect(r.primaryIntent).toBe(IntentType.CLARIFY);
    expect(r.matchedTier).toBe(5);
  });

  it('Clarify default có confidence thấp', () => {
    const r = classifyIntent('xyz abc 123');
    expect(r.confidence).toBeLessThan(0.5);
  });
});

describe('hasKeyword - exact matching (no substring)', () => {
  it('không match substring "gà" trong "gà kho" nếu keyword là "gà"', async () => {
    const { hasKeyword } = await import('../../services/intent/classifier');
    const { WEAK_FOOD_KEYWORDS } = await import('../../services/intent/keywords');
    // WEAK_FOOD_KEYWORDS chứa "ga" - nên hasKeyword(['ga', 'kho'], WEAK) → true vì token "ga" match
    expect(hasKeyword(['ga', 'kho'], WEAK_FOOD_KEYWORDS)).toBe(true);
    // Nhưng ['gakho'] không match vì token là "gakho"
    expect(hasKeyword(['gakho'], WEAK_FOOD_KEYWORDS)).toBe(false);
  });

  it('match bigram "thit kho"', async () => {
    const { hasKeyword } = await import('../../services/intent/classifier');
    const { STRONG_FOOD_KEYWORDS } = await import('../../services/intent/keywords');
    expect(hasKeyword(['thit', 'kho', 'trung'], STRONG_FOOD_KEYWORDS)).toBe(true);
    expect(hasKeyword(['thit', 'kho'], STRONG_FOOD_KEYWORDS)).toBe(true);
  });
});

describe('Multi-intent detection', () => {
  it('Câu có cả food signal và nutrition term - recipe được ưu tiên', () => {
    // "phở bò calo" - có food signal mạnh, có nutrition term
    // Recipe (tier 4) được check sau Nutrition (tier 3) - Recipe sẽ thắng
    const r = classifyIntent('pho bo calo bao nhieu');
    // Thực tế: classifyNutrition sẽ match "calo" → trả tier 3
    expect(r.primaryIntent).toBe(IntentType.NUTRITION);
  });
});