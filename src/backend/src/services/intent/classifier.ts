/**
 * Intent Classifier - 5-Tier Rule-based
 *
 * Tier 1 - Social: chào/tạm biết/cảm ơn/help/who_are_you
 * Tier 2 - Offtopic: chủ đề không liên quan đến nấu ăn
 * Tier 3 - Nutrition: calo, protein, vitamin...
 * Tier 4 - Recipe: search/detail/variant/substitute
 * Tier 5 - Clarify: fallback khi không rõ
 *
 * Đặc điểm:
 *   - KHÔNG dùng `includes()` tự do cho token matching - phải exact match
 *   - Strong food signal: match đứng một mình đã là Recipe
 *   - Weak food signal: cần cooking context
 *   - "chào" vs "cháo" được phân biệt bằng FOOD_AFTER_CHAO
 */

import { normalizeVietnamese, tokenize } from './normalizer';
import {
  STRONG_FOOD_KEYWORDS,
  WEAK_FOOD_KEYWORDS,
  COOKING_CONTEXT_KEYWORDS,
  NUTRITION_KEYWORDS,
  OFFTOPIC_KEYWORDS,
  FOOD_AFTER_CHAO,
  FOOD_FALSE_POSITIVE_PHRASES,
  CLARIFY_PHRASES,
  RECIPE_DETAIL_PREFIXES,
  RECIPE_SUBSTITUTE_KEYWORDS,
  RECIPE_VARIANT_KEYWORDS,
  SOCIAL_GREETING_KEYWORDS,
  SOCIAL_FAREWELL_KEYWORDS,
  SOCIAL_THANKS_KEYWORDS,
  SOCIAL_WHO_ARE_YOU_KEYWORDS,
  SOCIAL_HELP_KEYWORDS,
} from './keywords';
import { IntentType, IntentResult, ChatMessage } from './types';

/**
 * Match 1-gram (token), 2-gram liền kề hoặc 3-gram liền kề với keyword set.
 * Trả về true nếu tìm thấy.
 */
export function hasKeyword(tokens: string[], keywordSet: Set<string>): boolean {
  // 1-gram
  for (const token of tokens) {
    if (keywordSet.has(token)) return true;
  }
  // 2-gram liền kề (VD: "thit kho", "bun cha")
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    if (keywordSet.has(bigram)) return true;
  }
  // 3-gram liền kề (VD: "thanh phan dinh duong", "giam can nen an")
  for (let i = 0; i < tokens.length - 2; i++) {
    const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    if (keywordSet.has(trigram)) return true;
  }
  return false;
}

export function hasStrongFoodSignal(tokens: string[]): boolean {
  return hasKeyword(tokens, STRONG_FOOD_KEYWORDS);
}

export function hasWeakFoodSignal(tokens: string[]): boolean {
  return hasKeyword(tokens, WEAK_FOOD_KEYWORDS);
}

export function hasCookingContext(tokens: string[]): boolean {
  return hasKeyword(tokens, COOKING_CONTEXT_KEYWORDS);
}

/**
 * Kiểm tra cụm false positive (VD: "bánh xe", "ca sĩ").
 * Match exact phrase, không phải substring.
 * - "banh xe bi hong" → match "banh xe" ✓
 * - "banh xeo" → KHÔNG match "banh xe" ✓ (vì "xeo" ≠ "xe")
 */
export function hasFalsePositive(normalized: string): boolean {
  // Tokenize để check exact bigram
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 0);
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    if (FOOD_FALSE_POSITIVE_PHRASES.has(bigram)) return true;
  }
  // Đơn từ false positive (VD: "hoa", "dat")
  const singleFalsePositives = ['hoa', 'dat'];
  for (const token of tokens) {
    if (singleFalsePositives.includes(token)) return true;
  }
  return false;
}

/**
 * Trích nguyên liệu từ tokens (chỉ weak food keyword có mặt).
 */
function extractIngredients(tokens: string[]): string[] {
  const ings: string[] = [];
  for (const token of tokens) {
    if (WEAK_FOOD_KEYWORDS.has(token) && !ings.includes(token)) {
      ings.push(token);
    }
  }
  return ings;
}

