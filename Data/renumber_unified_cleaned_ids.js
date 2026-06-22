#!/usr/bin/env node
/**
 * Renumber ids in ingredients_unified_cleaned.csv:
 * - Keep DB ids 1..283 unchanged
 * - Renumber all ids >= 284 to be consecutive starting at 284 (sorted by old id asc)
 * Then update ingredient_id in recipe_ingredient_mapping_cleaned.csv accordingly.
 *
 * Outputs (new files, do not overwrite inputs):
 * - ingredient_unified_output/ingredients_unified_cleaned_renumbered.csv
 * - ingredient_unified_output/recipe_ingredient_mapping_cleaned_renumbered.csv
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');
const UNIFIED_IN = path.join(OUT_DIR, 'ingredients_unified_cleaned.csv');
const MAP_IN = path.join(OUT_DIR, 'recipe_ingredient_mapping_cleaned.csv');

const UNIFIED_OUT = path.join(OUT_DIR, 'ingredients_unified_cleaned_renumbered.csv');
const MAP_OUT = path.join(OUT_DIR, 'recipe_ingredient_mapping_cleaned_renumbered.csv');

const CANONICAL_START = 284;

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
  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^\uFEFF/, ''));
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

function writeCsv(filePath, headers, rows) {
  fs.writeFileSync(
    filePath,
    '\uFEFF' + headers.join(',') + '\n' +
      rows.map((r) => headers.map((h) => escapeCsv(r[h] ?? '')).join(',')).join('\n'),
    'utf8'
  );
}

function main() {
  const unified = readCsv(UNIFIED_IN);
  const map = readCsv(MAP_IN);

  const idRows = unified.rows
    .map((r) => ({ r, id: parseInt(r.id, 10) }))
    .filter((x) => Number.isFinite(x.id));

  // Build old->new for ids >= 284 (sorted by old id)
  const canonicalIds = idRows
    .map((x) => x.id)
    .filter((id) => id >= CANONICAL_START)
    .sort((a, b) => a - b);

  const oldToNew = new Map();
  let next = CANONICAL_START;
  for (const oldId of canonicalIds) {
    if (!oldToNew.has(oldId)) {
      oldToNew.set(oldId, next++);
    }
  }

  // Apply to unified rows
  for (const { r, id } of idRows) {
    if (id >= CANONICAL_START) {
      r.id = String(oldToNew.get(id));
    }
  }

  // Apply to mapping rows
  for (const r of map.rows) {
    const iid = parseInt(r.ingredient_id, 10);
    if (!Number.isFinite(iid)) continue;
    if (iid >= CANONICAL_START && oldToNew.has(iid)) {
      r.ingredient_id = String(oldToNew.get(iid));
    }
  }

  const unifiedHeaders = unified.headers.length ? unified.headers : ['id', 'name', 'source', 'variants_count', 'category_id'];
  const mapHeaders = map.headers.length ? map.headers : ['recipe_id', 'ingredient_id', 'quantity', 'unit', 'notes'];

  writeCsv(UNIFIED_OUT, unifiedHeaders, unified.rows);
  writeCsv(MAP_OUT, mapHeaders, map.rows);

  console.log('Renumbered canonical ids:', canonicalIds.length, '->', oldToNew.size, 'unique ids');
  console.log('Wrote', UNIFIED_OUT, 'rows:', unified.rows.length);
  console.log('Wrote', MAP_OUT, 'rows:', map.rows.length);
}

main();

