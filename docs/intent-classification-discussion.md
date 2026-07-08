> **Trạng thái:** Implemented v1 (2026-07-06) - Đã triển khai đầy đủ 5 phases, 150/150 unit tests pass, tích hợp vào chatController + socketServer
>
> **Phiên bản:** v1 (rule-based cơ bản) → v2 (thêm CLARIFY, multi-intent, tách Router) → v3 (sửa 6 lỗi logic quan trọng) → v4 (Conversation Context Layer với Redis) → **v5 (Simplified - In-Memory Context, implemented)**

## 0. Lịch sử chỉnh sửa

| Phiên bản | Thay đổi chính |
|-----------|----------------|
| v1 | Rule-based đơn giản, default fallback = RECIPE_SEARCH |
| v2 | Thêm CLARIFY, multi-intent (primaryIntent + secondaryIntents), tách Classifier/Router, xử lý "chao" vs "chao ga", blacklist false positive phrases |
| v3 | **Sửa 6 lỗi logic:**<br>1. `hasKeyword()` match n-gram chính xác (không dùng `includes()` tự do)<br>2. Điều kiện false positive: `\|\|` → `&&`<br>3. Extract entities dùng `normalized` (không dùng `query` gốc)<br>4. Bỏ UNKNOWN enum, chỉ giữ CLARIFY<br>5. Chia keyword thành STRONG vs WEAK để tránh nhiễu<br>6. Bổ sung test cases cho các case nhiễu + check `secondaryIntents` trong test runner |

### Đánh giá tổng quan (lần 2)

| Hạng mục | Đánh giá v2 | Đánh giá v3 |
|----------|--------------|--------------|
| Ý tưởng kiến trúc | Tốt (8.5/10) | Tốt (8.5/10) |
| Phù hợp MVP | Tốt | Tốt |
| Khả năng giảm API call | Tốt | Tốt |
| Xử lý tiếng Việt | Khá | **Tốt hơn** (có strong/weak signal) |
| Code hiện tại | Cần sửa (6.5/10) | **Đã sửa** (8/10) |
| Unit test | Có hướng | **Đầy đủ hơn** với edge cases |

**Điểm tổng v3: 8/10** — Sẵn sàng triển khai MVP sau khi pass test ≥95%.

---

# Intent Classification - Vấn đề & Giải pháp cho Chatbot CookSmart

> **Mục đích:** Tài liệu mô tả bài toán phân loại intent (intent classification) cho chatbot CookSmart, các thách thức cụ thể khi xử lý tiếng Việt, và các hướng giải quyết đã được thảo luận.

---

## 1. Bối cảnh & Mục tiêu

### 1.1. Bài toán
Chatbot CookSmart cần **phân loại intent** (mục đích) của câu hỏi người dùng để quyết định:
- Trả lời canned (greeting/thanks/farewell) — không gọi AI
- Truy vấn database trực tiếp (recipe detail) — không gọi AI
- Gọi RAG pipeline (recipe search) — gọi AI 1 lần
- Redirect về topic khác (off-topic) — không gọi AI
- Hỏi lại user khi câu mơ hồ (clarify) — không gọi AI

### 1.2. Mục tiêu chính
- **Giảm số lượng API call đến Gemini** (tối ưu chi phí + latency)
- **Tăng tốc độ phản hồi** cho các intent cơ bản
- **Duy trì độ chính xác cao** cho các intent phức tạp
- **Tránh fallback quá rộng** gây gọi AI không cần thiết

### 1.3. Kiến trúc đề xuất: Classifier → Router → Action

```
User Query
   ↓
Intent Classifier  ← chỉ trả về IntentResult (intent, confidence, tier)
   ↓
Router            ← quyết định route dựa trên confidence và intent
   ↓
Action            ← canned / db_lookup / rag / clarify / offtopic_response
```

> **Nguyên tắc:** Classifier **KHÔNG** tự quyết định gọi AI. Router mới quyết định.

### 1.4. Các intent cần phân loại
```typescript
enum IntentType {
  // Xã giao (Tier 1 - confidence cao, không gọi AI)
  GREETING = 'greeting',           // Chào hỏi, xã giao
  FAREWELL = 'farewell',            // Tạm biệt
  THANKS = 'thanks',                // Cảm ơn, khen ngợi
  HELP = 'help',                    // Yêu cầu trợ giúp
  WHO_ARE_YOU = 'who_are_you',      // Hỏi về bot

  // Nấu ăn (Tier 4 - gọi AI qua RAG)
  RECIPE_DETAIL = 'recipe_detail',  // Hỏi chi tiết cách làm món cụ thể
  RECIPE_SEARCH = 'recipe_search',  // Tìm món ăn, công thức

  // Dinh dưỡng (Tier 3 - gọi AI qua RAG với context dinh dưỡng)
  NUTRITION = 'nutrition',          // Câu hỏi về dinh dưỡng

  // Ngoài phạm vi (Tier 2 - không gọi AI)
  OFFTOPIC = 'offtopic',            // Không liên quan nấu ăn

  // Mơ hồ (Tier 5 - KHÔNG gọi AI, hỏi lại user)
  CLARIFY = 'clarify',              // Cần hỏi lại user
}

// Đã bỏ UNKNOWN - với MVP chỉ cần CLARIFY vì action cuối cùng vẫn là hỏi lại user
```

### 1.5. IntentResult - Hỗ trợ multi-intent
```typescript
type IntentResult = {
  primaryIntent: IntentType;
  secondaryIntents?: IntentType[];  // Intent phụ (nếu có)
  confidence: number;                // 0-1
  matchedTier: number;               // Tier 1-5
  entities?: {
    ingredients?: string[];          // VD: ['uc ga', 'thit bo']
    dishName?: string;               // VD: 'pho bo'
    nutritionTerms?: string[];       // VD: ['it calo', 'protein']
  };
  // QUAN TRỌNG: Context từ hội thoại cũ để LLM hiểu ngữ cảnh
  context?: {
    recentMessages?: ChatMessage[];  // 5-10 tin nhắn gần nhất
    currentDish?: string;            // Món đang thảo luận
    currentIngredients?: string[];   // Nguyên liệu đang được nhắc
    previousIntent?: IntentType;     // Intent của câu trước
  };
};
```

### 1.6. Conversation Context Layer (QUAN TRỌNG - In-Memory)

**Vấn đề thực tế:** Nhiều câu hỏi của user **chỉ có nghĩa khi có context từ câu trước**. Ví dụ:

```
User: "gợi ý món từ thịt gà"
Bot:  "Bạn có thể thử: Gà kho gừng, Gà xào hành tây, Gà nướng mật ong..."
User: "cách làm món thứ 2"          ← KHÔNG CÓ CONTEXT thì không hiểu "món thứ 2" là gì
User: "bao nhiêu calo?"              ← KHÔNG CÓ CONTEXT thì không biết hỏi calo của món nào
User: "thay bằng cá được không"      ← Cần biết đang nói món gì để tư vấn thay thế
```

Nếu không đưa context vào prompt, LLM sẽ trả lời sai hoặc phải hỏi lại user → tốn token + latency.

**Giải pháp:** Thêm **Conversation Context Layer** nằm giữa Router và Action:

```
User Query (mới)
   ↓
Intent Classifier (có context awareness)
   ↓
Router
   ↓
Context Builder     ← Lấy 5-10 tin nhắn gần nhất từ RAM (session hiện tại)
   ↓
RAG Prompt          ← Query + Context + Entities → LLM
   ↓
Response
```

**Nguyên tắc Context Window:**
- Lưu context **in-memory** (Map trong RAM) - không cần DB
- Lấy **5-10 tin nhắn gần nhất** (đủ để hiểu flow mà không tốn quá nhiều token)
- Chỉ giữ trong **session hiện tại** - mất khi user logout/refresh/restart server
- **Tự động xóa** sau 30 phút không hoạt động
- **Ưu tiên tin nhắn có chứa entity** (món ăn, nguyên liệu)

**Ví dụ context được đưa vào prompt:**