/**
 * Trích dish name bằng cách lấy các token strong food gần "cách nấu".
 * Đơn giản: ghép các strong food tokens.
 */
function extractDishName(tokens: string[]): string | undefined {
  const dishTokens: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    if (STRONG_FOOD_KEYWORDS.has(bigram)) {
      dishTokens.push(bigram);
    }
  }
  for (const token of tokens) {
    if (STRONG_FOOD_KEYWORDS.has(token) && !dishTokens.includes(token)) {
      dishTokens.push(token);
    }
  }
  return dishTokens[0];
}

// =====================================================
// TIER 1: SOCIAL
// =====================================================
export function classifySocial(
  normalized: string,
  tokens: string[],
): IntentResult | null {
  // CHẶN TRƯỚC: Nếu "cháo" + nguyên liệu → đây là CHÁO (món ăn)
  if ((tokens[0] === 'chao' || tokens[0] === 'cháo') && tokens.length >= 2) {
    const foodWord = tokens[1];
    if (foodWord && FOOD_AFTER_CHAO.has(foodWord)) {
      return null; // Để classifyRecipe xử lý
    }
  }

  // "chào" đứng riêng → GREETING
  if (tokens.length === 1 && tokens[0] === 'chao') {
    return {
      primaryIntent: IntentType.GREETING,
      confidence: 0.95,
      matchedTier: 1,
    };
  }

  if (hasKeyword(tokens, SOCIAL_GREETING_KEYWORDS)) {
    return {
      primaryIntent: IntentType.GREETING,
      confidence: 0.95,
      matchedTier: 1,
    };
  }

  if (hasKeyword(tokens, SOCIAL_FAREWELL_KEYWORDS)) {
    return {
      primaryIntent: IntentType.FAREWELL,
      confidence: 0.95,
      matchedTier: 1,
    };
  }

  if (hasKeyword(tokens, SOCIAL_THANKS_KEYWORDS)) {
    return {
      primaryIntent: IntentType.THANKS,
      confidence: 0.9,
      matchedTier: 1,
    };
  }

  if (hasKeyword(tokens, SOCIAL_WHO_ARE_YOU_KEYWORDS)) {
    return {
      primaryIntent: IntentType.WHO_ARE_YOU,
      confidence: 0.95,
      matchedTier: 1,
    };
  }

  if (hasKeyword(tokens, SOCIAL_HELP_KEYWORDS)) {
    return {
      primaryIntent: IntentType.HELP,
      confidence: 0.9,
      matchedTier: 1,
    };
  }

  return null;
}

// =====================================================
// TIER 2: OFFTOPIC
// =====================================================
export function classifyOfftopic(
  normalized: string,
  tokens: string[],
): IntentResult | null {
  // CHẶN: Có food signal → KHÔNG phải offtopic (điều kiện &&)
  if (hasStrongFoodSignal(tokens) || hasWeakFoodSignal(tokens)) {
    return null;
  }

  // Cooking context → không phải offtopic
  if (hasCookingContext(tokens)) return null;

  // Social keywords → không phải offtopic
  if (
    hasKeyword(tokens, SOCIAL_GREETING_KEYWORDS) ||
    hasKeyword(tokens, SOCIAL_THANKS_KEYWORDS)
  ) {
    return null;
  }

  if (hasKeyword(tokens, OFFTOPIC_KEYWORDS)) {
    return {
      primaryIntent: IntentType.OFFTOPIC,
      confidence: 0.85,
      matchedTier: 2,
    };
  }
  return null;
}

