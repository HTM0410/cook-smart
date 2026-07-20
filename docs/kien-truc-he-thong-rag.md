# Kiến trúc hệ thống gợi ý món ăn thông minh — Tài liệu bảo vệ đồ án

> Tài liệu này mô tả luồng xử lý câu hỏi của người dùng từ đầu đến cuối, ở mức độ tổng quan dễ hiểu, phù hợp để trình bày trong buổi bảo vệ đồ án.

---

## 1. Tổng quan

Khi người dùng hỏi một câu về món ăn (ví dụ: *"Cách nấu phở bò như thế nào?"*), hệ thống sẽ trải qua **5 giai đoạn chính**:

```
Người dùng hỏi
    │
    ▼
┌─────────────────────────────────────┐
│  GIAI ĐOẠN 1: Tiếp nhận & Xác thực │
│  • Nhận câu hỏi từ người dùng       │
│  • Kiểm tra đăng nhập (JWT token)   │
│  • Lưu câu hỏi vào lịch sử chat     │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  GIAI ĐOẠN 2: Phân loại ý định     │
│  • Hiểu người dùng muốn gì         │
│  • Phân loại vào 5 nhóm:           │
│    - Chào hỏi / cảm ơn              │
│    - Hỏi dinh dưỡng (calo, protein) │
│    - Tìm công thức nấu ăn           │
│    - Hỏi chung / không liên quan    │
│    - Cần làm rõ thêm                │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  GIAI ĐOẠN 3: Xử lý theo nhóm     │
│  • CHÀO HỎI → Trả lời ngay (câu    │
│    trả lời có sẵn, không cần AI)    │
│  • DINH DƯỠNG → Tìm trong CSDL     │
│  • TÌM CÔNG THỨC → Xem bước 4      │
│  • KHÔNG LIÊN QUAN → Xin lỗi nhẹ   │
│  • CẦN LÀM RÕ → Hỏi thêm người   │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  GIAI ĐOẠN 4: Tìm kiếm & Tạo câu  │
│  trả lời (RAG)                     │
│  • Bước 4a: Tìm đúng món (nhanh)  │
│  • Bước 4b: Tìm kiếm ngữ nghĩa    │
│    (AI tìm món liên quan)          │
│  • Bước 4c: Gửi cho AI tạo câu trả│
│  • Bước 4d: Chỉnh sửa câu trả lời │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  GIAI ĐOẠN 5: Trả kết quả          │
│  • Gửi câu trả lời cho người dùng  │
│  • Kèm nguồn tham khảo (công thức) │
│  • Lưu vào lịch sử hội thoại       │
└─────────────────────────────────────┘
```

---

## 2. Chi tiết từng giai đoạn

### Giai đoạn 1 — Tiếp nhận & Xác thực

Người dùng gửi câu hỏi qua ứng dụng di động hoặc web. Hệ thống kiểm tra token đăng nhập để xác định người dùng. Câu hỏi được lưu vào cơ sở dữ liệu cùng với lịch sử hội thoại để có ngữ cảnh cho các câu hỏi tiếp theo.

```
Người dùng (app/web)
        │
        ▼
  API endpoint: /api/chat/message
        │
        ▼
  Kiểm tra JWT token đăng nhập
        │
        ▼
  Lưu câu hỏi vào bảng chat_messages
        │
        ▼
  Lấy 20 tin nhắn gần nhất để có ngữ cảnh
```

### Giai đoạn 2 — Phân loại ý định (Intent Classification)

Hệ thống đọc câu hỏi và xác định người dùng muốn gì. Việc phân loại dựa trên **từ khóa** — ví dụ: *"calo", "protein", "vitamin"* → nhóm dinh dưỡng; *"cách nấu", "làm món"* → nhóm công thức.

**5 nhóm ý định:**

| Nhóm | Từ khóa ví dụ | Xử lý |
|---|---|---|
| **Chào hỏi** | xin chào, cảm ơn, tạm biệt | Trả lời cố định, không gọi AI |
| **Dinh dưỡng** | calo, protein, vitamin, ăn kiêng | Tìm trong cơ sở dữ liệu công thức |
| **Tìm công thức** | cách nấu, làm món, công thức | Chuyển sang Giai đoạn 4 |
| **Không liên quan** | thời tiết, tin tức, bitcoin | Xin lỗi nhẹ nhàng, gợi ý hỏi về ẩm thực |
| **Cần làm rõ** | câu hỏi mơ hồ | Hỏi người dùng cụ thể hơn |

