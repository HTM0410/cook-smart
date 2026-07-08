/**
 * Gemini Service - Load Balancer với Multi-Key & Multi-Model Rotation
 * Hỗ trợ xoay vòng API keys và models khi bị rate limit
 */

import { HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

// ============================================================================
// CONFIGURATION - Hỗ trợ nhiều API Keys và Models
// ============================================================================

interface ModelConfig {
  name: string;
  priority: number; // 1 = cao nhất, ưu tiên dùng
  rpm: number; // Requests per minute limit
  isLite: boolean; // Model nhẹ, ưu tiên dùng
}

interface APIKeyConfig {
  key: string;
  priority: number;
  rpm: number;
  currentRpm: number;
  lastReset: number;
  isHealthy: boolean;
  consecutiveFailures: number;
}

// Parse nhiều API keys từ env
function parseAPIKeys(): APIKeyConfig[] {
  const keysEnv = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
  const keys = keysEnv.split(',').map(k => k.trim()).filter(Boolean);
  
  if (keys.length === 0) {
    return [];
  }

  return keys.map((key, index) => ({
    key,
    priority: 1,
    rpm: 15, // Gemini free tier: 15 rpm
    currentRpm: 0,
    lastReset: Date.now(),
    isHealthy: true,
    consecutiveFailures: 0,
  }));
}

// Cấu hình models ưu tiên nhẹ và ổn định
const MODEL_CONFIGS: ModelConfig[] = [
  // Models nhẹ - ưu tiên cao nhất
  { name: 'gemini-3.0-flash-lite', priority: 1, rpm: 15, isLite: true },
  { name: 'gemini-2.0-flash-lite', priority: 2, rpm: 15, isLite: true },
  { name: 'gemini-flash-lite-latest', priority: 3, rpm: 15, isLite: true },
  // Models standard - ưu tiên trung bình
  { name: 'gemini-2.0-flash', priority: 4, rpm: 15, isLite: false },
  { name: 'gemini-1.5-flash-8b', priority: 5, rpm: 15, isLite: false },
  { name: 'gemini-1.5-flash', priority: 6, rpm: 15, isLite: false },
  // Models fallback - ít dùng hơn
  { name: 'gemini-1.0-pro', priority: 7, rpm: 10, isLite: false },
  { name: 'gemini-2.5-flash', priority: 8, rpm: 10, isLite: false },
  { name: 'gemini-2.5-flash-lite', priority: 9, rpm: 15, isLite: true },
];

// ============================================================================
// STATE MANAGEMENT - Round Robin & Health Tracking
// ============================================================================

class APIKeyManager {
  private keys: APIKeyConfig[] = [];
  private currentIndex = 0;
  private readonly RPM_WINDOW_MS = 60000; // 1 phút

  constructor() {
    this.keys = parseAPIKeys();
    if (this.keys.length === 0) {
      console.warn('⚠️ No Gemini API keys configured!');
    } else {
      console.log(`📡 Loaded ${this.keys.length} Gemini API keys`);
    }
  }

  hasKeys(): boolean {
    return this.keys.length > 0;
  }

  getAvailableKey(): string | null {
    this.resetExpiredCounters();
    
    // Tìm key healthy và có quota
    const now = Date.now();
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const key = this.keys[idx];
      
      if (key.isHealthy && key.currentRpm < key.rpm) {
        this.currentIndex = (idx + 1) % this.keys.length;
        key.currentRpm++;
        return key.key;
      }
    }

    // Tất cả keys đều hết quota - trả về key ít used nhất
    const leastUsed = this.keys.reduce((min, k) => 
      k.isHealthy && k.currentRpm < min.currentRpm ? k : min
    , this.keys[0]);

    if (leastUsed && leastUsed.isHealthy) {
      leastUsed.currentRpm++;
      return leastUsed.key;
    }

    return null;
  }

  markSuccess(key: string): void {
    const config = this.keys.find(k => k.key === key);
    if (config) {
      config.consecutiveFailures = 0;
      console.log(`✅ API Key success (failures reset)`);
    }
  }

  markFailure(key: string): void {
    const config = this.keys.find(k => k.key === key);
    if (config) {
      config.consecutiveFailures++;
      if (config.consecutiveFailures >= 3) {
        config.isHealthy = false;
        console.warn(`⚠️ API Key marked unhealthy after ${config.consecutiveFailures} failures`);
        
        // Thử khôi phục sau 2 phút
        setTimeout(() => {
          config.isHealthy = true;
          config.consecutiveFailures = 0;
          console.log(`✅ API Key recovered`);
        }, 120000);
      }
    }
  }

  private resetExpiredCounters(): void {
    const now = Date.now();
    for (const key of this.keys) {
      if (now - key.lastReset > this.RPM_WINDOW_MS) {
        key.currentRpm = 0;
        key.lastReset = now;
      }
    }
  }
}

