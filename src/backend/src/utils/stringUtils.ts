export const normalizeText = (value: string): string =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .trim() || '';

export default {
  normalizeText,
};

