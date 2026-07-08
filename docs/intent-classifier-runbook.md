# Intent Classifier - Runbook

## Overview

Hệ thống Intent Classification cho chatbot CookSmart, gồm:
- **5-tier Rule-based Classifier** với Vietnamese Normalize
- **Router** tách quyết định canned/db_lookup/rag/clarify/offtopic
- **Conversation Context** in-memory (10 tin nhắn gần nhất, TTL 30 phút)
- **Reference Resolver** xử lý "món thứ N", "nó", "món đó"
- **RAG Prompt Builder** đưa context vào prompt cho Gemini

## File structure

```
src/backend/src/services/intent/
├── types.ts                # IntentType enum, IntentResult, ChatMessage, SessionContext
├── normalizer.ts           # normalizeVietnamese() + tokenize()
├── keywords.ts             # Tất cả keyword sets (STRONG/WEAK/NUTRITION/OFFTOPIC/...)
├── classifier.ts           # 5-tier classify functions + main classifyIntent()
├── router.ts               # routeByIntent(), canned responses
├── contextBuilder.ts       # resolveReferences() + buildConversationContext()
├── ragPrompt.ts            # buildRAGPrompt() cho RAG
├── sessionStore.ts         # In-memory Map<sessionId, SessionContext>
└── pipeline.ts             # Orchestrator: classify → route → action

src/backend/src/__tests__/intent/
├── normalizer.test.ts          # 14 tests
├── sessionStore.test.ts        # 13 tests
├── classifier.test.ts          # 80+ tests
├── router.test.ts              # 17 tests
├── contextBuilder.test.ts      # 15 tests
├── pipeline.test.ts            # 14 tests
└── performance.test.ts         # 3 perf tests
```

## Cấu hình (sửa trong source code)

File: `src/backend/src/services/intent/sessionStore.ts`

```typescript
export const MAX_MESSAGES_PER_SESSION = 10;        // Số tin nhắn giữ trong context
export const SESSION_TTL_MS = 30 * 60 * 1000;     // 30 phút - TTL session
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 phút - chu kỳ cleanup
export const MAX_ACTIVE_INGREDIENTS = 5;          // Số nguyên liệu active
```

## Chạy tests

```bash
cd src/backend
npm test                          # tất cả tests
npm test -- --testPathPattern=intent  # chỉ intent tests
```

Kết quả mong đợi: **150/150 tests pass**.

## Debug khi classifier sai

### 1. Xem log
Mỗi message đều log JSON với structure:
```json
{
  "timestamp": "2026-07-06T15:42:03.638Z",
  "query": "user input",
  "resolvedQuery": "after reference resolution",
  "normalized": "lowercase + bỏ dấu",
  "intent": "recipe_search",
  "confidence": 0.85,
  "matchedTier": 4,
  "hasContext": true,
  "contextSize": 5
}
```

Tìm trong console: `[IntentClassifier] {...}`

### 2. Common false positives

| Input | Expected | Actual | Cách fix |
|-------|----------|--------|----------|
| "bánh xe" | OFFTOPIC | RECIPE_SEARCH | Đã thêm bigram check (đã fix) |
| "ca sĩ" | OFFTOPIC | RECIPE_SEARCH | Đã thêm OFFTOPIC check + ngăn weak food |
| "cháo" (alone) | GREETING | RECIPE_SEARCH | Đã check FOOD_AFTER_CHAO (đã fix) |
| "cháo gà" | RECIPE_SEARCH | - | OK |
| "cách làm phở bò" | RECIPE_DETAIL | OK | OK |

### 3. Thêm keyword mới

Mở `src/backend/src/services/intent/keywords.ts`:

```typescript
// Ví dụ: thêm "đậu phụ" vào STRONG_FOOD_KEYWORDS
export const STRONG_FOOD_KEYWORDS = new Set<string>([
  // ...existing...
  'dau phu',
  'dau hu',
]);
```

Sau đó thêm test case mới vào `classifier.test.ts`:

```typescript
it('"đậu phụ" → RECIPE_SEARCH', () => {
  expect(classifyIntent('đậu phụ').primaryIntent).toBe(IntentType.RECIPE_SEARCH);
});
```

### 4. Thêm canned response

Mở `src/backend/src/services/intent/router.ts`:

```typescript
const CANNED_RESPONSES: Record<IntentType, string[]> = {
  [IntentType.GREETING]: [
    'Xin chào bạn!...',
    'Chào bạn!...',
    // Thêm response mới ở đây
  ],
  // ...
};
```

## Pipeline flow

```
User Query
  ↓
[1] getSessionContext(sessionId) → lấy session từ RAM
  ↓
[2] buildConversationContext() → resolve tham chiếu ("món thứ 2" → "Gà xào")
  ↓
[3] classifyIntent(resolvedQuery, messages) → IntentResult
  ↓
[4] routeByIntent(result) → RouteType
  ↓
[5] Execute theo route:
  - CANNED → getCannedResponse() (no LLM)
  - OFFTOPIC_RESPONSE → getOfftopicResponse() (no LLM)
  - CLARIFY → getClarifyResponse() (no LLM)
  - DB_LOOKUP → processRAGQuery() (LLM call)
  - RAG → processRAGQuery() (LLM call)
  ↓
[6] extractDishReferences() từ response
  ↓
[7] addMessageToSession() cho cả user + assistant
```

## Performance baseline

| Operation | Avg latency |
|-----------|-------------|
| Classifier | ~0.03ms |
| Session lookup | ~0.0006ms |
| Context build | ~0.012ms |
| **Pipeline overhead** | **<20ms** (chưa tính RAG/LLM) |

Target: Giảm **≥50%** lượt gọi Gemini API (do CANNED/OFFTOPIC/CLARIFY không gọi LLM).

## Khi nào cần nâng cấp

1. **Multi-server (load balancing)** → Cần Redis shared. Hiện tại in-memory, mỗi server có context riêng.
2. **Lưu lịch sử lâu dài** → DB hiện đã lưu `chat_messages` và `chat_sessions`. Có thể thêm option để rehydrate context từ DB khi user quay lại sau restart.
3. **Accuracy thấp** → Mở rộng keyword sets hoặc nâng cấp lên Embedding/LLM hybrid classifier.

## API changes

### Frontend
- REST `POST /chat/send-message` giờ trả thêm field `intent` và `route` để debug.
- Socket `chat:message` event giờ cũng có `intent` và `route`.

### Socket events mới
- `chat:clear-context` → xóa session context (in-memory)

## Known limitations

1. **Chỉ 1 user per session** - nếu nhiều user share session, context sẽ lẫn lộn (cần fix khi multi-user).
2. **Không có fallback cho multi-intent** - hiện chỉ route theo `primaryIntent`, `secondaryIntents` chưa được sử dụng trong router.
3. **Reference resolution không xử lý nested** - chỉ resolve 1 cấp ("món thứ 2" OK, "món thứ 2 trong danh sách đó" chưa).

## Khi deploy production

1. Test lại với log monitor để detect miss-classification
2. Setup alerting khi `intent.confidence < 0.5` xảy ra nhiều (dấu hiệu model chưa cover edge case)
3. Đo lại `Gemini API call reduction` để verify target
4. Backup keyword sets để rollback nhanh nếu có regression