class ModelManager {
  private configs: ModelConfig[] = [];
  private currentIndex = 0;
  private disabledModels: Map<string, number> = new Map();

  constructor() {
    // Sắp xếp theo priority (nhẹ nhất, ổn định nhất lên đầu)
    this.configs = [...MODEL_CONFIGS].sort((a, b) => a.priority - b.priority);
    console.log(`🤖 Model configs: ${this.configs.map(c => c.name).join(', ')}`);
  }

  getNextAvailableModel(): string | null {
    const now = Date.now();

    // Thử từng model theo priority
    for (let i = 0; i < this.configs.length; i++) {
      const idx = (this.currentIndex + i) % this.configs.length;
      const config = this.configs[idx];

      // Kiểm tra nếu model bị disable tạm thời
      const disabledUntil = this.disabledModels.get(config.name);
      if (disabledUntil && now < disabledUntil) {
        continue;
      }

      // Xóa disable cũ
      if (disabledUntil && now >= disabledUntil) {
        this.disabledModels.delete(config.name);
      }

      this.currentIndex = (idx + 1) % this.configs.length;
      return config.name;
    }

    // Tất cả đều disabled - reset và trả về model đầu tiên
    this.disabledModels.clear();
    return this.configs[0]?.name || null;
  }

  markRateLimited(model: string): void {
    // Disable model trong 30 giây khi bị rate limit
    this.disabledModels.set(model, Date.now() + 30000);
    console.warn(`⏳ Model ${model} rate limited, disabled for 30s`);
  }

  markSuccess(model: string): void {
    // Xóa disable nếu có
    this.disabledModels.delete(model);
  }

  markConsecutiveFailure(model: string): void {
    // Disable lâu hơn nếu liên tục fail
    const existing = this.disabledModels.get(model) || Date.now();
    const newTimeout = Math.min(300000, (existing - Date.now()) + 60000);
    this.disabledModels.set(model, Date.now() + newTimeout);
    console.warn(`⏳ Model ${model} consecutive failures, disabled for ${newTimeout / 1000}s`);
  }

  getStats(): { model: string; disabled: boolean }[] {
    const now = Date.now();
    return this.configs.map(c => ({
      model: c.name,
      disabled: (this.disabledModels.get(c.name) || 0) > now,
    }));
  }
}

// Singleton instances
const apiKeyManager = new APIKeyManager();
const modelManager = new ModelManager();

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ChatResponse {
  text: string;
  model?: string;
  keyRotated?: boolean;
}

export interface GeminiStats {
  keysHealthy: number;
  keysTotal: number;
  modelsDisabled: number;
  modelsTotal: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isRateLimitError(error: any): boolean {
  const message = error?.message || '';
  return (
    message.includes('high demand') ||
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('quota') ||
    message.includes('Too Many Requests')
  );
}

function isServerError(error: any): boolean {
  const message = error?.message || '';
  return (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('Server error') ||
    message.includes('Internal Server Error')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 5000]; // Exponential backoff

/**
 * Gọi Gemini API với multi-key và multi-model rotation
 */
async function callGeminiAPI(
  model: string,
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  systemInstruction?: string
): Promise<{ success: boolean; data?: any; error?: any }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
          contents: messages.map((msg) => ({
            role: msg.role,
            parts: [{ text: msg.content }],
          })),
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    clearTimeout(timeoutId);

    const data: any = await response.json();

    if (!response.ok) {
      const apiMessage = data?.error?.message || `HTTP ${response.status}`;
      return { success: false, error: new Error(`${model}: ${apiMessage}`) };
    }

    return { success: true, data };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: new Error('Request timeout') };
    }
    return { success: false, error };
  }
}

/**
 * Send chat message với full retry logic và rotation
 */
