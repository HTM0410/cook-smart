# Tài liệu Phân loại ý định người dùng — Intent Classification

> Mô tả cách hệ thống "hiểu" người dùng muốn gì khi hỏi về món ăn. Tài liệu dễ hiểu, phù hợp bảo vệ đồ án.

---

## 1. Tổng quan

Khi người dùng nhắn một câu hỏi, trước khi tìm công thức, hệ thống cần **phân loại ý định** (Intent Classification) — tức là xác định người dùng đang muốn gì.

**Ví dụ:**
- *"Xin chào"* → Người dùng muốn chào hỏi
- *"Món nào ít calo?"* → Người dùng hỏi về dinh dưỡng
- *"Cách nấu phở bò"* → Người dùng muốn tìm công thức nấu ăn
- *"Hôm nay trời mưa"* → Người dùng nói chuyện không liên quan

Việc phân loại giúp hệ thống:
- **Chọn đúng hướng xử lý** — trả lời ngay hoặc tìm kiếm AI
- **Tiết kiệm tài nguyên** — không gọi AI khi không cần
- **Trả lời đúng ý** — không nhầm lẫn giữa các nhóm

---

## 2. Mô hình 5 tầng (5-Tier Classification)

Hệ thống phân loại ý định theo **5 tầng ưu tiên**, kiểm tra từ trên xuống dưới. Tầng nào match trước thì dừng lại.

```
┌─────────────────────────────────────────────────────┐
│                    CÂU HỎI NGƯỜI DÙNG             │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  TẦNG 1: XÃ HỘI (Social)          Ưu tiên CAO NHẤT│
│  Chào hỏi, cảm ơn, tạm biệt, xin giúp đỡ         │
│  → Trả lời ngay bằng câu có sẵn, KHÔNG gọi AI    │
└──────────────────────┬───────────────────────────────┘
                       │ Không match
                       ▼
┌──────────────────────────────────────────────────────┐
│  TẦNG 2: NGOÀI CHỦ ĐỀ (Offtopic)                   │
│  Hỏi về thời tiết, tin tức, game, thể thao...    │
│  → Xin lỗi nhẹ nhàng, gợi ý quay về ẩm thực      │
└──────────────────────┬───────────────────────────────┘
                       │ Không match
                       ▼
┌──────────────────────────────────────────────────────┐
│  TẦNG 3: DINH DƯỠNG (Nutrition)                   │
│  Hỏi về calo, protein, vitamin, ăn kiêng...       │
│  → Truy vấn cơ sở dữ liệu, KHÔNG gọi AI          │
└──────────────────────┬───────────────────────────────┘
                       │ Không match
                       ▼
┌──────────────────────────────────────────────────────┐
│  TẦNG 4: CÔNG THỨC (Recipe)       Ưu tiên THẤP NHẤT│
│  Hỏi cách nấu, tìm món, biến thể, thay nguyên liệu│
│  → Gọi AI (Gemini) để tìm và tạo câu trả lời    │
└──────────────────────┬───────────────────────────────┘
                       │ Không match
                       ▼
┌──────────────────────────────────────────────────────┐
│  TẦNG 5: LÀM RÕ (Clarify)          Mặc định       │
│  Câu hỏi mơ hồ, không đủ thông tin                 │
│  → Hỏi lại người dùng cho rõ hơn                  │
└──────────────────────────────────────────────────────┘
```

---

## 3. Chi tiết từng tầng

### Tầng 1 — Xã hội (Social)

Xử lý các câu giao tiếp thông thường, không liên quan đến nấu ăn.

**Các nhóm nhỏ:**

