#!/usr/bin/env node
/**
 * Áp dụng mapping unit mức \"vừa phải\" để giảm số lượng unit trong file:
 *   ingredient_unified_output/recipe_ingredient_mapping_unit_normalized.csv
 *
 * Input mapping:
 *   ingredient_unified_output/recipe_ingredient_unit_mapping_moderate.csv
 *
 * Output (không sửa file gốc):
 * - ingredient_unified_output/recipe_ingredient_mapping_unit_moderate.csv
 * - ingredient_unified_output/recipe_ingredient_units_catalog_moderate.csv
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');
const MAP_IN = path.join(OUT_DIR, 'recipe_ingredient_mapping_unit_normalized.csv');
const UNIT_MAP = path.join(OUT_DIR, 'recipe_ingredient_unit_mapping_moderate.csv');

const MAP_OUT = path.join(OUT_DIR, 'recipe_ingredient_mapping_unit_moderate.csv');
const UNITS_OUT = path.join(OUT_DIR, 'recipe_ingredient_units_catalog_moderate.csv');

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (!inQuotes && c === ',') {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
}

function readCsv(filePath) {
  const lines = readLines(filePath).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]).map((h) => String(h).replace(/^\uFEFF/, ''));
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] != null ? cells[i] : ''; });
    return obj;
  });
  return { headers, rows };
}

function escapeCsv(val) {
  if (val == null || val === '') return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function normStatus(s) {
  return String(s || '').trim().toLowerCase();
}

function loadUnitMap() {
  const lines = readLines(UNIT_MAP)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length === 0) throw new Error('unit mapping file empty');

  const headers = parseCsvLine(lines[0]).map((h) => String(h).replace(/^\uFEFF/, ''));
  const idxRaw = headers.indexOf('raw_unit');
  const idxNorm = headers.indexOf('normalized_unit');
  const idxAction = headers.indexOf('action');
  if (idxRaw === -1 || idxNorm === -1 || idxAction === -1) {
    throw new Error('unit mapping must contain raw_unit, normalized_unit, action');
  }

  const map = new Map();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const raw = (cells[idxRaw] ?? '').trim();
    if (!raw) continue;
    map.set(raw, {
      normalized: (cells[idxNorm] ?? '').trim(),
      action: normStatus(cells[idxAction] ?? ''),
    });
  }
  return map;
}

function main() {
  const unitMap = loadUnitMap();
  const data = readCsv(MAP_IN);
  const headers = data.headers.length ? data.headers : ['recipe_id', 'ingredient_id', 'quantity', 'unit', 'notes'];

  const counts = new Map();

  for (const r of data.rows) {
    const raw = String(r.unit || '').trim();
    if (!raw) continue;
    const rule = unitMap.get(raw);
    if (!rule) continue;
    if (rule.action === 'drop') {
      r.unit = '';
    } else if (rule.normalized) {
      r.unit = rule.normalized;
    }
  }

  for (const r of data.rows) {
    const u = String(r.unit || '').trim();
    if (!u) continue;
    counts.set(u, (counts.get(u) || 0) + 1);
  }

  fs.writeFileSync(
    MAP_OUT,
    '\uFEFF' + headers.join(',') + '\n' +
      data.rows.map((r) => headers.map((h) => escapeCsv(r[h] ?? '')).join(',')).join('\n'),
    'utf8'
  );

  const units = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  fs.writeFileSync(
    UNITS_OUT,
    '\uFEFFunit,count\n' + units.map(([u, c]) => `${escapeCsv(u)},${c}`).join('\n'),
    'utf8'
  );

  console.log('Wrote', MAP_OUT, 'rows:', data.rows.length);
  console.log('Wrote', UNITS_OUT, 'distinct_units:', units.length);
}

main();