export async function sendChatMessage(
  messages: Array<{ role: 'user' | 'model'; content: string }>,
  systemInstruction?: string
): Promise<ChatResponse> {
  if (!apiKeyManager.hasKeys()) {
    throw new Error('GEMINI_API_KEY hoặc GEMINI_API_KEYS chưa được cấu hình trong .env');
  }

  const triedCombinations = new Set<string>();
  let lastError: Error | null = null;

  // Thử với mỗi lần gọi: key mới + model mới
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const apiKey = apiKeyManager.getAvailableKey();
    const model = modelManager.getNextAvailableModel();

    if (!apiKey || !model) {
      // Chờ và thử lại
      console.log(`⏳ All keys/models busy, waiting ${RETRY_DELAYS[attempt]}ms...`);
      await sleep(RETRY_DELAYS[attempt]);
      continue;
    }

    const combo = `${model}:${apiKey.slice(-4)}`;
    if (triedCombinations.has(combo)) {
      continue;
    }
    triedCombinations.add(combo);

    console.log(`📤 Attempt ${attempt + 1}: model=${model}, key=***${apiKey.slice(-4)}`);

    const result = await callGeminiAPI(model, apiKey, messages, systemInstruction);

    if (result.success && result.data) {
      const text = result.data.candidates?.[0]?.content?.parts
        ?.map((part: any) => part.text || '')
        .join('')
        .trim();

      if (text) {
        apiKeyManager.markSuccess(apiKey);
        modelManager.markSuccess(model);
        return { text, model, keyRotated: attempt > 0 };
      } else {
        lastError = new Error('Gemini returned empty response');
      }
    } else {
      lastError = result.error;

      if (isRateLimitError(lastError)) {
        console.warn(`⚠️ Rate limit: ${model}`);
        modelManager.markRateLimited(model);
        apiKeyManager.markFailure(apiKey);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      if (isServerError(lastError)) {
        console.warn(`⚠️ Server error: ${model}`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }

      // Lỗi khác - thử model khác
      modelManager.markConsecutiveFailure(model);
      await sleep(RETRY_DELAYS[attempt]);
    }
  }

  // Fallback: Thử embedding model cho simple responses
  console.log('🔄 Trying embedding-based fallback...');
  const fallbackText = await tryEmbeddingFallback(messages[messages.length - 1]?.content || '');
  if (fallbackText) {
    return { text: fallbackText, model: 'embedding-fallback', keyRotated: true };
  }

  throw new Error(`Gemini API failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Fallback đơn giản dùng recipe search thay vì AI
 */
async function tryEmbeddingFallback(query: string): Promise<string | null> {
  try {
    // Import dynamic để tránh circular dependency
    const { searchFallbackRecipes } = await import('./ragService');
    const results = await searchFallbackRecipes(query);
    
    if (results.length > 0) {
      return `Mình đang gặp lỗi kết nối AI. Dựa trên tìm kiếm, đây là gợi ý:\n\n${
        results.slice(0, 3).map((r, i) => `${i + 1}. ${r.recipeName}`).join('\n')
      }\n\nBạn có thể hỏi lại sau ít phút.`;
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

/**
 * Get embedding với multi-key rotation
 */
export async function getEmbedding(text: string): Promise<EmbeddingResult> {
  if (!apiKeyManager.hasKeys()) {
    throw new Error('GEMINI_API_KEY chưa được cấu hình');
  }

  const apiKey = apiKeyManager.getAvailableKey();
  if (!apiKey) {
    throw new Error('Tất cả API keys đều đang bận');
  }

  const model = 'gemini-embedding-001';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Embedding API error: ${response.status} ${errorText}`);
    }

    const data = await response.json() as any;
    apiKeyManager.markSuccess(apiKey);

    return {
      embedding: data.embedding?.values || [],
      model,
    };
  } catch (error: any) {
    apiKeyManager.markFailure(apiKey);
    throw new Error(`Failed to get embedding: ${error.message}`);
  }
}

/**
 * Get batch embeddings
 */
export async function getBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];
  
  // Rate limit: 3 embeddings/s với free tier
  const results: EmbeddingResult[] = [];
  for (const text of texts) {
    try {
      const result = await getEmbedding(text);
      results.push(result);
      await sleep(350); // ~3 req/s limit
    } catch (error) {
      console.error('Batch embedding error:', error);
    }
  }
  return results;
}

/**
 * Stream chat message
 */
export async function streamChatMessage(
  messages: Array<{ role: 'user' | 'model'; content: string }>,
  systemInstruction?: string,
  onChunk?: (text: string) => void
): Promise<ChatResponse> {
  // Streaming không hỗ trợ retry tốt, chuyển sang non-streaming
  const response = await sendChatMessage(messages, systemInstruction);
  onChunk?.(response.text);
  return response;
}

/**
 * Check health
 */
export async function checkGeminiHealth(): Promise<boolean> {
  try {
    await getEmbedding('health check');
    return true;
  } catch {
    return false;
  }
}

/**
 * Get statistics
 */
export function getGeminiStats(): GeminiStats {
  return {
    keysHealthy: apiKeyManager['keys'].filter(k => k.isHealthy).length,
    keysTotal: apiKeyManager['keys'].length,
    modelsDisabled: modelManager.getStats().filter(m => m.disabled).length,
    modelsTotal: MODEL_CONFIGS.length,
  };
}

/**
 * Get Chat Model instance (singleton) - exported for ragChain compatibility
 */
export function getChatModel() {
  // Legacy compatibility - returns null since we're using direct API calls now
  return null;
}

export default {
  getEmbedding,
  getBatchEmbeddings,
  sendChatMessage,
  streamChatMessage,
  checkGeminiHealth,
  getGeminiStats,
  getChatModel,
};
