/**
 * Keyword Sets cho Intent Classification
 *
 * Phân loại theo mức độ rõ ràng:
 *   - STRONG_FOOD_KEYWORDS: chắc chắn là thức ăn
 *   - WEAK_FOOD_KEYWORDS: mơ hồ (VD: "gà"), cần cooking context để phân loại
 *
 * Mỗi Set chứa phiên bản normalized (lowercase, bỏ dấu) để match nhanh.
 */

// ===== STRONG FOOD KEYWORDS (đã normalize) =====
// Các cụm/món ăn rõ ràng - đứng một mình đã đủ để phân loại Recipe
export const STRONG_FOOD_KEYWORDS = new Set<string>([
  // Món nước
  'pho', 'bun', 'com', 'chao', 'hu tieu', 'hutieu',
  'lau', 'mi', 'mi quang', 'mien',

  // Gỏi / salad
  'goi', 'nom', 'xeo',

  // Thịt đã rõ ràng
  'thit kho', 'thit nuong', 'thit xao', 'thit luoc',
  'ga kho', 'ga luoc', 'ga xao', 'ga nuong',
  'bo xao', 'bo nuong', 'bo kho',
  'trung chien', 'trung xao', 'trung hap', 'trung luoc', 'trung op la',
  'trung ngang', 'trung cuon',

  // Canh / soup
  'canh', 'sup', 'soup',

  // Bánh
  'banh', 'banh mi', 'banh cuon', 'banh xeo', 'banh tet',
  'banh chung', 'banh trang', 'banh pia', 'banh bao',

  // Món khác
  'che', 'xoi', 'nem', 'cha', 'gio',
  'bun cha', 'bun bo', 'bun mam', 'bun dau',
  'com tam', 'com chien', 'com ga',

  // Ingredients thông dụng + cooking methods = strong signal
  // Vì "trứng chiên", "thịt kho" rất phổ biến trong query tiếng Việt
  'trung', 'thit', 'ca', 'ga', 'bo', 'heo', 'tom', 'muc',
  'kho', 'xao', 'chien', 'hap', 'nuong', 'luoc', 'rim', 'ham',
]);

// ===== WEAK FOOD KEYWORDS =====
// Nguyên liệu đơn lẻ - chỉ tính khi có cooking context (VD: "cách nấu gà")
export const WEAK_FOOD_KEYWORDS = new Set<string>([
  'thit', 'ca', 'ga', 'bo', 'heo', 'cuu', 'de',
  'tom', 'muc', 'cua', 'oc', 'nghen',
  'rau', 'cu', 'qua', 'dau',
]);

// ===== COOKING CONTEXT =====
// Cho phép weak keyword trở thành Recipe intent
export const COOKING_CONTEXT_KEYWORDS = new Set<string>([
  'cach lam', 'cach nau', 'cong thuc', 'huong dan',
  'cach che bien', 'lam the nao', 'che bien',
  'cach len men', 'cach uop', 'cach hap', 'cach chien',
  'cach rim', 'cach ham', 'lam sao',
]);

// ===== NUTRITION KEYWORDS =====
export const NUTRITION_KEYWORDS = new Set<string>([
  // 1-gram
  'calo', 'calories', 'kcal',
  'protein', 'vitamin', 'glucid', 'lipid',
  'tieu duong', 'mo mau', 'huyet ap',
  'kieng', 'giam', 'tang',
  'dinh', 'duong', 'beo',
  // 2-gram
  'chat dam', 'chat beo', 'chat xo', 'khoang chat',
  'giam can', 'tang can', 'an kieng', 'an chay',
  'it calo', 'nhieu calo', 'it beo', 'nhieu beo',
  'thanh phan dinh duong', 'thanh phan',
  'huyet ap cao', 'huyet ap thap',
  // 3-gram
  'giam can nen an', 'tang can nen an',
  'chat beo co loi', 'thanh phan dinh',
  'mo mau cao', 'huyet ap thap', 'huyet ap cao',
]);