```typescript
// Context object được build trước khi gọi LLM
const contextForLLM = {
  conversation: [
    { role: 'user', content: 'gợi ý món từ thịt gà' },
    { role: 'assistant', content: 'Bạn có thể thử: Gà kho gừng, Gà xào hành tây, Gà nướng mật ong...' },
    { role: 'user', content: 'cách làm món thứ 2' },  // ← Câu hiện tại
  ],
  currentDish: 'Gà xào hành tây',                     // ← Resolved từ "món thứ 2"
  currentIngredients: ['thit ga', 'hanh tay'],         // ← Trích từ context
  previousIntent: IntentType.RECIPE_SEARCH,
};
```

---

## 2. Các hướng giải quyết đã xem xét

### 2.1. Rule-based Classification (✅ Chọn cuối cùng)

**Mô tả:** Sử dụng regex patterns + keyword matching + normalize tiếng Việt để phân loại intent.

**Ưu điểm:**
- Latency cực thấp (<1ms)
- Không tốn API call
- Dễ debug, dễ maintain
- Chi phí = 0

**Nhược điểm:**
- Khó handle câu hỏi phức tạp, nhiều context
- Phải maintain patterns thủ công
- Rủi ro cao với tiếng Việt (xem mục 3)

### 2.2. Embedding-based Classification (❌ Không chọn cho MVP)

**Mô tả:** So sánh vector embedding của query với các ví dụ mẫu cho từng intent.

**Ưu điểm:**
- Hiểu ngữ nghĩa
- Robust với paraphrase

**Nhược điểm:**
- Vẫn tốn embedding call (~200ms)
- Cần pre-compute examples
- Cần threshold tuning

### 2.3. LLM-based Classification (❌ Không chọn)

**Mô tả:** Gọi Gemini để phân loại intent.

**Nhược điểm:**
- **Tốn 1 API call/query** (đi ngược mục tiêu)
- Latency +1-3s
- Chi phí tăng

**Kết luận:** ❌ Đi ngược lại mục tiêu chính.

### 2.4. Hybrid: Rule + LLM fallback (❌ Không chọn)

Vẫn tốn API call cho query không match rule.

### 2.5. Hybrid: Rule ngắn, LLM dài (❌ Không chọn)

**Lý do:** Độ dài không phải yếu tố quyết định intent. Query dài thường có keyword rõ ràng, không cần LLM.

---

## 3. Thách thức cụ thể với tiếng Việt

### 3.1. Từ đa nghĩa (Polysemy)

| Từ khóa | Nghĩa nấu ăn | Nghĩa khác |
|---------|--------------|------------|
| "gà" | món gà, gà xào | con gà, gà nhà hàng xóm |
| "cá" | món cá, cá kho | cá cảnh, cá ở ao |
| "bánh" | bánh ngọt, bánh mì | bánh xe, bánh canh |
| "canh" | canh chua, canh rau | canh gì? |
| "xào" | mì xào, gà xào | xào gì? |

### 3.2. Không có dấu thanh

- "món gà" vs "món ga" (ga = xe đạp)
- "món cá" vs "món ca" (ca = ca sĩ)

### 3.3. Sai chính tả (Typo)

- "món gà nhanh" → "món gà nhan"

### 3.4. Từ đồng âm, khác nghĩa sau normalize

> **⚠️ LỖI NGHIÊM TRỌNG:** Sau khi normalize bỏ dấu, "chào" và "cháo" đều thành "chao". Nếu dùng regex `/^(chao|hi|hello|hey)\b/` thì câu "cháo gà" sẽ bị hiểu nhầm là GREETING.

```typescript
// ❌ SAI
"chao ga" → matched GREETING → response "Xin chào bạn!"

// ✅ ĐÚNG - phải check context sau "chao"
function isGreeting(normalized: string, tokens: string[]): boolean {
  if (tokens[0] === 'chao') {
    if (tokens.length === 1) return true;
    if (['ban', 'bot', 'cooksmart', 'nha', 'ca', 'cac'].includes(tokens[1])) return true;
    // Nếu sau "chao" là nguyên liệu/món → không phải greeting
    if (FOOD_AFTER_CHAO.includes(tokens[1])) return false;
  }
  return /^(hi|hello|hey)\b/.test(normalized);
}
```

### 3.5. Tiếng Việt phụ thuộc context

| Câu | Intent |
|-----|--------|
| "Nấu gì?" | RECIPE_SEARCH |
| "Nấu gì cho con ăn?" | NUTRITION + RECIPE_SEARCH |
| "Hôm nay nấu gì đây?" | SMALLTALK hoặc RECIPE_SEARCH |
| "Đừng nấu gì cả" | OFFTOPIC |

### 3.6. Độ dài không tương quan với độ phức tạp

| Query | Số từ | Rule match? |
|-------|-------|-------------|
| "chào" | 1 | ✓ Dễ |
| "gì" | 1 | ⚠️ Khó (GREETING/OFFTOPIC?) |
| "mì tôm calo" | 3 | ⚠️ Khó (NUTRITION + RECIPE) |
| "Hôm nay tôi muốn nấu món gì đó với gà" | 11 | ✓ Dễ (có keyword) |

### 3.7. Keyword không đủ để quyết định

- "Tôi ghét nấu ăn" → có "nấu ăn" nhưng là OFFTOPIC
- "Bạn có thích ăn gà không?" → có "gà" nhưng là SMALLTALK
- "Gà có nhiều protein" → có "gà" nhưng là NUTRITION

### 3.8. Cụm từ gây nhiễu (False Positive Food Phrases)

| Cụm từ | Vấn đề |
|---------|--------|
| "bánh xe" | xe đạp, xe ô tô |
| "gà tâu" | gà tây (loại gia cầm) nhưng cũng có thể nghĩa khác |
| "gà điên" | tục ngữ, không phải món ăn |
| "ca sĩ" | nghề nghiệp |
| "cá nhân" | cá nhân (riêng tư) |
| "ăn gian" | gian lận |
| "ăn cắp" | hành vi xấu |
| "bỏ qua" | hành động |
| "bổ sung" | hành động |

---

## 4. Rủi ro lớn từ phương án ban đầu (CẬP NHẬT)

### Rủi ro 1: Default fallback = RECIPE_SEARCH gây gọi RAG quá nhiều

**Vấn đề:** Câu như "tôi buồn quá", "bạn có người yêu chưa", "gì vậy", "nói tiếp đi" rơi vào fallback RECIPE_SEARCH → vẫn gọi RAG không cần thiết.

**Giải pháp:** Đổi fallback cuối sang **UNKNOWN/CLARIFY** + hỏi lại user.

```typescript
// Response mẫu cho CLARIFY
"Bạn muốn mình gợi ý món ăn, tìm công thức, hay tư vấn dinh dưỡng?"
```

### Rủi ro 2: Lỗi normalize "chào" vs "cháo"

**Giải pháp:** Check token sau "chao" trước khi kết luận GREETING.

### Rủi ro 3: Chỉ return 1 intent duy nhất

**Vấn đề:** "mì tôm bao nhiêu calo" vừa NUTRITION vừa RECIPE_SEARCH.

**Giải pháp:** Return multi-intent.

---

## 5. Giải pháp: Multi-tier Rule-based + Normalize + Classifier/Router tách rời

### 5.1. Kiến trúc

```
User Query
   ↓
Normalize tiếng Việt
   ↓
Intent Classifier (Tier 1 → 5)
   ↓ (IntentResult)
Router (dựa vào confidence + intent)
   ↓ (Route: canned / db / rag / clarify / offtopic)
Action Handler
```

### 5.2. Normalize tiếng Việt

```typescript
function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

### 5.3. Multi-tier Classification Flow (ĐÃ SẮP XẾP LẠI)

```
User query
    ↓
Normalize
    ↓
┌─────────────────────────────────────────────┐
│ Tier 1: Câu xã giao chắc chắn               │ → GREETING, THANKS, FAREWELL, HELP, WHO_ARE_YOU
│ (check "chao" + token sau)                  │   confidence: 0.95
└─────────────────────────────────────────────┘
    │ (no match)
    ▼
┌─────────────────────────────────────────────┐
│ Tier 2: Off-topic rõ ràng                   │ → OFFTOPIC
│ (keywords rõ ràng: thời tiết, bóng đá...)  │   confidence: 0.90
└─────────────────────────────────────────────┘
    │ (no match)
    ▼
