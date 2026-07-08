/**
 * Unit tests for Vietnamese Normalizer & Tokenizer
 */

import { describe, it, expect } from '@jest/globals';
import { normalizeVietnamese, tokenize } from '../../services/intent/normalizer';

describe('normalizeVietnamese', () => {
  it('lowercases input', () => {
    expect(normalizeVietnamese('Xin CHAO')).toBe('xin chao');
  });

  it('strips diacritics (bỏ dấu)', () => {
    expect(normalizeVietnamese('Phở Bò')).toBe('pho bo');
    expect(normalizeVietnamese('Gà Xào')).toBe('ga xao');
    expect(normalizeVietnamese('Cháo')).toBe('chao');
  });

  it('trims and collapses whitespace', () => {
    expect(normalizeVietnamese('  Gà   Xào  ')).toBe('ga xao');
    expect(normalizeVietnamese('a\n\nb\tc')).toBe('a b c');
  });

  it('handles empty/null input', () => {
    expect(normalizeVietnamese('')).toBe('');
    expect(normalizeVietnamese(null as unknown as string)).toBe('');
    expect(normalizeVietnamese(undefined as unknown as string)).toBe('');
  });

  it('preserves digits', () => {
    expect(normalizeVietnamese('Món thứ 2')).toBe('mon thu 2');
    expect(normalizeVietnamese('100g thịt')).toBe('100g thit');
  });

  it('handles complex Vietnamese diacritics', () => {
    expect(normalizeVietnamese('Bánh Xèo')).toBe('banh xeo');
    expect(normalizeVietnamese('Bún Chả')).toBe('bun cha');
    expect(normalizeVietnamese('Hủ Tiếu')).toBe('hu tieu');
    expect(normalizeVietnamese('Bánh Tráng')).toBe('banh trang');
  });
});

describe('tokenize', () => {
  it('splits by non-letter/digit boundaries', () => {
    expect(tokenize('ga xao')).toEqual(['ga', 'xao']);
    expect(tokenize('thit, ca, ga')).toEqual(['thit', 'ca', 'ga']);
    expect(tokenize('cach-lam-pho-bo')).toEqual(['cach', 'lam', 'pho', 'bo']);
  });

  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('preserves single token', () => {
    expect(tokenize('chao')).toEqual(['chao']);
    expect(tokenize('chao ga')).toEqual(['chao', 'ga']);
  });

  it('keeps digits inside tokens', () => {
    expect(tokenize('mon thu 2')).toEqual(['mon', 'thu', '2']);
  });
});