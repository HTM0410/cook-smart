/**
 * Intent Types
 * Định nghĩa các types dùng chung cho Intent Classification system.
 */

export enum IntentType {
  // Tier 1 - Social
  GREETING = 'greeting',
  FAREWELL = 'farewell',
  THANKS = 'thanks',
  HELP = 'help',
  WHO_ARE_YOU = 'who_are_you',

  // Tier 2 - Offtopic
  OFFTOPIC = 'offtopic',

  // Tier 3 - Nutrition
  NUTRITION = 'nutrition',

  // Tier 4 - Recipe
  RECIPE_DETAIL = 'recipe_detail',
  RECIPE_SEARCH = 'recipe_search',
  RECIPE_VARIANT = 'recipe_variant',
  RECIPE_SUBSTITUTE = 'recipe_substitute',

  // Tier 5 - Clarify
  CLARIFY = 'clarify',
}

export interface IntentResult {
  primaryIntent: IntentType;
  secondaryIntents?: IntentType[];
  confidence: number;
  matchedTier: number;
  entities?: {
    ingredients?: string[];
    dishName?: string;
    nutritionTerms?: string[];
  };
  context?: {
    recentMessages?: ChatMessage[];
    currentDish?: string;
    currentIngredients?: string[];
    previousIntent?: IntentType;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    intent?: IntentType;
    entities?: {
      ingredients?: string[];
      dishName?: string;
      nutritionTerms?: string[];
    };
    dishReferences?: string[];
  };
}

export interface SessionContext {
  sessionId: string;
  messages: ChatMessage[];
  currentDish?: string;
  currentIngredients: string[];
  lastActivityAt: number;
}