┌─────────────────────────────────────────────┐
│ Tier 3: Nhận diện nutrition                 │ → NUTRITION (+ RECIPE_SEARCH?)
│ (calo, protein, dinh dưỡng, tăng cân...)   │   confidence: 0.85
└─────────────────────────────────────────────┘
    │ (no match)
    ▼
┌─────────────────────────────────────────────┐
│ Tier 4: Recipe detail / Recipe search       │ → RECIPE_DETAIL / RECIPE_SEARCH
│ (cách làm, công thức, keyword nấu ăn...)   │   confidence: 0.80
└─────────────────────────────────────────────┘
    │ (no match)
    ▼
┌─────────────────────────────────────────────┐
│ Tier 5: Ambiguous / Clarify                 │ → CLARIFY (hỏi lại user)
│ (query ngắn, không có keyword rõ ràng)     │   confidence: < 0.50
└─────────────────────────────────────────────┘
```

### 5.4. Implementation đầy đủ

```typescript
import { normalizeVietnamese } from './utils/vietnamese';

enum IntentType {
  GREETING = 'greeting',
  FAREWELL = 'farewell',
  THANKS = 'thanks',
  HELP = 'help',
  WHO_ARE_YOU = 'who_are_you',
  RECIPE_DETAIL = 'recipe_detail',
  RECIPE_SEARCH = 'recipe_search',
  NUTRITION = 'nutrition',
  OFFTOPIC = 'offtopic',
  CLARIFY = 'clarify',
}

type IntentResult = {
  primaryIntent: IntentType;
  secondaryIntents?: IntentType[];
  confidence: number;
  matchedTier: number;
  entities?: {
    ingredients?: string[];
    dishName?: string;
    nutritionTerms?: string[];
  };
};

// ============================================================
// KEYWORD SETS (normalized - không dấu)
// ============================================================

const FOOD_AFTER_CHAO = ['ga', 'vit', 'thit', 'bo', 'ca', 'long', 'suon', 'trai cay', 'ca rot', 'khoai'];

const FOOD_KEYWORDS = new Set([
  'mon', 'ga', 'bo', 'ca', 'tom', 'thit', 'heo', 'de', 'vit',
  'rau', 'cu', 'qua', 'trai cay', 'khoai', 'ca rot',
  'xao', 'kho', 'luoc', 'chien', 'hap', 'nuong', 'rim', 'chien', 'ran',
  'pho', 'bun', 'mi', 'com', 'chao', 'sup', 'lau',
  'banh', 'che', 'nuoc', 'canh',
  'chay', 'man', 'ngot', 'cay',
  'dau', 'toi', 'hanh', 'nghe', 'ot',
  'trung', 'sua', 'bo', 'pho mai',
]);

const NUTRITION_KEYWORDS = new Set([
  'dinh duong', 'calo', 'calories', 'protein', 'chat beo', 'chat xo',
  'giam can', 'tang can', 'an kieng', 'giam beo',
  'tieu duong', 'huyet ap', 'da day', 'di ung', 'khong hop',
  'healthy', 'organic', 'it beo', 'it duong', 'khong beo',
  'vitamin', 'khoang chat', 'canxi', 'sat',
  'khau phan', 'luong an', 'gram',
]);

const OFFTOPIC_KEYWORDS = new Set([
  'thoi tiet', 'bong da', 'tin tuc', 'phim', 'nhac', 'sach',
  'game', 'the thao', 'chinh tri', 'kinh te', 'chung khoan',
  'oto', 'xe may', 'xe hoi', 'nha', 'dat', 'bds',
  'tinh yeu', 'nguoi yeu', 'ban gai', 'ban trai',
  'cong viec', 'hoc tap', 'thi cu', 'truong hoc',
]);

// Cụm từ gây nhiễu - có chứa keyword nấu ăn nhưng không phải món ăn
const FOOD_FALSE_POSITIVE_PHRASES = [
  'banh xe', 'banh o to',
  'ca si', 'ca nhan', 'ca the',
  'canh tan', 'canh sat',
  'an gian', 'an cap', 'an nho', 'an bot',
  'bo qua', 'bo sung', 'bo hoc', 'bo phim',
  'toi pham', 'toi ac', 'toi khong',
  'dau duc', 'dau kho', 'dau bung',
  'benh tim', 'benh ho', 'benh nhan',
  'trai nghia', 'trai phai', 'trai tim',
];

const CLARIFY_PHRASES = new Set([
  'gi', 'gi vay', 'gi day', 'gi the', 'the ha',
  'noi di', 'noi tiep', 'tiep di', 'tiep tuc',
  'kho qua', 'toi khong biet',
  'nhu the nao', 'lam the nao', 'lam sao',
  'binh thuong', 'sao vay',
  'ban co nguoi yeu', 'ban co ban trai', 'ban co ban gai',
  'toi buon', 'toi met', 'toi chan',
]);

// ============================================================
// STRONG vs WEAK FOOD KEYWORDS (QUAN TRỌNG)
// ============================================================
// Sau khi normalize, nhiều keyword trở nên yếu vì chỉ là 2-3 ký tự
// VD: "ca" (cá/cá sĩ), "bo" (bò/bỏ/bộ), "toi" (tỏi/tôi), "dau" (đau/đậu)
// Nên phân chia thành strong (món cụ thể/động từ nấu ăn) và weak (nguyên liệu)

const STRONG_FOOD_KEYWORDS = new Set([
  // Món ăn cụ thể
  'pho bo', 'pho ga', 'bun cha', 'bun bo', 'com rang', 'com tam',
  'ga xao', 'bo xao', 'ga kho', 'ca kho', 'thit kho',
  'tom rang', 'tom xao', 'ca chien', 'thit nuong',
  // Từ chung về nấu ăn
  'mon an', 'cong thuc', 'cach lam', 'cach nau', 'cach che bien',
  'nguyen lieu', 'thuc an', 'do an', 'do uong', 'thuc uong',
  // Động từ nấu ăn
  'nau an', 'nau mon', 'lam mon', 'che bien', 'so che',
  // Tính từ nấu ăn
  'ngon mieng', 'de an', 'de lam', 'de nau', 'bo duong', 'it calo',
]);

const WEAK_FOOD_KEYWORDS = new Set([
  'ga', 'bo', 'ca', 'tom', 'thit', 'heo', 'de', 'vit',
  'rau', 'cu', 'qua', 'trai cay', 'khoai', 'ca rot',
  'xao', 'kho', 'luoc', 'chien', 'hap', 'nuong', 'rim', 'ran',
  'pho', 'bun', 'mi', 'com', 'chao', 'sup', 'lau',
  'banh', 'che', 'nuoc', 'canh',
  'chay', 'man', 'ngot', 'cay',
  'dau', 'toi', 'hanh', 'nghe', 'ot',
  'trung', 'sua', 'pho mai',
]);

// ============================================================
// TIER 1: EXACT PATTERNS (xã giao)
// ============================================================

function isGreetingWithContext(tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  if (tokens[0] !== 'chao') return false;
  
  // "chao" alone → greeting
  if (tokens.length === 1) return true;
  
  // "chao ban", "chao bot", "chao cooksmart"
  const allowedFollowers = ['ban', 'bot', 'cooksmart', 'nha', 'ca', 'cac', 'moi', 'nguoi'];
  if (allowedFollowers.includes(tokens[1])) return true;
  
  // "chao ga", "chao vit"... → không phải greeting
  if (FOOD_AFTER_CHAO.includes(tokens[1])) return false;
  
  // Default: "chao X" không rõ ràng → có thể là greeting
  return true;
}