// ===== OFFTOPIC (chỉ khi không có food signal) =====
export const OFFTOPIC_KEYWORDS = new Set<string>([
  'thoi tiet', 'nang', 'mua', 'ret',
  'xe', 'o to', 'xe may', 'xe dap',
  'ca si', 'noi tieng', 'nhac', 'bai hat', 'phim', 'phim anh',
  'bong da', 'the thao', 'world cup', 'olympic',
  'bitcoin', 'chung khoan', 'co phieu',
  'code', 'lap trinh', 'react', 'node', 'javascript', 'python',
  'game', 'tro choi', 'lol', 'lien quan',
  'hoc tap', 'bai thi', 'truong', 'dai hoc',
  'tin tuc', 'chinh tri',
]);

// ===== FOOD_AFTER_CHAO (cháo = món ăn, không phải chào) =====
// Khi thấy "cháo X" → Recipe. Nếu chỉ "chào" → Greeting
export const FOOD_AFTER_CHAO = new Set<string>([
  'ga', 'thit', 'ca', 'tom', 'heo', 'bo', 'trung',
  'yen mach', 'rau', 'kieng', 'chay', 'muc', 'cua',
]);

// ===== FALSE POSITIVE PHRASES =====
// Cụm từ có chứa từ về "thức ăn" nhưng không phải ngữ cảnh nấu ăn
export const FOOD_FALSE_POSITIVE_PHRASES = new Set<string>([
  'banh xe',     // bánh xe (ô tô)
  'ca si',       // ca sĩ
  'tom dat',     // tôm đất (có thể là tên riêng)
  'hoa',         // hoa (không phải thức ăn)
  'dat',         // đất
  'than ga',     // than gà (có thể là thanh gà cũng là food, cần test kỹ)
  'so ga',       // sổ gà (?)
  'long ga',     // lông gà (không phải food - nếu standalone)
]);

// ===== CLARIFY PHRASES =====
export const CLARIFY_PHRASES = new Set<string>([
  'toi khong biet', 'chua biet', 'k biet', 'ko biet',
  'gi vay', 'the nao', 'nhu the nao',
  'giup toi', 'can giup', 'giup minh',
  'hoi gi', 'hoi nhanh',
]);

// ===== RECIPE_DETAIL_PREFIXES =====
export const RECIPE_DETAIL_PREFIXES = new Set<string>([
  'cach lam', 'cach nau', 'lam sao', 'lam the nao',
  'huong dan', 'chi tiet', 'cac buoc',
  'buoc lam', 'buoc nau', 'cach thuc hien',
  // 3-gram
  'cong thuc lam', 'cong thuc nau', 'huong dan lam', 'huong dan nau',
]);

// ===== RECIPE_VARIANT KEYWORDS =====
export const RECIPE_VARIANT_KEYWORDS = new Set<string>([
  'bien the', 'phien ban', 'kieu khac', 'cach khac',
  'chay', 'man', 'ngot', 'cay',
  'truyen thong', 'phien ban khac', 'mien bac', 'mien nam',
]);

// ===== RECIPE_SUBSTITUTE KEYWORDS =====
export const RECIPE_SUBSTITUTE_KEYWORDS = new Set<string>([
  'thay the', 'thay bang', 'co the dung', 'thay vi',
  'khong co', 'thieu', 'het', 'doi',
]);

// ===== SOCIAL KEYWORDS (Tier 1) =====
export const SOCIAL_GREETING_KEYWORDS = new Set<string>([
  'xin chao', 'chao ban', 'hi', 'hello', 'hey',
  'good morning', 'good afternoon',
]);

export const SOCIAL_FAREWELL_KEYWORDS = new Set<string>([
  'tam biet', 'bye', 'goodbye', 'bye bye', 'bai', 'bai nhe',
  'good night',
]);

export const SOCIAL_THANKS_KEYWORDS = new Set<string>([
  'cam on', 'thank', 'thanks', 'thank you', 'thank u',
  'cam nhieu', 'cam on ban', 'cam on nhieu',
]);

export const SOCIAL_WHO_ARE_YOU_KEYWORDS = new Set<string>([
  'ban la ai', 'ten gi', 'ten ban la gi',
  'ban ten gi', 'ban la', 'ban la cai gi',
]);

export const SOCIAL_HELP_KEYWORDS = new Set<string>([
  'giup', 'ho tro', 'help', 'huong dan su dung',
  'ban co the lam gi', 'ban lam duoc gi',
]);

// ===== REFERENCE PRONOUNS (cho Reference Resolver) =====
export const REFERENCE_PRONOUNS = new Set<string>([
  'no', 'cai do', 'mon do', 'mon nay',
  'no do', 'thang do', 'bai do',
]);