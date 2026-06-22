#!/usr/bin/env node
/**
 * Quy đổi unit kèm quantity trên file \"vừa phải\":
 * Input:
 * - ingredient_unified_output/recipe_ingredient_mapping_unit_moderate.csv
 *
 * Output (không sửa file gốc):
 * - ingredient_unified_output/recipe_ingredient_mapping_unit_moderate_converted.csv
 * - ingredient_unified_output/recipe_ingredient_units_catalog_moderate_converted.csv
 *
 * Quy tắc:
 * - Giữ nguyên: 'muỗng canh', 'muỗng cà phê'
 * - chén -> ml theo US cup: q_new = q * 240
 * - l -> ml: q_new = q * 1000
 * - kg -> g: q_new = q * 1000
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');
const IN_PATH = path.join(OUT_DIR, 'recipe_ingredient_mapping_unit_moderate.csv');
const OUT_PATH = path.join(OUT_DIR, 'recipe_ingredient_mapping_unit_moderate_converted.csv');
const UNITS_OUT = path.join(OUT_DIR, 'recipe_ingredient_units_catalog_moderate_converted.csv');

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

function readCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const lines = text.split('\n').filter((l) => l.trim());
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

  let converted = 0;
  let skipped = 0;
  const unitCounts = new Map();

  for (const r of data.rows) {
    const unit = String(r.unit || '').trim();
    if (!unit) continue;

    if (unit === 'muỗng canh' || unit === 'muỗng cà phê') continue;

    const qVal = parseQuantity(r.quantity);
    if (qVal == null) { skipped++; continue; }

    if (unit === 'chén') {
      r.quantity = formatQuantity(qVal * 240);
      r.unit = 'ml';
      converted++;
    } else if (unit === 'l') {
      r.quantity = formatQuantity(qVal * 1000);
      r.unit = 'ml';
      converted++;
    } else if (unit === 'kg') {
      r.quantity = formatQuantity(qVal * 1000);
      r.unit = 'g';
      converted++;
    }
  }

  for (const r of data.rows) {
    const u = String(r.unit || '').trim();
    if (!u) continue;
    unitCounts.set(u, (unitCounts.get(u) || 0) + 1);
  }

  fs.writeFileSync(
    OUT_PATH,
    '\uFEFF' + headers.join(',') + '\n' +
      data.rows.map((r) => headers.map((h) => escapeCsv(r[h] ?? '')).join(',')).join('\n'),
    'utf8'
  );

  const units = Array.from(unitCounts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  fs.writeFileSync(
    UNITS_OUT,
    '\uFEFFunit,count\n' + units.map(([u, c]) => `${escapeCsv(u)},${c}`).join('\n'),
    'utf8'
  );

  console.log('Wrote', OUT_PATH, 'rows:', data.rows.length);
  console.log('Wrote', UNITS_OUT, 'distinct_units:', units.length);
  console.log('Converted rows:', converted, '| skipped (no numeric qty):', skipped);
}

main();