function classifySocial(normalized: string, tokens: string[]): IntentResult | null {
  // Greeting - check context cẩn thận
  if (isGreetingWithContext(tokens)) {
    return { primaryIntent: IntentType.GREETING, confidence: 0.95, matchedTier: 1 };
  }
  
  // Hi/Hello/Hey (English)
  if (/^(hi|hello|hey)\b/.test(normalized)) {
    return { primaryIntent: IntentType.GREETING, confidence: 0.95, matchedTier: 1 };
  }
  
  // Thanks
  if (/^(cam on|thanks|thank you|cam on nhe|cam on nhieu)\b/.test(normalized) ||
      /\b(cam on ban|cam on bot|cam on cooksmart)\b/.test(normalized)) {
    return { primaryIntent: IntentType.THANKS, confidence: 0.95, matchedTier: 1 };
  }
  
  // Farewell
  if (/^(tam biet|bye|goodbye|see you|hen gap lai|chao tam biet)\b/.test(normalized)) {
    return { primaryIntent: IntentType.FAREWELL, confidence: 0.95, matchedTier: 1 };
  }
  
  // Help
  if (/^(giup|tro giup|help)\b/.test(normalized) ||
      /\b(giup to|giup minh|giup voi)\b/.test(normalized)) {
    return { primaryIntent: IntentType.HELP, confidence: 0.90, matchedTier: 1 };
  }
  
  // Who are you
  if (/\b(ban la ai|ban ten gi|gioi thieu ban|ban la gi|bot la ai)\b/.test(normalized)) {
    return { primaryIntent: IntentType.WHO_ARE_YOU, confidence: 0.90, matchedTier: 1 };
  }
  
  return null;
}

// ============================================================
// TIER 2: OFFTOPIC
// ============================================================

function hasFalsePositive(normalized: string): boolean {
  return FOOD_FALSE_POSITIVE_PHRASES.some(p => normalized.includes(p));
}

// ============================================================
// SỬA LỖI 1: hasKeyword() - Match theo token hoặc n-gram chính xác
// KHÔNG dùng includes() tự do để tránh false positive
// ============================================================

function hasKeyword(tokens: string[], keywordSet: Set<string>): boolean {
  const tokenSet = new Set(tokens);

  for (const kw of keywordSet) {
    const parts = kw.split(' ');

    if (parts.length === 1) {
      // Single token match - chính xác
      if (tokenSet.has(kw)) return true;
    } else {
      // N-gram match - so khớp cụm từ liền kề
      for (let i = 0; i <= tokens.length - parts.length; i++) {
        const gram = tokens.slice(i, i + parts.length).join(' ');
        if (gram === kw) return true;
      }
    }
  }

  return false;
}

// Helper: kiểm tra có strong food signal không
function hasStrongFoodSignal(tokens: string[]): boolean {
  return hasKeyword(tokens, STRONG_FOOD_KEYWORDS);
}

// Helper: kiểm tra có weak food signal không
function hasWeakFoodSignal(tokens: string[]): boolean {
  return hasKeyword(tokens, WEAK_FOOD_KEYWORDS);
}

function classifyOfftopic(normalized: string, tokens: string[]): IntentResult | null {
  // Check false positive phrases trước (tránh false positive food)
  if (hasFalsePositive(normalized)) {
    // SỬA LỖI 2: Đổi || thành && - chỉ OFFTOPIC khi không có CẢ HAI nhóm keyword
    const hasFood = hasKeyword(tokens, FOOD_KEYWORDS) || hasStrongFoodSignal(tokens);
    const hasNutrition = hasKeyword(tokens, NUTRITION_KEYWORDS);

    if (!hasFood && !hasNutrition) {
      return { primaryIntent: IntentType.OFFTOPIC, confidence: 0.85, matchedTier: 2 };
    }
  }

  // Check off-topic keywords
  if (hasKeyword(tokens, OFFTOPIC_KEYWORDS)) {
    return { primaryIntent: IntentType.OFFTOPIC, confidence: 0.90, matchedTier: 2 };
  }

  return null;
}

// ============================================================
// TIER 3: NUTRITION
// ============================================================

// SỬA LỖI 3: Truyền normalized vào và dùng normalized để extract entities
function classifyNutrition(normalized: string, tokens: string[]): IntentResult | null {
  if (!hasKeyword(tokens, NUTRITION_KEYWORDS)) return null;

  // Check có food keyword không
  const hasFood = hasKeyword(tokens, FOOD_KEYWORDS) || hasStrongFoodSignal(tokens);

  return {
    primaryIntent: IntentType.NUTRITION,
    secondaryIntents: hasFood ? [IntentType.RECIPE_SEARCH] : undefined,
    confidence: hasFood ? 0.85 : 0.80,
    matchedTier: 3,
    entities: {
      // SỬA LỖI 3: dùng normalized để tránh lệch ký tự
      nutritionTerms: Array.from(NUTRITION_KEYWORDS).filter(k => normalized.includes(k)),
      ingredients: hasFood ? Array.from(FOOD_KEYWORDS).filter(k => normalized.includes(k)) : undefined,
    },
  };
}

// ============================================================
// TIER 4: RECIPE_DETAIL / RECIPE_SEARCH
// ============================================================

const RECIPE_DETAIL_PREFIXES = [
  /^(cach lam|cong thuc|lam mon|cach nau|huong dan|chi tiet)/,
  /\b(cac buoc|buoc lam|huong dan chi tiet|cong thuc chi tiet)\b/,
];

// SỬA LỖI 5: Phân biệt strong vs weak food signal
function classifyRecipe(normalized: string, tokens: string[]): IntentResult | null {
  // Check recipe detail prefix
  const isRecipeDetail = RECIPE_DETAIL_PREFIXES.some(p => p.test(normalized));
  if (isRecipeDetail) {
    return {
      primaryIntent: IntentType.RECIPE_DETAIL,
      confidence: 0.85,
      matchedTier: 4,
    };
  }

  // Strong food signal → RECIPE_SEARCH chắc chắn
  if (hasStrongFoodSignal(tokens)) {
    const hasNutrition = hasKeyword(tokens, NUTRITION_KEYWORDS);

    return {
      primaryIntent: IntentType.RECIPE_SEARCH,
      secondaryIntents: hasNutrition ? [IntentType.NUTRITION] : undefined,
      confidence: 0.85,
      matchedTier: 4,
      entities: {
        ingredients: Array.from(STRONG_FOOD_KEYWORDS).filter(k => normalized.includes(k)),
      },
    };
  }

  // Weak food signal + có ngữ cảnh nấu ăn → RECIPE_SEARCH
  // VD: "gà", "bò", "cá" đứng một mình → CLARIFY
  // VD: "món gà", "gợi ý từ gà", "nấu gà" → RECIPE_SEARCH
  if (hasWeakFoodSignal(tokens)) {
    const cookingVerbs = ['nau', 'lam', 'goi y', 'tim', 'mon', 'cong thuc', 'cach'];
    const hasCookingContext = cookingVerbs.some(v => tokens.includes(v));

    if (hasCookingContext) {
      const hasNutrition = hasKeyword(tokens, NUTRITION_KEYWORDS);

      return {
        primaryIntent: IntentType.RECIPE_SEARCH,
        secondaryIntents: hasNutrition ? [IntentType.NUTRITION] : undefined,
        confidence: 0.75, // Hơi thấp vì chỉ dựa vào weak signal
        matchedTier: 4,
        entities: {
          ingredients: Array.from(WEAK_FOOD_KEYWORDS).filter(k => normalized.includes(k)),
        },
      };
    }
    // Weak signal alone → để cho Tier 5 (Clarify) xử lý
  }

  return null;
}

// ============================================================
// TIER 5: CLARIFY (mặc định)
// ============================================================

function classifyClarify(tokens: string[], normalized: string): IntentResult {
  // Check clarify phrases
  const isClarifyPhrase = CLARIFY_PHRASES.has(normalized) ||
                          Array.from(CLARIFY_PHRASES).some(p => normalized.includes(p));
  if (isClarifyPhrase) {
    return { primaryIntent: IntentType.CLARIFY, confidence: 0.70, matchedTier: 5 };
  }

  // Query cực ngắn (≤ 2 tokens) không có strong keyword
  if (tokens.length <= 2) {
    return { primaryIntent: IntentType.CLARIFY, confidence: 0.50, matchedTier: 5 };
  }

  // Query ngắn (≤ 5 tokens) chỉ có weak food keyword, không có cooking context
  if (tokens.length <= 5 && !hasStrongFoodSignal(tokens)) {
    return { primaryIntent: IntentType.CLARIFY, confidence: 0.55, matchedTier: 5 };
  }

  // Default - không match gì nhưng có vẻ là câu hỏi
  return { primaryIntent: IntentType.CLARIFY, confidence: 0.40, matchedTier: 5 };
}

// ============================================================
// MAIN CLASSIFIER
// ============================================================

