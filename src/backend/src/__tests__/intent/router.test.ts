/**
 * Unit tests cho Router
 */

import { describe, it, expect } from '@jest/globals';
import {
  routeByIntent,
  getCannedResponse,
  getClarifyResponse,
  getOfftopicResponse,
  RouteType,
} from '../../services/intent/router';
import { IntentType, IntentResult } from '../../services/intent/types';

const make = (intent: IntentType, confidence = 0.9): IntentResult => ({
  primaryIntent: intent,
  confidence,
  matchedTier: 1,
});

describe('routeByIntent', () => {
  it('Social intents → CANNED', () => {
    expect(routeByIntent(make(IntentType.GREETING))).toBe(RouteType.CANNED);
    expect(routeByIntent(make(IntentType.FAREWELL))).toBe(RouteType.CANNED);
    expect(routeByIntent(make(IntentType.THANKS))).toBe(RouteType.CANNED);
    expect(routeByIntent(make(IntentType.HELP))).toBe(RouteType.CANNED);
    expect(routeByIntent(make(IntentType.WHO_ARE_YOU))).toBe(RouteType.CANNED);
  });

  it('Offtopic → OFFTOPIC_RESPONSE', () => {
    expect(routeByIntent(make(IntentType.OFFTOPIC))).toBe(RouteType.OFFTOPIC_RESPONSE);
  });

  it('Nutrition → DB_LOOKUP', () => {
    expect(routeByIntent(make(IntentType.NUTRITION))).toBe(RouteType.DB_LOOKUP);
  });

  it('Recipe Detail → DB_LOOKUP', () => {
    expect(routeByIntent(make(IntentType.RECIPE_DETAIL))).toBe(RouteType.DB_LOOKUP);
  });

  it('Recipe Search/Substitute/Variant → RAG', () => {
    expect(routeByIntent(make(IntentType.RECIPE_SEARCH))).toBe(RouteType.RAG);
    expect(routeByIntent(make(IntentType.RECIPE_SUBSTITUTE))).toBe(RouteType.RAG);
    expect(routeByIntent(make(IntentType.RECIPE_VARIANT))).toBe(RouteType.RAG);
  });

  it('Clarify → CLARIFY', () => {
    expect(routeByIntent(make(IntentType.CLARIFY))).toBe(RouteType.CLARIFY);
  });

  it('Confidence < 0.5 → CLARIFY (override)', () => {
    expect(routeByIntent(make(IntentType.RECIPE_SEARCH, 0.3))).toBe(RouteType.CLARIFY);
    expect(routeByIntent(make(IntentType.GREETING, 0.4))).toBe(RouteType.CLARIFY);
  });
});

describe('getCannedResponse', () => {
  it('trả response cho greeting', () => {
    const r = getCannedResponse(IntentType.GREETING);
    expect(r.length).toBeGreaterThan(0);
    expect(r.toLowerCase()).toContain('chào');
  });

  it('trả response cho farewell', () => {
    const r = getCannedResponse(IntentType.FAREWELL);
    // Có thể là "tạm biệt" hoặc "hẹn gặp lại"
    expect(r.toLowerCase()).toMatch(/(tạm|biệt|hẹn|bye)/);
  });

  it('trả response cho who_are_you', () => {
    const r = getCannedResponse(IntentType.WHO_ARE_YOU);
    expect(r.toLowerCase()).toContain('cooksmart');
  });

  it('random giữa nhiều responses', () => {
    const r1 = getCannedResponse(IntentType.GREETING);
    const r2 = getCannedResponse(IntentType.GREETING);
    // Có thể giống hoặc khác nhau do random - chỉ cần không crash
    expect(typeof r1).toBe('string');
    expect(typeof r2).toBe('string');
  });
});

describe('getClarifyResponse', () => {
  it('trả lời yêu cầu mô tả rõ', () => {
    const r = getClarifyResponse();
    expect(r.length).toBeGreaterThan(0);
    expect(r.toLowerCase()).toMatch(/(mô tả|ví dụ|gợi ý)/);
  });
});

describe('getOfftopicResponse', () => {
  it('từ chối lịch sự, hướng về cooking', () => {
    const r = getOfftopicResponse();
    expect(r.length).toBeGreaterThan(0);
    expect(r.toLowerCase()).toMatch(/(nấu|món|công thức)/);
  });
});