// =====================================================
// TIER 3: NUTRITION
// =====================================================
export function classifyNutrition(
  _normalized: string,
  tokens: string[],
): IntentResult | null {
  const nutritionTerms: string[] = [];
  const seen = new Set<string>();

  // 1-gram
  for (const token of tokens) {
    if (NUTRITION_KEYWORDS.has(token) && !seen.has(token)) {
      nutritionTerms.push(token);
      seen.add(token);
    }
  }
  // 2-gram
  for (let i = 0; i < tokens.length - 1; i++) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    if (NUTRITION_KEYWORDS.has(bigram) && !seen.has(bigram)) {
      nutritionTerms.push(bigram);
      seen.add(bigram);
    }
  }
  // 3-gram
  for (let i = 0; i < tokens.length - 2; i++) {
    const trigram = `${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`;
    if (NUTRITION_KEYWORDS.has(trigram) && !seen.has(trigram)) {
      nutritionTerms.push(trigram);
      seen.add(trigram);
    }
  }

  if (nutritionTerms.length === 0) return null;

  return {
    primaryIntent: IntentType.NUTRITION,
    confidence: 0.8,
    matchedTier: 3,
    entities: { nutritionTerms },
  };
}

// =====================================================
// TIER 4: RECIPE
// =====================================================
export function classifyRecipe(
  normalized: string,
  tokens: string[],
): IntentResult | null {
  // CHẶN: false positive trước khi check strong food
  if (hasFalsePositive(normalized)) {
    // "banh xe", "ca si"... không phải food
    return null;
  }

  // Recipe detail (cách làm món cụ thể) - check TRƯỚC strong food
  if (hasKeyword(tokens, RECIPE_DETAIL_PREFIXES)) {
    const dishName = extractDishName(tokens);
    return {
      primaryIntent: IntentType.RECIPE_DETAIL,
      confidence: 0.9,
      matchedTier: 4,
      entities: { dishName },
    };
  }

  // Recipe substitute (thay thế nguyên liệu)
  if (hasKeyword(tokens, RECIPE_SUBSTITUTE_KEYWORDS)) {
    return {
      primaryIntent: IntentType.RECIPE_SUBSTITUTE,
      confidence: 0.8,
      matchedTier: 4,
    };
  }

  // Recipe variant (biến thể) - check trước strong food để "chay" không gây nhầm
  if (hasKeyword(tokens, RECIPE_VARIANT_KEYWORDS)) {
    return {
      primaryIntent: IntentType.RECIPE_VARIANT,
      confidence: 0.75,
      matchedTier: 4,
    };
  }

  // STRONG food signal → RECIPE_SEARCH
  if (hasStrongFoodSignal(tokens)) {
    return {
      primaryIntent: IntentType.RECIPE_SEARCH,
      confidence: 0.85,
      matchedTier: 4,
      entities: { ingredients: extractIngredients(tokens) },
    };
  }

  // WEAK food + cooking context → RECIPE_SEARCH
  if (hasWeakFoodSignal(tokens) && hasCookingContext(tokens)) {
    return {
      primaryIntent: IntentType.RECIPE_SEARCH,
      confidence: 0.7,
      matchedTier: 4,
      entities: { ingredients: extractIngredients(tokens) },
    };
  }

  return null;
}

// =====================================================
// TIER 5: CLARIFY
// =====================================================
export function classifyClarify(
  tokens: string[],
  _normalized: string,
): IntentResult {
  if (hasKeyword(tokens, CLARIFY_PHRASES)) {
    return {
      primaryIntent: IntentType.CLARIFY,
      confidence: 0.6,
      matchedTier: 5,
    };
  }

  // Default fallback
  return {
    primaryIntent: IntentType.CLARIFY,
    confidence: 0.3,
    matchedTier: 5,
  };
}

// =====================================================
// MAIN: classifyIntent
// =====================================================
export function classifyIntent(
  query: string,
  _sessionMessages: ChatMessage[] = [],
): IntentResult {
  const normalized = normalizeVietnamese(query);
  const tokens = tokenize(normalized);

  // Tier 1: Social
  const social = classifySocial(normalized, tokens);
  if (social) return social;

  // Tier 2: Offtopic
  const offtopic = classifyOfftopic(normalized, tokens);
  if (offtopic) return offtopic;

  // Tier 3: Nutrition
  const nutrition = classifyNutrition(normalized, tokens);
  if (nutrition) return nutrition;

  // Tier 4: Recipe
  const recipe = classifyRecipe(normalized, tokens);
  if (recipe) return recipe;

  // Tier 5: Clarify (default fallback)
  return classifyClarify(tokens, normalized);
}