export function classifyIntent(query: string): IntentResult {
  const normalized = normalizeVietnamese(query);
  const tokens = normalized.split(' ').filter(t => t.length > 0);
  
  // Tier 1: Social (xã giao)
  const socialResult = classifySocial(normalized, tokens);
  if (socialResult) return socialResult;
  
  // Tier 2: Offtopic
  const offtopicResult = classifyOfftopic(normalized, tokens);
  if (offtopicResult) return offtopicResult;
  
  // Tier 3: Nutrition - truyền normalized
  const nutritionResult = classifyNutrition(normalized, tokens);
  if (nutritionResult) return nutritionResult;

  // Tier 4: Recipe - truyền normalized
  const recipeResult = classifyRecipe(normalized, tokens);
  if (recipeResult) return recipeResult;
  
  // Tier 5: Clarify (default fallback)
  return classifyClarify(tokens, normalized);
}
```

### 5.5. Router - Tách khỏi Classifier

```typescript
enum RouteType {
  CANNED = 'canned',                  // Trả lời mẫu
  DB_LOOKUP = 'db_lookup',            // Truy vấn DB trực tiếp
  RAG = 'rag',                        // Gọi RAG pipeline
  CLARIFY = 'clarify',                // Hỏi lại user
  OFFTOPIC_RESPONSE = 'offtopic_response',
}

function routeByIntent(result: IntentResult): RouteType {
  // Confidence thấp → clarify
  if (result.confidence < 0.5) return RouteType.CLARIFY;

  switch (result.primaryIntent) {
    case IntentType.GREETING:
    case IntentType.THANKS:
    case IntentType.FAREWELL:
    case IntentType.WHO_ARE_YOU:
    case IntentType.HELP:
      return RouteType.CANNED;

    case IntentType.RECIPE_DETAIL:
      // Recipe detail có thể đi DB lookup trước, fallback RAG nếu không tìm thấy
      return RouteType.DB_LOOKUP;

    case IntentType.RECIPE_SEARCH:
      return RouteType.RAG;

    case IntentType.NUTRITION:
      // SỬA THEO FEEDBACK: NUTRITION vẫn đi RAG (kể cả khi không có secondary)
      // VD: "tôi bị tiểu đường nên ăn món gì" → cần RAG với context dinh dưỡng + gợi ý món
      // Nếu có secondary là RECIPE_SEARCH → truyền thêm context vào RAG query
      return RouteType.RAG;

    case IntentType.OFFTOPIC:
      return RouteType.OFFTOPIC_RESPONSE;

    case IntentType.CLARIFY:
    default:
      return RouteType.CLARIFY;
  }
}
```

### 5.6. Context Builder - Đưa hội thoại cũ vào prompt (MỚI)

**Mục đích:** Resolve các tham chiếu như "món thứ 2", "nó", "cái đó" dựa trên context hội thoại.

```typescript
type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: {
    intent?: IntentType;
    entities?: any;
    dishReferences?: string[];  // Danh sách món được nhắc đến
  };
};

// ============================================================
// CONTEXT BUILDER
// ============================================================

const CONTEXT_WINDOW_SIZE = 8;       // Lấy 8 tin nhắn gần nhất
const MAX_CONTEXT_TOKENS = 1500;     // Giới hạn token cho context

function buildConversationContext(
  sessionMessages: ChatMessage[],
  currentQuery: string
): {
  recentMessages: ChatMessage[];
  currentDish?: string;
  currentIngredients: string[];
  previousIntent?: IntentType;
  resolvedQuery: string;  // Query sau khi resolve tham chiếu
} {
  // 1. Lấy N tin nhắn gần nhất
  const recentMessages = sessionMessages.slice(-CONTEXT_WINDOW_SIZE);

  // 2. Trích entities từ context
  const allDishes = new Set<string>();
  const allIngredients = new Set<string>();
  let lastIntent: IntentType | undefined;

  for (const msg of recentMessages) {
    if (msg.metadata?.dishReferences) {
      msg.metadata.dishReferences.forEach(d => allDishes.add(d));
    }
    if (msg.metadata?.entities?.ingredients) {
      msg.metadata.entities.ingredients.forEach((i: string) => allIngredients.add(i));
    }
    if (msg.metadata?.intent) {
      lastIntent = msg.metadata.intent;
    }
  }

  // 3. Resolve tham chiếu trong query hiện tại
  const resolvedQuery = resolveReferences(currentQuery, recentMessages, Array.from(allDishes));

  // 4. Xác định món hiện tại (món cuối cùng được nhắc)
  const currentDish = Array.from(allDishes).pop();

  return {
    recentMessages,
    currentDish,
    currentIngredients: Array.from(allIngredients),
    previousIntent: lastIntent,
    resolvedQuery,
  };
}

// ============================================================
// REFERENCE RESOLVER - Xử lý "món thứ 2", "nó", "cái đó"
// ============================================================

function resolveReferences(
  query: string,
  messages: ChatMessage[],
  knownDishes: string[]
): string {
  let resolved = query;

  // Pattern 1: "món thứ N" - lấy món thứ N từ response trước
  const nthMatch = query.match(/mon thu\s*(\d+)/i);
  if (nthMatch) {
    const index = parseInt(nthMatch[1]) - 1;
    // Tìm tin nhắn assistant gần nhất có liệt kê món
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.metadata?.dishReferences) {
        const dishes = msg.metadata.dishReferences;
        if (index >= 0 && index < dishes.length) {
          resolved = resolved.replace(nthMatch[0], dishes[index]);
          break;
        }
      }
    }
  }

  // Pattern 2: "nó", "cái đó", "món đó", "món này" - thay bằng currentDish
  if (knownDishes.length > 0) {
    const lastDish = knownDishes[knownDishes.length - 1];
    resolved = resolved
      .replace(/\b(no|cai do|mon do|mon nay|cái này)\b/gi, lastDish);
  }

  // Pattern 3: "thay bằng X", "thêm X", "bớt X" - giữ nguyên vì đã rõ ý
  // Pattern 4: "tiếp", "tiếp theo" - lấy flow từ context
  if (/\b(tiep|tiep theo|tiep di)\b/i.test(resolved)) {
    // Giữ nguyên query - LLM sẽ dựa vào context để hiểu
  }

  return resolved;
}

// ============================================================
// RAG PROMPT BUILDER - Đưa context vào prompt
// ============================================================