| Nhóm | Từ khóa ví dụ | Câu trả lời mẫu |
|---|---|---|
| **Chào hỏi** | xin chào, hello, hi | *"Chào bạn! Hôm nay bạn muốn hỏi gì về ẩm thực?"* |
| **Tạm biệt** | tạm biệt, bye, goodbye | *"Tạm biệt bạn! Chúc bạn nấu ăn vui vẻ!"* |
| **Cảm ơn** | cảm ơn, thanks | *"Không có gì bạn nhé! Cần hỏi thêm gì không?"* |
| **Hỏi về bot** | bạn là ai, tên gì | *"Mình là trợ lý CookSmart, giúp bạn tìm công thức nấu ăn."* |
| **Xin giúp** | giúp tôi, hỗ trợ | *"Mình có thể giúp bạn gợi ý món, hướng dẫn nấu, hoặc tìm nguyên liệu thay thế."* |

**Nguyên tắc hoạt động:**
- Dùng **từ khóa chính xác** (exact match) — không dùng includes() tự do
- Hỗ trợ **1-gram, 2-gram, 3-gram** — ví dụ: "cảm ơn" (2-gram), "không có gì bạn" (3-gram)
- Phân biệt **"cháo" (món ăn) vs "chào" (xin chào)** — nếu sau "cháo" có từ "gà", "thịt" thì là món ăn

### Tầng 2 — Ngoài chủ đề (Offtopic)

Xử lý các câu hỏi hoàn toàn không liên quan đến ẩm thực.

**Từ khóa ví dụ:**
- Thời tiết: nắng, mưa, lạnh, trời mưa
- Xe cộ: ô tô, xe máy, xe đạp
- Giải trí: ca sĩ, phim, nhạc, game, bóng đá
- Tiền bạc: bitcoin, chứng khoán, cổ phiếu
- Công nghệ: code, lập trình, React, Python

**Nguyên tắc hoạt động:**
- Chỉ phân loại Offtopic khi **không có bất kỳ tín hiệu nào** về thức ăn
- Nếu câu hỏi có từ "thịt", "gà", "cá" → không bao giờ là Offtopic
- Nếu có từ "cách nấu", "công thức" → không phải Offtopic

### Tầng 3 — Dinh dưỡng (Nutrition)

Xử lý các câu hỏi về giá trị dinh dưỡng của món ăn.

**Từ khóa ví dụ:**
- Đơn vị: calo, calories, kcal
- Chất dinh dưỡng: protein, vitamin, lipid, glucid, khoáng chất
- Sức khỏe: tiểu đường, mỡ máu, huyết áp
- Chế độ ăn: ăn kiêng, giảm cân, tăng cân, ăn chay
- Cụm phức: giam can nen an, it calo, nhieu beo

**Nguyên tắc hoạt động:**
- Hệ thống tìm **tất cả** các từ dinh dưỡng trong câu hỏi
- Trả về danh sách các thuật ngữ dinh dưỡng đã tìm thấy
- Truy vấn cơ sở dữ liệu để lấy thông tin dinh dưỡng của công thức

### Tầng 4 — Công thức (Recipe)

Xử lý các câu hỏi liên quan đến việc tìm kiếm và nấu ăn. Đây là tầng phức tạp nhất, gồm **4 nhóm nhỏ:**

| Nhóm | Mô tả | Từ khóa ví dụ |
|---|---|---|
| **RECIPE_DETAIL** | Hỏi cách làm một món cụ thể | "cách nấu phở", "làm sao nấu bún chả", "các bước làm bánh mì" |
| **RECIPE_SEARCH** | Tìm kiếm món ăn | "món ngon với thịt gà", "gợi ý món chay", "món ăn nhanh" |
| **RECIPE_VARIANT** | Hỏi biến thể của món | "phở chay", "bún bò miền Nam", "cách khác nấu phở" |
| **RECIPE_SUBSTITUTE** | Hỏi thay thế nguyên liệu | "thay thế thịt bò", "không có nấm thì dùng gì" |

**Nguyên tắc hoạt động:**

Hệ thống phân biệt 2 loại tín hiệu thực phẩm:

- **Tín hiệu mạnh (Strong Food Signal):** Từ/cụm từ chắc chắn là thức ăn — đứng một mình đã đủ để xác định là Recipe
  - Ví dụ: "phở", "bún", "bánh mì", "thịt kho", "trứng chiên", "canh"

- **Tín hiệu yếu (Weak Food Signal):** Nguyên liệu đơn lẻ — cần thêm ngữ cảnh nấu ăn mới xác định được
  - Ví dụ: "gà", "thịt", "cá", "rau"
  - Câu *"Món với gà"* → thiếu ngữ cảnh → không xác định được
  - Câu *"Cách nấu với gà"* → có ngữ cảnh "cách nấu" → xác định được là Recipe

**Ngăn chặn kết quả sai (False Positive):**
Một số từ trông giống thức ăn nhưng thực ra không phải:

| Cụm từ | Thực ra là |
|---|---|
| bánh xe | bánh xe ô tô |
| ca sĩ | nghệ sĩ hát |
| tôm đất | tên địa danh |
| hoa | hoa lá (không phải món ăn) |

### Tầng 5 — Làm rõ (Clarify)

Khi không xác định được ý định, hệ thống hỏi người dùng cụ thể hơn.

**Từ khóa ví dụ:**
- "tôi không biết", "chưa biết", "bíết gì"
- "giúp tôi", "cần giúp"
- "hỏi gì", "hỏi nhanh"

**Câu trả lời mẫu:**
> *"Bạn có thể mô tả rõ hơn không? Ví dụ: 'Gợi ý món từ thịt gà' hoặc 'Cách làm phở bò'."*

---

## 4. Luồng xử lý hoàn chỉnh

Dưới đây là ví dụ minh họa cách một câu hỏi được phân loại qua 5 tầng:

### Ví dụ 1: "Xin chào bạn"
```
→ Tầng 1 (Social): Match với "xin chào"
    → Loại: GREETING
    → Xử lý: Trả lời cố định
    → Kết quả: "Chào bạn! Hôm nay bạn muốn hỏi gì?"
```

### Ví dụ 2: "Hôm nay thời tiết thế nào?"
```
→ Tầng 1 (Social): Không match
→ Tầng 2 (Offtopic): Match với "thoi tiet"
    → Loại: OFFTOPIC
    → Xử lý: Xin lỗi nhẹ nhàng
    → Kết quả: "Mình là trợ lý nấu ăn, chỉ hỗ trợ câu hỏi về ẩm thực. Bạn có muốn hỏi về món ăn nào không?"
```

### Ví dụ 3: "Món nào ít calo nhất?"
```
→ Tầng 1 (Social): Không match
→ Tầng 2 (Offtopic): Không match
→ Tầng 3 (Nutrition): Match với "calo"
    → Loại: NUTRITION
    → Entities: ["calo"]
    → Xử lý: Truy vấn CSDL tìm món ít calo
    → Kết quả: Danh sách công thức ít calo
```

### Ví dụ 4: "Cách nấu phở bò"
```
→ Tầng 1 (Social): Không match
→ Tầng 2 (Offtopic): Không match
→ Tầng 3 (Nutrition): Không match
→ Tầng 4 (Recipe):
    → RECIPE_DETAIL_PREFIX match: "cach nau" (cách nấu)
    → Tách dish name: "pho bo" (phở bò)
    → Loại: RECIPE_DETAIL
    → Entities: { dishName: "pho bo" }
    → Xử lý: Gọi AI (RAG) tìm công thức
    → Kết quả: Chi tiết cách nấu phở bò
```

### Ví dụ 5: "Món với gà"
```
→ Tầng 1 (Social): Không match
→ Tầng 2 (Offtopic): Không match
→ Tầng 3 (Nutrition): Không match
→ Tầng 4 (Recipe):
    → Tín hiệu yếu: "ga" (gà) ✓
    → Không có ngữ cảnh nấu → tiếp tục
    → Không match strong food → tiếp tục
→ Tầng 5 (Clarify): Không match từ khóa rõ ràng
    → Loại: CLARIFY (mặc định)
    → Xử lý: Hỏi lại người dùng
    → Kết quả: "Bạn muốn hỏi gì về gà? Ví dụ: 'Cách nấu gà' hoặc 'Món ngon từ gà'?"
```

