#!/usr/bin/env node
/**
 * Chuẩn hoá cột `unit` cho recipe_ingredient_mapping_cleaned_renumbered.csv
 * dựa trên mapping file: recipe_ingredient_unit_mapping_draft.csv
 *
 * - Bỏ qua các dòng comment bắt đầu bằng '#'
 * - action:
 *   - drop: set unit = '' (rỗng)
 *   - keep/map/review: nếu normalized_unit có giá trị -> unit = normalized_unit
 *                      nếu normalized_unit rỗng -> giữ nguyên unit gốc
 *
 * Output (không sửa file gốc):
 * - ingredient_unified_output/recipe_ingredient_mapping_unit_normalized.csv
 * - ingredient_unified_output/recipe_ingredient_units_catalog_normalized.csv
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');
const MAP_IN = path.join(OUT_DIR, 'recipe_ingredient_mapping_cleaned_renumbered.csv');
const UNIT_MAP = path.join(OUT_DIR, 'recipe_ingredient_unit_mapping_draft.csv');

const MAP_OUT = path.join(OUT_DIR, 'recipe_ingredient_mapping_unit_normalized.csv');
const UNITS_OUT = path.join(OUT_DIR, 'recipe_ingredient_units_catalog_normalized.csv');

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

function readCsvRawLines(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');
}

function readCsv(filePath) {
  const lines = readCsvRawLines(filePath).filter((l) => l.trim());
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

function loadUnitMapping() {
  const lines = readCsvRawLines(UNIT_MAP)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());

  // remove comment lines
  const filtered = lines.filter((l) => !l.trim().startsWith('#'));
  if (filtered.length === 0) throw new Error('Unit mapping file is empty');

  const headers = parseCsvLine(filtered[0]).map((h) => String(h).replace(/^\uFEFF/, ''));
  const idxRaw = headers.indexOf('raw_unit');
  const idxNorm = headers.indexOf('normalized_unit');
  const idxAction = headers.indexOf('action');
  if (idxRaw === -1 || idxNorm === -1 || idxAction === -1) {
    throw new Error('Unit mapping must contain raw_unit, normalized_unit, action columns');
  }

  const map = new Map(); // raw -> { action, normalized }
  for (const line of filtered.slice(1)) {
    if (!line) continue;
    const cells = parseCsvLine(line);
    const raw = (cells[idxRaw] ?? '').trim();
    if (!raw) continue;
    const normalized = (cells[idxNorm] ?? '').trim();
    const action = normStatus(cells[idxAction] ?? '');
    map.set(raw, { action, normalized });
  }
  return map;
}

function main() {
  const unitMap = loadUnitMapping();
  const mapping = readCsv(MAP_IN);
  const headers = mapping.headers.length ? mapping.headers : ['recipe_id', 'ingredient_id', 'quantity', 'unit', 'notes'];

  const unitCounts = new Map();

  for (const r of mapping.rows) {
    const rawUnit = String(r.unit || '').trim();
    if (!rawUnit) continue;
    const rule = unitMap.get(rawUnit);
    if (rule) {
      if (rule.action === 'drop') {
        r.unit = '';
      } else if (rule.normalized) {
        r.unit = rule.normalized;
      }
    }
  }

  // count normalized units
  for (const r of mapping.rows) {
    const u = String(r.unit || '').trim();
    if (!u) continue;
    unitCounts.set(u, (unitCounts.get(u) || 0) + 1);
  }

  // write normalized mapping
  fs.writeFileSync(
    MAP_OUT,
    '\uFEFF' + headers.join(',') + '\n' +
      mapping.rows.map((r) => headers.map((h) => escapeCsv(r[h] ?? '')).join(',')).join('\n'),
    'utf8'
  );

  // write normalized units catalog
  const units = Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const unitLines = ['unit,count', ...units.map(([u, c]) => `${escapeCsv(u)},${c}`)];
  fs.writeFileSync(UNITS_OUT, '\uFEFF' + unitLines.join('\n'), 'utf8');

  console.log('Wrote', MAP_OUT, 'rows:', mapping.rows.length);
  console.log('Wrote', UNITS_OUT, 'distinct_units:', units.length);
}

main();