function buildRAGPrompt(
  query: string,
  context: ReturnType<typeof buildConversationContext>
): string {
  const { recentMessages, currentDish, currentIngredients, resolvedQuery } = context;

  // Format lịch sử hội thoại
  const historyText = recentMessages
    .map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`)
    .join('\n');

  // Format nguyên liệu đang active
  const ingredientsText = currentIngredients.length > 0
    ? `Nguyên liệu đang thảo luận: ${currentIngredients.join(', ')}`
    : '';

  // Format món đang thảo luận
  const dishText = currentDish ? `Món đang thảo luận: ${currentDish}` : '';

  // Prompt có cấu trúc
  return `
Bạn là trợ lý CookSmart - chuyên về nấu ăn và dinh dưỡng.

${dishText}
${ingredientsText}

Lịch sử hội thoại gần đây:
${historyText}

Câu hỏi hiện tại của user: "${resolvedQuery}"
${query !== resolvedQuery ? `(Đã được resolve từ: "${query}")` : ''}

Yêu cầu:
1. Trả lời dựa trên ngữ cảnh hội thoại ở trên
2. Nếu user dùng tham chiếu ("nó", "món đó"), hiểu là món trong context
3. Giữ câu trả lời ngắn gọn, thân thiện
4. Nếu thiếu thông tin, hỏi lại user cụ thể
`.trim();
}

// ============================================================
// CONTEXT-AWARE CLASSIFIER (cập nhật cho classifyIntent)
// ============================================================

export function classifyIntent(
  query: string,
  sessionMessages: ChatMessage[] = []
): IntentResult {
  const normalized = normalizeVietnamese(query);
  const tokens = normalized.split(' ').filter(t => t.length > 0);

  // Xây dựng context trước
  const context = buildConversationContext(sessionMessages, query);

  // 1. Nếu query có tham chiếu → dùng resolvedQuery để classify
  // Ví dụ: "cách làm món thứ 2" + context có 3 món → resolve thành "cách làm Gà xào"
  const queryToClassify = context.resolvedQuery;
  const normalizedResolved = normalizeVietnamese(queryToClassify);
  const resolvedTokens = normalizedResolved.split(' ').filter(t => t.length > 0);

  // 2. Nếu câu hiện tại ngắn (< 5 tokens) VÀ có tham chiếu → dùng context để infer
  const hasReference = /\b(mon thu|mon do|mon nay|no|cai do|tiep)\b/i.test(query);
  const isShortQuery = tokens.length < 5;

  if (hasReference && isShortQuery && context.previousIntent) {
    // Kế thừa intent từ câu trước nếu câu hiện tại chỉ là follow-up
    return {
      primaryIntent: context.previousIntent,
      confidence: 0.75,
      matchedTier: 0, // Tier 0 = inherited from context
      entities: {
        dishName: context.currentDish,
        ingredients: context.currentIngredients.length > 0 ? context.currentIngredients : undefined,
      },
      context: {
        recentMessages: context.recentMessages,
        currentDish: context.currentDish,
        currentIngredients: context.currentIngredients,
        previousIntent: context.previousIntent,
      },
    };
  }

  // Tier 1: Social (xã giao)
  const socialResult = classifySocial(normalized, tokens);
  if (socialResult) {
    socialResult.context = {
      recentMessages: context.recentMessages,
      previousIntent: context.previousIntent,
    };
    return socialResult;
  }

  // Tier 2: Offtopic
  const offtopicResult = classifyOfftopic(normalized, tokens);
  if (offtopicResult) return offtopicResult;

  // Tier 3: Nutrition - truyền normalized
  const nutritionResult = classifyNutrition(normalized, tokens);
  if (nutritionResult) {
    nutritionResult.context = {
      recentMessages: context.recentMessages,
      currentDish: context.currentDish,
      currentIngredients: context.currentIngredients,
      previousIntent: context.previousIntent,
    };
    return nutritionResult;
  }

  // Tier 4: Recipe - truyền normalized
  const recipeResult = classifyRecipe(normalized, tokens);
  if (recipeResult) {
    recipeResult.context = {
      recentMessages: context.recentMessages,
      currentDish: context.currentDish,
      currentIngredients: context.currentIngredients,
      previousIntent: context.previousIntent,
    };
    return recipeResult;
  }

  // Tier 5: Clarify (default fallback)
  const clarifyResult = classifyClarify(tokens, normalized);
  clarifyResult.context = {
    recentMessages: context.recentMessages,
    previousIntent: context.previousIntent,
  };
  return clarifyResult;
}
```

### 5.7. Canned Response cho Social Intents

```typescript
const CANNED_RESPONSES = {
  GREETING: [
    "Xin chào! Mình có thể giúp gì cho bạn hôm nay?",
    "Chào bạn! Bạn muốn tìm món ăn, công thức, hay tư vấn dinh dưỡng?",
  ],
  THANKS: [
    "Không có gì! Bạn cần hỗ trợ gì thêm không?",
    "Rất vui khi được giúp bạn!",
  ],
  FAREWELL: [
    "Tạm biệt! Hẹn gặp lại bạn!",
    "Chúc bạn nấu ăn ngon miệng!",
  ],
  HELP: [
    "Mình có thể giúp bạn: tìm công thức nấu ăn, gợi ý món ăn từ nguyên liệu có sẵn, hoặc tư vấn dinh dưỡng.",
  ],
  WHO_ARE_YOU: [
    "Mình là CookSmart - trợ lý ảo chuyên về nấu ăn và dinh dưỡng. Mình có thể giúp bạn tìm công thức, gợi ý món, hoặc tư vấn về dinh dưỡng.",
  ],
};
```

---

## 6. Unit Test Cases (BẮT BUỘC trước khi triển khai)

### 6.1. Test cases đầy đủ

```typescript
const TEST_CASES = [
  // ==== Xã giao ====
  { query: 'chào bạn', expected: GREETING, tier: 1 },
  { query: 'hi', expected: GREETING, tier: 1 },
  { query: 'hello', expected: GREETING, tier: 1 },
  { query: 'cảm ơn nhé', expected: THANKS, tier: 1 },
  { query: 'tạm biệt', expected: FAREWELL, tier: 1 },
  { query: 'bạn là ai', expected: WHO_ARE_YOU, tier: 1 },
  { query: 'giúp tôi', expected: HELP, tier: 1 },

  // ==== Lỗi normalize "chào" vs "cháo" ====
  { query: 'cháo gà', expected: RECIPE_SEARCH, tier: 4 },        // KHÔNG phải greeting
  { query: 'cháo vịt', expected: RECIPE_SEARCH, tier: 4 },       // KHÔNG phải greeting
  { query: 'chao ban', expected: GREETING, tier: 1 },            // không dấu
  { query: 'chao ga', expected: RECIPE_SEARCH, tier: 4 },         // không dấu + không phải greeting

  // ==== Recipe search (strong signal) ====
  { query: 'món gà', expected: RECIPE_SEARCH, tier: 4 },          // "mon an" + "ga"
  { query: 'gợi ý món từ thịt bò', expected: RECIPE_SEARCH, tier: 4 },
  { query: 'tìm món ăn healthy', expected: RECIPE_SEARCH, tier: 4 },
  { query: 'cách làm phở bò', expected: RECIPE_DETAIL, tier: 4 },
  { query: 'công thức gà kho', expected: RECIPE_DETAIL, tier: 4 },
  { query: 'cách nấu bún bò', expected: RECIPE_DETAIL, tier: 4 },

  // ==== Nutrition + multi-intent ====
  { query: 'mì tôm bao nhiêu calo',
    expected: NUTRITION,
    secondary: [RECIPE_SEARCH],
    tier: 3 },
  { query: 'gợi ý món ít calo từ ức gà',
    expected: NUTRITION,                                          // strong "it calo" + weak "uc ga"
    secondary: [RECIPE_SEARCH],
    tier: 3 },
  { query: 'tôi bị tiểu đường nên ăn món gì',
    expected: NUTRITION,
    secondary: [RECIPE_SEARCH],
    tier: 3 },

  // ==== Off-topic ====
  { query: 'thời tiết hôm nay', expected: OFFTOPIC, tier: 2 },
  { query: 'bánh xe bị hỏng', expected: OFFTOPIC, tier: 2 },     // false positive
  { query: 'ca sĩ này hay', expected: OFFTOPIC, tier: 2 },        // "ca si"
  { query: 'ăn cắp có bị gì không', expected: OFFTOPIC, tier: 2 }, // false positive
  { query: 'bỏ qua đi', expected: CLARIFY, tier: 5 },            // "bo qua"
  { query: 'bộ phim này hay không', expected: OFFTOPIC, tier: 2 }, // "bo phim"
  { query: 'cá nhân tôi thích nấu ăn', expected: CLARIFY, tier: 5 }, // "ca nhan"
  { query: 'tôi ghét nấu ăn', expected: CLARIFY, tier: 5 },
  { query: 'đau bụng nên ăn gì', expected: CLARIFY, tier: 5 },    // "dau bung" → clarify
  { query: 'bạn có thích ăn gà không', expected: CLARIFY, tier: 5 },
  { query: 'đậu phụ bao nhiêu calo',
    expected: NUTRITION,
    secondary: [RECIPE_SEARCH],
    tier: 3 },

  // ==== Clarify (mơ hồ) ====
  { query: 'gì', expected: CLARIFY, tier: 5 },
  { query: 'nói đi', expected: CLARIFY, tier: 5 },
  { query: 'thế nào', expected: CLARIFY, tier: 5 },
  { query: 'tôi buồn quá', expected: CLARIFY, tier: 5 },
  { query: 'bạn có người yêu chưa', expected: CLARIFY, tier: 5 },
  { query: 'tôi không biết', expected: CLARIFY, tier: 5 },
  { query: 'khó quá', expected: CLARIFY, tier: 5 },

  // ==== Weak food signal alone ====
  { query: 'gà', expected: CLARIFY, tier: 5 },                   // CHỈ có weak "ga" → clarify
  { query: 'bò', expected: CLARIFY, tier: 5 },                   // CHỈ có weak "bo" → clarify
  { query: 'cá', expected: CLARIFY, tier: 5 },                   // CHỈ có weak "ca" → clarify

  // ==== Weak signal + cooking context → RECIPE_SEARCH ====
  { query: 'nấu gà', expected: RECIPE_SEARCH, tier: 4 },
  { query: 'làm món gà', expected: RECIPE_SEARCH, tier: 4 },
  { query: 'tỏi dùng làm món gì', expected: RECIPE_SEARCH, tier: 4 },
  { query: 'nấu món gì với trứng và cà chua', expected: RECIPE_SEARCH, tier: 4 },

  // ==== Không dấu ====
  { query: 'mon ga', expected: RECIPE_SEARCH, tier: 4 },         // "mon an" + "ga"
  { query: 'pho bo', expected: RECIPE_SEARCH, tier: 4 },         // "pho bo" (strong)
  { query: 'mi tom calo', expected: NUTRITION, tier: 3 },
  { query: 'toi khong biet', expected: CLARIFY, tier: 5 },

  // ==== Conversation Context Tests (MỚI) ====
  // Câu follow-up ngắn cần context để hiểu
  {
    query: 'cách làm món thứ 2',
    expected: RECIPE_DETAIL,
    tier: 0, // Tier 0 = inherited từ context
    context: {
      recentMessages: [
        { role: 'user', content: 'gợi ý món từ thịt gà' },
        {
          role: 'assistant',
          content: '1. Gà kho gừng, 2. Gà xào hành tây, 3. Gà nướng',
          metadata: { dishReferences: ['Gà kho gừng', 'Gà xào hành tây', 'Gà nướng'] },
        },
      ],
    },
    // Sau khi resolve: "cách làm Gà xào hành tây" → RECIPE_DETAIL
  },
  {
    query: 'bao nhiêu calo?',
    expected: NUTRITION,
    tier: 0,
    context: {
      recentMessages: [
        { role: 'user', content: 'món gà xào hành tây' },
        {
          role: 'assistant',
          content: 'Gà xào hành tây: 250 kcal/phần...',
          metadata: { dishReferences: ['Gà xào hành tây'] },
        },
      ],
    },
  },
  {
    query: 'nó cần nguyên liệu gì',
    expected: RECIPE_DETAIL,
    tier: 0,
    context: {
      recentMessages: [
        {
          role: 'user',
          content: 'cách làm phở bò',
          metadata: { dishReferences: ['Phở bò'] },
        },
      ],
    },
    // Resolve: "Phở bò cần nguyên liệu gì" → RECIPE_DETAIL
  },
  {
    query: 'tiếp đi',
    expected: CLARIFY, // Không đủ context → clarify
    tier: 5,
    context: {
      recentMessages: [], // Empty context
    },
  },
];

### 6.2. Test runner (check cả secondaryIntents)

```typescript
function runTests() {
  let pass = 0, fail = 0;

  for (const test of TEST_CASES) {
    const result = classifyIntent(test.query);

    // Check primary
    const primaryPass = result.primaryIntent === test.expected;
    // Check tier
    const tierPass = result.matchedTier === test.tier;
    // Check secondary intents (nếu có trong test)
    const secondaryPass = !test.secondary ||
      test.secondary.every(intent => result.secondaryIntents?.includes(intent));

    const isPass = primaryPass && tierPass && secondaryPass;

    if (isPass) {
      pass++;
    } else {
      fail++;
      console.log(`FAIL: "${test.query}"`);
      console.log(`  Got: ${result.primaryIntent} | tier ${result.matchedTier} | secondary ${JSON.stringify(result.secondaryIntents)}`);
      console.log(`  Expected: ${test.expected} | tier ${test.tier} | secondary ${JSON.stringify(test.secondary)}`);
    }
  }

  console.log(`\nResult: ${pass}/${pass + fail} passed (${((pass / (pass + fail)) * 100).toFixed(1)}%)`);
}
```

### 6.3. Tiêu chí pass: ≥95% test cases phải pass

Đặc biệt **PHẢI pass 100%** các test:
- Tất cả test "cháo" / "chao X (food)" — kiểm tra normalize
- Tất cả test false positive phrases — kiểm tra blacklist
- Tất cả test multi-intent — kiểm tra secondaryIntents
- Tất cả test weak food alone — kiểm tra strong/weak signal

---

## 7. So sánh tổng hợp các phương án

| Tiêu chí | Rule-based (CHỌN) | Embedding | LLM | Hybrid (Rule+LLM) |
|----------|---------------------|-----------|-----|-------------------|
| **Độ chính xác (kỳ vọng)** | Cần đo lại với data thực | Cần đo lại | Rất cao | Cần đo lại |
| **Latency** | <1ms | ~200ms | +1-3s | +1-3s |
| **API call/query** | 0 | 0 | 1 call | 0-1 call |
| **Coverage** | Cao (rule đầy đủ) | Cao | Rất cao | Cao |
| **Maintain** | Dễ | Trung bình | Dễ | Khó |
| **Robust tiếng Việt** | Cao (với blacklist + context + strong/weak signal) | Cao | Rất cao | Cao |
| **Multi-intent** | ✅ Có | ❌ Khó | ✅ Có | ✅ Có |
| **Confidence** | ✅ Có (theo tier) | ❌ Khó định | ✅ Có | ⚠️ Phụ thuộc |

> **Lưu ý:** Con số "85-95%" cho Rule-based là **kỳ vọng lý thuyết**, cần được đo lại bằng log người dùng và phản hồi sau triển khai thực tế. Không nên khẳng định chắc chắn trước khi có dataset thật.

---

## 8. Quyết định cuối cùng

### ✅ Chọn: Multi-tier Rule-based + Normalize + Router tách rời + Context-aware

**Lý do:**

1. **Giảm API call:** Classifier không gọi AI; chỉ RAG mới gọi
2. **Fallback an toàn:** CLARIFY thay vì RECIPE_SEARCH (tránh gọi RAG khi không rõ intent)
3. **Multi-intent:** Support nhu cầu phức tạp (NUTRITION + RECIPE_SEARCH)
4. **Tách Classifier/Router:** Dễ debug, dễ mở rộng
5. **Blacklist false positive:** Xử lý "bánh xe", "ca sĩ"... gây nhiễu
6. **Confidence theo tier:** Router có thể clarify khi confidence thấp
7. **Conversation Context:** Đưa hội thoại cũ vào prompt để LLM hiểu "món thứ 2", "nó", "tiếp đi"
8. **Reference Resolution:** Resolve tham chiếu mơ hồ trước khi gọi LLM
9. **Unit test bắt buộc:** 95%+ phải pass mới triển khai
10. **Chi phí = 0:** Không tốn API call classification

### ❌ Không chọn

- **LLM classify:** Đi ngược mục tiêu
- **Embedding-based:** Chưa cần, vẫn tốn embedding call
- **Hybrid Rule+LLM:** Phức tạp không cần thiết
- **Hybrid Rule ngắn/LLM dài:** Tiêu chí không đúng

### Điều kiện xem xét lại

- Accuracy < 70% sau khi đo qua metrics
- User feedback tiêu cực về sai intent
- Query patterns phức tạp hơn dự kiến

---

## 9. Roadmap triển khai

### Phase 1 (MVP - Tuần 1)
- [ ] Implement `normalizeVietnamese()` + utility
- [ ] Implement `IntentType` enum + `IntentResult` type (có `context` field)
- [ ] Implement 5 tiers classifier + Context-aware
- [ ] Implement Router
- [ ] Implement **Context Builder** + **Reference Resolver** (in-memory)
- [ ] Implement **RAG Prompt Builder** (đưa context vào prompt)
- [ ] Implement canned responses
- [ ] Implement **Session Manager (in-memory Map)** + auto cleanup sau 30 phút
- [ ] Viết 100-200 unit test cases (bao gồm context tests) + pass ≥95%
- [ ] Logging infrastructure (lưu context + resolvedQuery)

### Phase 2 (Tuần 2 - Data thực)
- [ ] Phân tích log, thống kê các câu classify sai
- [ ] Mở rộng patterns, keywords dựa trên data
- [ ] Thêm fuzzy matching cho typo
- [ ] Đo accuracy qua user feedback
- [ ] Tối ưu Context Window size dựa trên data
- [ ] Implement session expiration (clear context sau N phút)

### Phase 3 (Nếu cần - Tháng 2+)
- [ ] Cân nhắc embedding-based cho query phức tạp
- [ ] A/B test với LLM classify
- [ ] Synonym dictionary mở rộng

---

## 10. Conversation Context Storage - In-Memory (ĐƠN GIẢN)

> **Quyết định:** Chỉ giữ context trong **session hiện tại** (in-memory). KHÔNG lưu DB dài hạn.
> Khi user đóng tab / refresh / logout → context bị xóa.

### 10.1. Session Manager (In-Memory)

```typescript
// ============================================================
// SESSION CONTEXT - chỉ tồn tại trong RAM của 1 server instance
// ============================================================

type SessionContext = {
  sessionId: string;
  messages: ChatMessage[];      // 5-10 tin nhắn gần nhất
  currentDish?: string;
  currentIngredients: string[];
  lastActivityAt: number;
};

// Lưu trong Map (in-memory)
const sessionStore = new Map<string, SessionContext>();

// Config
const SESSION_TTL_MS = 30 * 60 * 1000;     // 30 phút không hoạt động → xóa
const MAX_MESSAGES_PER_SESSION = 10;       // Chỉ giữ 10 tin nhắn gần nhất
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Dọn session hết hạn mỗi 5 phút

// ============================================================
// GET / SET CONTEXT
// ============================================================

function getSessionContext(sessionId: string): SessionContext {
  let ctx = sessionStore.get(sessionId);

  if (!ctx) {
    ctx = {
      sessionId,
      messages: [],
      currentIngredients: [],
      lastActivityAt: Date.now(),
    };
    sessionStore.set(sessionId, ctx);
  }

  // Cập nhật last activity
  ctx.lastActivityAt = Date.now();
  return ctx;
}

function addMessageToSession(
  sessionId: string,
  message: ChatMessage
): void {
  const ctx = getSessionContext(sessionId);
  ctx.messages.push(message);

  // Giữ tối đa N tin nhắn gần nhất (FIFO)
  if (ctx.messages.length > MAX_MESSAGES_PER_SESSION) {
    ctx.messages.shift();
  }

  // Cập nhật entities active
  if (message.metadata?.dishReferences?.length) {
    ctx.currentDish = message.metadata.dishReferences.at(-1);
  }
  if (message.metadata?.entities?.ingredients) {
    const newIngredients = message.metadata.entities.ingredients
      .filter((i: string) => !ctx.currentIngredients.includes(i));
    ctx.currentIngredients.push(...newIngredients);

    // Giữ tối đa 5 nguyên liệu gần nhất
    if (ctx.currentIngredients.length > 5) {
      ctx.currentIngredients = ctx.currentIngredients.slice(-5);
    }
  }
}

function clearSessionContext(sessionId: string): void {
  sessionStore.delete(sessionId);
}

// ============================================================
// AUTO CLEANUP - Xóa session hết hạn
// ============================================================

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, ctx] of sessionStore.entries()) {
    if (now - ctx.lastActivityAt > SESSION_TTL_MS) {
      sessionStore.delete(sessionId);
    }
  }
}, CLEANUP_INTERVAL_MS);
```

### 10.2. Tích hợp vào Chat Flow

```typescript
// ============================================================
// CHAT HANDLER - Sử dụng in-memory context
// ============================================================