Hệ thống cũng hiểu **tham chiếu trong hội thoại** — ví dụ người dùng hỏi tiếp *"Vậy làm sao nấu ngon?"* thì hệ thống hiểu người dùng đang hỏi về món đã nhắc ở tin nhắn trước.

### Giai đoạn 3 — Xử lý theo nhóm

Tùy vào nhóm ý định ở Giai đoạn 2, hệ thống chọn một trong các hướng xử lý:

- **Nhóm Chào hỏi / Không liên quan / Cần làm rõ:** Trả lời ngay bằng câu có sẵn, không cần truy vấn cơ sở dữ liệu hay gọi AI.
- **Nhóm Dinh dưỡng:** Truy vấn bảng công thức trong cơ sở dữ liệu để tìm món phù hợp.
- **Nhóm Tìm công thức:** Chuyển sang Giai đoạn 4 để xử lý chuyên sâu.

### Giai đoạn 4 — Tìm kiếm & Tạo câu trả lời (RAG)

Đây là **cốt lõi** của hệ thống, gồm 4 bước nhỏ:

#### Bước 4a — Tìm nhanh bằng tên món (Fast Path)

Trước tiên, hệ thống kiểm tra xem câu hỏi có chứa **tên một món cụ thể** hay không. Ví dụ: *"Cách nấu phở bò"* → hệ thống tìm trong cơ sở dữ liệu xem có công thức tên *"Phở bò"* không.

- Nếu tìm thấy → trả lời ngay với thông tin từ cơ sở dữ liệu (không cần AI)
- Nếu không tìm thấy → chuyển sang Bước 4b

```
Ví dụ:
Người dùng: "Cách nấu phở bò"
    │
    ▼
Tách từ khóa: ["phở", "bò"]
    │
    ▼
Tìm trong CSDL: LIKE "%phở%" AND LIKE "%bò%"
    │
    ▼
Tìm thấy: "Phở bò" → Trả lời ngay (không gọi AI)
```

#### Bước 4b — Tìm kiếm ngữ nghĩa (Semantic Search)

Nếu câu hỏi không tìm được bằng tên cụ thể, hệ thống dùng **tìm kiếm ngữ nghĩa**:

1. **Chuyển câu hỏi thành vector số** bằng Gemini Embedding API — mỗi câu được biểu diễn bằng một dãy 768 con số phản ánh ý nghĩa của câu.
2. **So sánh vector** với các vector đã lưu sẵn trong cơ sở dữ liệu. Câu nào có vector gần nhất về mặt ý nghĩa thì được chọn.
3. Trả về **3-5 công thức** liên quan nhất.

```
Ví dụ:
Người dùng: "Món nào làm từ thịt bò và rau củ?"
    │
    ▼
Gemini Embedding API chuyển câu hỏi thành vector
    │
    ▼
So sánh với vector các công thức đã lưu
    │
    ▼
Kết quả: "Phở bò", "Bò nướng", "Bún bò" (độ tương đồng cao)
```

#### Bước 4c — Tạo câu trả lời bằng AI (LLM Generation)

Hệ thống gửi **câu hỏi + các công thức tìm được** cho Gemini (mô hình AI của Google) và yêu cầu tạo câu trả lời tự nhiên bằng tiếng Việt.

Hệ thống dùng **9 mô hình AI** khác nhau và tự động chuyển sang mô hình khác nếu một mô hình bị quá tải, đảm bảo luôn có câu trả lời.

#### Bước 4d — Chỉnh sửa câu trả lời (Post-processing)

Sau khi AI tạo câu trả lời, hệ thống gọi thêm một lần AI nhẹ để:
- Rút ngắn câu trả lời (tối đa ~120 từ)
- Thêm lời chào thân thiện
- Thêm gợi ý tiếp theo cho người dùng

### Giai đoạn 5 — Trả kết quả

Hệ thống gửi câu trả lời về cho người dùng, kèm:
- **Danh sách công thức** đã tham khảo (hiển thị dưới dạng link)
- **Độ tương đồng** cho biết mức độ liên quan của kết quả
- Câu trả lời được **lưu vào lịch sử hội thoại** để các câu hỏi tiếp theo có ngữ cảnh

---

