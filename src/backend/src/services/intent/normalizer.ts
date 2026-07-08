/**
 * Vietnamese Normalizer & Tokenizer
 * Chuẩn hoá văn bản tiếng Việt để phân loại intent chính xác:
 *   1. Lowercase
 *   2. Bỏ dấu (NFD + remove combining marks) - để match keyword dễ dàng
 *   3. Chuẩn hoá khoảng trắng
 *   4. Tokenize theo word boundary (giữ Unicode letters + digits)
 */

export function normalizeVietnamese(input: string): string {
  if (!input) return '';

  let text = input.toLowerCase();

  // Loại bỏ Unicode replacement character (U+FFFD) xuất hiện khi
  // request bị corrupt encoding (VD frontend gửi UTF-8 bytes sai)
  text = text.replace(/\uFFFD/g, '');

  // NFD: tách ký tự có dấu thành base char + combining marks, sau đó loại bỏ marks
  text = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Chuẩn hoá khoảng trắng
  text = text.trim().replace(/\s+/g, ' ');

  return text;
}

export function tokenize(normalized: string): string[] {
  if (!normalized) return [];

  return normalized
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}