async function handleChatMessage(
  sessionId: string,
  userQuery: string
): Promise<string> {
  // 1. Lấy context từ session hiện tại (in-memory)
  const sessionCtx = getSessionContext(sessionId);
  const recentMessages = sessionCtx.messages.slice(-MAX_MESSAGES_PER_SESSION);

  // 2. Classify intent CÓ context
  const intentResult = classifyIntent(userQuery, recentMessages);

  // 3. Lưu tin nhắn user vào session
  addMessageToSession(sessionId, {
    role: 'user',
    content: userQuery,
    timestamp: Date.now(),
    metadata: {
      intent: intentResult.primaryIntent,
      entities: intentResult.entities,
    },
  });

  // 4. Route
  const route = routeByIntent(intentResult);

  // 5. Xử lý theo route
  let response: string;
  switch (route) {
    case RouteType.CANNED:
      response = getCannedResponse(intentResult.primaryIntent);
      break;

    case RouteType.RAG:
      // Đưa context vào prompt cho LLM
      response = await callRAG(intentResult.resolvedQuery, {
        recentMessages: sessionCtx.messages,
        currentDish: sessionCtx.currentDish,
        currentIngredients: sessionCtx.currentIngredients,
      });
      break;

    case RouteType.DB_LOOKUP:
      response = await lookupRecipe(intentResult.entities?.dishName);
      break;

    case RouteType.CLARIFY:
      response = getClarifyResponse();
      break;

    case RouteType.OFFTOPIC_RESPONSE:
      response = getOfftopicResponse();
      break;
  }

  // 6. Lưu response vào session (có dishReferences để dùng cho câu sau)
  const dishRefs = extractDishReferences(response);
  addMessageToSession(sessionId, {
    role: 'assistant',
    content: response,
    timestamp: Date.now(),
    metadata: {
      dishReferences: dishRefs,
    },
  });

  return response;
}

