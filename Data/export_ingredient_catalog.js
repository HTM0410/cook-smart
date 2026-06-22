#!/usr/bin/env node
/**
 * Xuất catalog nguyên liệu dạng rút gọn: chỉ gồm id,name
 * Nguồn: Data/ingredient_unified_output/ingredients_unified_cleaned_renumbered.csv
 * Output: Data/ingredient_unified_output/ingredients_catalog.csv
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');
const INPUT = path.join(OUT_DIR, 'ingredients_unified_cleaned_renumbered.csv');
const OUTPUT = path.join(OUT_DIR, 'ingredients_catalog.csv');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (!inQuotes && c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function escapeCsv(val) {
  if (val == null || val === '') return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function main() {
  const text = fs.readFileSync(INPUT, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) throw new Error('Input CSV is empty');

  const headers = parseCsvLine(lines[0]).map((h) => String(h).replace(/^\uFEFF/, ''));
  const idIdx = headers.indexOf('id');
  const nameIdx = headers.indexOf('name');
  if (idIdx === -1 || nameIdx === -1) throw new Error('Missing id/name columns in input');

  const outLines = ['id,name'];
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const id = (cells[idIdx] ?? '').trim();
    const name = (cells[nameIdx] ?? '').trim();
    if (!id || !name) continue;
    outLines.push([id, escapeCsv(name)].join(','));
  }

  fs.writeFileSync(OUTPUT, '\uFEFF' + outLines.join('\n'), 'utf8');
  console.log('Wrote', OUTPUT, 'rows:', outLines.length - 1);
}

main();

