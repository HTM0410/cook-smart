#!/usr/bin/env node
/**
 * Áp dụng pipeline unit+quantity (vừa phải + quy đổi) trực tiếp lên:
 *   ingredient_unified_output/recipe_ingredient_mapping_cleaned_renumbered.csv
 *
 * Output (không sửa file gốc):
 * - ingredient_unified_output/recipe_ingredient_mapping_cleaned_renumbered_unit_final.csv
 * - ingredient_unified_output/recipe_ingredient_units_catalog_cleaned_renumbered_unit_final.csv
 *
 * Quy tắc:
 * 1) Normalize unit theo recipe_ingredient_unit_mapping_draft.csv (keep/map/review/drop)
 * 2) Moderate reduce theo recipe_ingredient_unit_mapping_moderate.csv
 * 3) Convert quantity+unit:
 *    - giữ muỗng canh, muỗng cà phê
 *    - chén -> ml (US cup 240ml)
 *    - l -> ml
 *    - kg -> g
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');

const IN_PATH = path.join(OUT_DIR, 'recipe_ingredient_mapping_cleaned_renumbered.csv');
const DRAFT_MAP = path.join(OUT_DIR, 'recipe_ingredient_unit_mapping_draft.csv');
const MODERATE_MAP = path.join(OUT_DIR, 'recipe_ingredient_unit_mapping_moderate.csv');

const OUT_PATH = path.join(OUT_DIR, 'recipe_ingredient_mapping_cleaned_renumbered_unit_final.csv');
const UNITS_OUT = path.join(OUT_DIR, 'recipe_ingredient_units_catalog_cleaned_renumbered_unit_final.csv');

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

function loadMap(filePath) {
  const lines = readLines(filePath)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length === 0) throw new Error('mapping file empty: ' + filePath);
  const headers = parseCsvLine(lines[0]).map((h) => String(h).replace(/^\uFEFF/, ''));
  const idxRaw = headers.indexOf('raw_unit');
  const idxNorm = headers.indexOf('normalized_unit');
  const idxAction = headers.indexOf('action');
  if (idxRaw === -1 || idxNorm === -1 || idxAction === -1) {
    throw new Error('mapping must contain raw_unit, normalized_unit, action: ' + filePath);
  }
  const map = new Map();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const raw = (cells[idxRaw] ?? '').trim();
    if (!raw) continue;
    map.set(raw, { normalized: (cells[idxNorm] ?? '').trim(), action: normStatus(cells[idxAction] ?? '') });
  }
  return map;
}

function parseQuantity(q) {
  const s0 = String(q ?? '').trim();
  if (!s0) return null;
  const s = s0.replace(',', '.');
  if (/^\d+(\.\d+)?\s*\/\s*\d+(\.\d+)?$/.test(s)) {
    const [a, b] = s.split('/').map((x) => parseFloat(x.trim()));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
    return a / b;
  }
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : null;
}

function formatQuantity(v) {
  const rounded = Math.round(v * 1000) / 1000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function main() {
  const data = readCsv(IN_PATH);
  const headers = data.headers.length ? data.headers : ['recipe_id', 'ingredient_id', 'quantity', 'unit', 'notes'];

  const draft = loadMap(DRAFT_MAP);
  const moderate = loadMap(MODERATE_MAP);

  // Step 1: draft normalize
  for (const r of data.rows) {
    const u = String(r.unit || '').trim();
    if (!u) continue;
    const rule = draft.get(u);
    if (!rule) continue;
    if (rule.action === 'drop') r.unit = '';
    else if (rule.normalized) r.unit = rule.normalized;
  }

  // Step 2: moderate reduce
  for (const r of data.rows) {
    const u = String(r.unit || '').trim();
    if (!u) continue;
    const rule = moderate.get(u);
    if (!rule) continue;
    if (rule.action === 'drop') r.unit = '';
    else if (rule.normalized) r.unit = rule.normalized;
  }

  // Step 3: conversions
  for (const r of data.rows) {
    const unit = String(r.unit || '').trim();
    if (!unit) continue;
    if (unit === 'muỗng canh' || unit === 'muỗng cà phê') continue;
    const qVal = parseQuantity(r.quantity);
    if (qVal == null) continue;
    if (unit === 'chén') {
      r.quantity = formatQuantity(qVal * 240);
      r.unit = 'ml';
    } else if (unit === 'l') {
      r.quantity = formatQuantity(qVal * 1000);
      r.unit = 'ml';
    } else if (unit === 'kg') {
      r.quantity = formatQuantity(qVal * 1000);
      r.unit = 'g';
    }
  }

  // write output
  fs.writeFileSync(
    OUT_PATH,
    '\uFEFF' + headers.join(',') + '\n' +
      data.rows.map((r) => headers.map((h) => escapeCsv(r[h] ?? '')).join(',')).join('\n'),
    'utf8'
  );

  // units catalog
  const counts = new Map();
  for (const r of data.rows) {
    const u = String(r.unit || '').trim();
    if (!u) continue;
    counts.set(u, (counts.get(u) || 0) + 1);
  }
  const units = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  fs.writeFileSync(
    UNITS_OUT,
    '\uFEFFunit,count\n' + units.map(([u, c]) => `${escapeCsv(u)},${c}`).join('\n'),
    'utf8'
  );

  console.log('Wrote', OUT_PATH, 'rows:', data.rows.length);
  console.log('Wrote', UNITS_OUT, 'distinct_units:', units.length);
}

main();