---

## 5. Hiểu ngữ cảnh hội thoại (Context Awareness)

Hệ thống không chỉ hiểu câu hỏi hiện tại mà còn hiểu **ngữ cảnh cuộc hội thoại** — tức là biết người dùng đang hỏi tiếp về vấn đề gì.

### Ví dụ minh họa:

```
Người dùng: "Gợi ý món từ thịt bò"
    → Hệ thống trả lời:
      "1. Phở bò
       2. Bún bò
       3. Bò nướng"

Người dùng: "Cách nấu món thứ 2"
    → Hệ thống hiểu: "món thứ 2" = "Bún bò"
    → Query đã resolve: "Cách nấu bún bò"
    → Tiếp tục xử lý như câu hỏi thông thường
```

### Cách hệ thống hiểu tham chiếu:

| Tham chiếu | Ví dụ | Xử lý |
|---|---|---|
| **Số thứ tự** | "món thứ 2", "món thứ 3" | Lấy món tương ứng từ câu trả lời trước |
| **Đại từ** | "nó", "cái đó", "món đó" | Thay bằng tên món cuối cùng trong hội thoại |
| **Từ hỏi** | "tiếp đi", "thêm nữa" | Giữ nguyên, để AI tự hiểu |

---

## 6. Độ chính xác (Confidence Score)

Mỗi kết quả phân loại có kèm **độ chính xác** (confidence) từ 0 đến 1:

| Confidence | Ý nghĩa |
|---|---|
| 0.95 | Rất chắc chắn — từ khóa đặc trưng rõ ràng |
| 0.85–0.90 | Khá chắc chắn — có tín hiệu mạnh |
| 0.70–0.80 | Trung bình — có tín hiệu nhưng chưa rõ |
| 0.30–0.60 | Thấp — không chắc chắn, fallback sang Tầng 5 |

**Quy tắc:** Nếu confidence **nhỏ hơn 0.5** → tự động chuyển sang Tầng 5 (Clarify), bất kể đang ở tầng nào.

---

## 7. Tóm tắt luồng xử lý

```
NHẬN CÂU HỎI
       │
       ▼
TÁCH TỪ (Tokenize) — chuyển câu thành danh sách từ
       │
       ▼
CHUẨN HÓA — bỏ dấu, viết thường, loại bỏ ký tự đặc biệt
       │
       ▼
KIỂM TRA TẦNG 1 → 5 THEO THỨ TỰ ƯU TIÊN
       │
       ├─ Tầng 1: Social?      ──→ CANNED (trả lời cố định)
       ├─ Tầng 2: Offtopic?    ──→ OFFTOPIC (từ chối lịch sự)
       ├─ Tầng 3: Nutrition?   ──→ DB_LOOKUP (tra CSDL dinh dưỡng)
       ├─ Tầng 4: Recipe?      ──→ RAG (gọi AI)
       └─ Tầng 5: còn lại      ──→ CLARIFY (hỏi lại)
```

---

## 8. Bảng tổng hợp

| Tầng | Tên | Đầu vào | Đầu ra | Xử lý |
|---|---|---|---|---|
| 1 | Social | Từ chào hỏi | Câu trả lời có sẵn | Không gọi AI |
| 2 | Offtopic | Câu không liên quan | Xin lỗi + gợi ý | Không gọi AI |
| 3 | Nutrition | Câu hỏi dinh dưỡng | Thông tin dinh dưỡng | Truy vấn CSDL |
| 4 | Recipe | Câu hỏi nấu ăn | Công thức + hướng dẫn | Gọi AI (Gemini) |
| 5 | Clarify | Câu mơ hồ | Hỏi lại người dùng | Không gọi AI |