// ============================================================
// CLEAR CONTEXT KHI USER LOGOUT / ĐÓNG TAB
// ============================================================

// Frontend gọi khi user logout
socket.on('user:logout', (sessionId) => {
  clearSessionContext(sessionId);
});

// Hoặc khi user clear chat
socket.on('chat:clear', (sessionId) => {
  clearSessionContext(sessionId);
});
```

### 10.3. Ưu/nhược điểm của in-memory

| Ưu điểm | Nhược điểm |
|---------|------------|
| ✅ Đơn giản, không cần DB schema | ❌ Mất context khi restart server |
| ✅ Latency thấp (không query DB) | ❌ Không scale được nhiều server (cần sticky session hoặc Redis) |
| ✅ Tự động xóa sau 30 phút (không lo data leak) | ❌ User mất context khi chuyển thiết bị |
| ✅ Không tốn disk/DB storage | |
| ✅ Phù hợp MVP - chỉ cần context trong 1 phiên | |

### 10.4. Khi nào cần nâng cấp lên Redis/DB?

- Có nhiều server instances (load balancing) → cần Redis shared
- User yêu cầu lưu lịch sử chat lâu dài → cần DB
- Cần phân tích log hội thoại để cải thiện classifier → cần DB
- MVP hiện tại: **không cần**, dùng in-memory là đủ

### 10.5. Ví dụ flow hoàn chỉnh

```
Turn 1 (RAM):
- sessionStore.get("session-abc") → undefined → tạo mới
- User: "gợi ý món từ thịt gà"
- classifyIntent() → RECIPE_SEARCH
- addMessageToSession() → messages = [user msg]
- Router → RAG
- LLM trả: "1. Gà kho gừng, 2. Gà xào hành tây, 3. Gà nướng"
- addMessageToSession() → messages = [user, assistant với dishReferences]
- sessionStore.set("session-abc", { messages: [...], currentDish: "Gà nướng", ... })

Turn 2 (RAM, cùng session):
- sessionStore.get("session-abc") → có sẵn
- User: "cách làm món thứ 2"
- classifyIntent(query, messages) → resolve "món thứ 2" = "Gà xào hành tây" → RECIPE_DETAIL
- Router → DB_LOOKUP
- Response: hướng dẫn làm Gà xào hành tây
- addMessageToSession() → messages = [user1, assistant1, user2, assistant2]

Turn 3 (sau 30 phút không hoạt động):
- Cleanup interval chạy → xóa "session-abc"
- User quay lại → session mới, context trống
```

---

## 11. Tài liệu tham khảo

- Intent Classification: https://en.wikipedia.org/wiki/Intent_classification
- Vietnamese NLP challenges
- Multi-tier classification patterns
- Chiến lược fallback: Confident vs Clarify
- Coreference Resolution cho chatbot: Xử lý "nó", "món đó", "tiếp đi"
- RAG with conversation memory: Best practices

---

> **Tác giả:** Cursor Agent (Claude)
> **Ngày cập nhật:** 2026-07-06
> **Trạng thái:** Draft v5 - Đơn giản hóa Conversation Context Storage: dùng in-memory Map (không cần DB/Redis), tự cleanup sau 30 phút