## 3. Hai con đường xử lý

Hệ thống có **2 con đường** để tìm công thức nấu ăn:

### Con đường 1 — Tìm nhanh (Fast Path)
```
Câu hỏi → Tìm tên món trong CSDL → Trả lời ngay
Thời gian: < 200ms, Không tốn credit AI
```

### Con đường 2 — Tìm ngữ nghĩa (Semantic Path)
```
Câu hỏi → Embedding (AI) → So sánh vector → LLM tạo câu trả lời → Post-process
Thời gian: 2-5 giây, Tốn 1-2 credit AI
```

Hệ thống **tự động chọn** con đường phù hợp:
- Câu hỏi có tên món cụ thể → Fast Path (nhanh, miễn phí)
- Câu hỏi mơ hồ, phức tạp → Semantic Path (chính xác hơn)

---

## 4. Sơ đồ tổng hợp một câu hỏi mẫu

```
┌─────────────────────────────────────────────────────────┐
│  NGƯỜI DÙNG: "Cách nấu món chay dễ làm?"              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              GIAI ĐOẠN 1: Tiếp nhận
              - Xác thực người dùng
              - Lưu vào lịch sử
                           │
                           ▼
              GIAI ĐOẠN 2: Phân loại
              - Từ khóa: "cách nấu" → nhóm CÔNG THỨC
              - Chuyển sang Giai đoạn 4
                           │
                           ▼
              GIAI ĐOẠN 3: Chọn xử lý
              - Nhóm CÔNG THỨC → Tìm kiếm RAG
                           │
                           ▼
              GIAI ĐOẠN 4: Tìm kiếm & Tạo câu trả lời
              │
              ├── Bước 4a: Tìm nhanh
              │   Từ khóa: ["chay", "dễ"]
              │   Không tìm thấy tên món chính xác
              │   → Chuyển sang 4b
              │
              ├── Bước 4b: Tìm ngữ nghĩa
              │   Embedding: "món chay dễ làm" → vector
              │   So sánh với 2000+ vector công thức
              │   Kết quả: "Đậu kho tàu", "Nấm xào giòn",
              │            "Rau củ sốt me"
              │
              ├── Bước 4c: Tạo câu trả lời
              │   Gửi Gemini: câu hỏi + 3 công thức
              │   Nhận: câu trả lời tự nhiên tiếng Việt
              │
              └── Bước 4d: Chỉnh sửa
                  Rút ngắn, thân thiện, thêm gợi ý
                           │
                           ▼
              GIAI ĐOẠN 5: Trả kết quả
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  TRẢ LỜI:                                             │
│  Món chay dễ làm bạn có thể thử:                      │
│  1. Đậu kho tàu — Mềm, đậm đà, 45 phút               │
│  2. Nấm xào giòn — Giòn ngon, 20 phút                  │
│  3. Rau củ sốt me — Chua ngọt, 25 phút                 │
│  Bạn muốn xem chi tiết món nào?                        │
│                                                         │
│  Nguồn: Đậu kho tàu (97%), Nấm xào (91%), ...         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Các công nghệ chính

| Thành phần | Công nghệ | Vai trò |
|---|---|---|
| **Ngôn ngữ lập trình** | TypeScript / Node.js | Backend API |
| **Cơ sở dữ liệu** | PostgreSQL (Supabase) | Lưu công thức, lịch sử chat |
| **Vector DB** | pgvector (PostgreSQL) | Lưu vector của công thức |
| **Embedding** | Gemini Embedding API | Chuyển câu hỏi thành vector số |
| **LLM** | Gemini (9 models) | Tạo câu trả lời tự nhiên |
| **Frontend** | React / TypeScript | Giao diện người dùng |
| **Real-time** | Socket.IO | Chat không cần tải lại trang |

---

## 6. Điểm mạnh của hệ thống

1. **Nhanh & Tiết kiệm:** Fast Path cho câu hỏi đơn giản, không tốn credit AI
2. **Thông minh:** Hiểu ngữ cảnh hội thoại, biết người dùng đang hỏi tiếp về món gì
3. **Luôn hoạt động:** 9 mô hình AI xoay vòng, không bị chết vì quá tải
4. **Luôn cập nhật:** Khi thêm công thức mới vào CSDL, vector tự động được tạo
5. **Đa nền tảng:** REST API + WebSocket, hỗ trợ app di động và web
