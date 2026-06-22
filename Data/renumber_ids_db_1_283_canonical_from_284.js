#!/usr/bin/env node
/**
 * Gán lại id: DB = 1-283, Canonical = 284 trở đi.
 * - Cập nhật ingredient_standardize_output: ingredients_canonical_final.csv (id 284..), mapping files.
 * - Cập nhật ingredient_unified_output: ingredients_unified.csv (id 1-283 db, 284.. canonical), recipe_ingredient_mapping (ingredient_id số).
 *
 * Chạy: node Data/renumber_ids_db_1_283_canonical_from_284.js
 */

const path = require('path');
const fs = require('fs');

const STANDARDIZE_DIR = path.join(__dirname, 'ingredient_standardize_output');
const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');

const CANONICAL_FINAL = path.join(STANDARDIZE_DIR, 'ingredients_canonical_final.csv');
const ORIGINAL_MAPPING_FINAL = path.join(STANDARDIZE_DIR, 'ingredients_original_mapping_final.csv');
const RECIPE_ING_FINAL = path.join(STANDARDIZE_DIR, 'ingredients_with_canonical_id_final.csv');
const DB_INGREDIENTS = path.join(OUT_DIR, 'db_ingredients.csv');
const DB_RECIPE_INGREDIENTS = path.join(OUT_DIR, 'db_recipe_ingredients.csv');
const INGREDIENTS_UNIFIED = path.join(OUT_DIR, 'ingredients_unified.csv');
const RECIPE_INGREDIENT_MAPPING = path.join(OUT_DIR, 'recipe_ingredient_mapping.csv');

const CANONICAL_ID_START = 284;

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
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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

function main() {
  fs.mkdirSync(STANDARDIZE_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const canonical = readCsv(CANONICAL_FINAL);
  const oldToNew = {};
  for (let i = 0; i < canonical.rows.length; i++) {
    const r = canonical.rows[i];
    const oldId = parseInt(r.ingredient_id, 10);
    if (isNaN(oldId)) continue;
    const newId = CANONICAL_ID_START + i;
    oldToNew[oldId] = newId;
    r.ingredient_id = String(newId);
  }

  fs.writeFileSync(
    CANONICAL_FINAL,
    'ingredient_id,canonical_name,variants_count\n' +
    canonical.rows.map((r) => [r.ingredient_id, escapeCsv(r.canonical_name), r.variants_count || ''].join(',')).join('\n'),
    'utf8'
  );
  console.log('Updated', CANONICAL_FINAL, '-> ingredient_id', CANONICAL_ID_START, 'to', CANONICAL_ID_START + canonical.rows.length - 1);

  const mapping = readCsv(ORIGINAL_MAPPING_FINAL);
  mapping.rows.forEach((r) => {
    const cid = parseInt(r.canonical_id, 10);
    if (!isNaN(cid) && oldToNew[cid] != null) r.canonical_id = String(oldToNew[cid]);
  });
  const mapHeader = mapping.headers && mapping.headers.length ? mapping.headers : ['original_name', 'canonical_id', 'canonical_name', 'normalized_key'];
  fs.writeFileSync(
    ORIGINAL_MAPPING_FINAL,
    '\uFEFF' + mapHeader.join(',') + '\n' +
    mapping.rows.map((r) => mapHeader.map((h) => escapeCsv(r[h] || '')).join(',')).join('\n'),
    'utf8'
  );
  console.log('Updated', ORIGINAL_MAPPING_FINAL);

  const recipeIng = readCsv(RECIPE_ING_FINAL);
  recipeIng.rows.forEach((r) => {
    const cid = parseInt(r.canonical_id, 10);
    if (!isNaN(cid) && oldToNew[cid] != null) r.canonical_id = String(oldToNew[cid]);
  });
  const riHeader = recipeIng.headers && recipeIng.headers.length ? recipeIng.headers : ['recipe_id', 'source_url', 'ingredient_name', 'quantity', 'unit', 'notes', 'canonical_id'];
  fs.writeFileSync(
    RECIPE_ING_FINAL,
    '\uFEFF' + riHeader.join(',') + '\n' +
    recipeIng.rows.map((r) => riHeader.map((h) => escapeCsv(r[h] || '')).join(',')).join('\n'),
    'utf8'
  );
  console.log('Updated', RECIPE_ING_FINAL);

  const unifiedLines = ['id,name,source,variants_count,category_id'];
  let nextId = 1;
  const dbOldIdToNewId = {};
  if (fs.existsSync(DB_INGREDIENTS)) {
    const dbIng = readCsv(DB_INGREDIENTS);
    dbIng.rows.forEach((r) => {
      const id = nextId++;
      dbOldIdToNewId[String(r.id)] = id;
      unifiedLines.push([id, escapeCsv(r.ingredient_name), 'db', '', r.category_id || ''].join(','));
    });
  }
  const dbCount = nextId - 1;
  canonical.rows.forEach((r) => {
    unifiedLines.push([r.ingredient_id, escapeCsv(r.canonical_name), 'canonical', r.variants_count || '', ''].join(','));
  });
  fs.writeFileSync(INGREDIENTS_UNIFIED, '\uFEFF' + unifiedLines.join('\n'), 'utf8');
  console.log('Updated', INGREDIENTS_UNIFIED, '| id 1-' + dbCount + ' (db),', CANONICAL_ID_START + '-', (CANONICAL_ID_START + canonical.rows.length - 1), '(canonical)');

  const mappingLines = ['recipe_id,ingredient_id,quantity,unit,notes'];
  recipeIng.rows.forEach((r) => {
    if (!r.canonical_id) return;
    mappingLines.push([r.recipe_id, r.canonical_id, escapeCsv(r.quantity), escapeCsv(r.unit), escapeCsv((r.notes || '').replace(/\n/g, ' '))].join(','));
  });
  if (fs.existsSync(DB_RECIPE_INGREDIENTS)) {
    const dbRi = readCsv(DB_RECIPE_INGREDIENTS);
    dbRi.rows.forEach((r) => {
      const newDbIngId = dbOldIdToNewId[String(r.ingredient_id)];
      if (!newDbIngId) return;
      mappingLines.push([r.recipe_id, newDbIngId, escapeCsv(r.quantity), escapeCsv(r.unit), escapeCsv((r.notes || '').replace(/\n/g, ' '))].join(','));
    });
  }
  fs.writeFileSync(RECIPE_INGREDIENT_MAPPING, '\uFEFF' + mappingLines.join('\n'), 'utf8');
  console.log('Updated', RECIPE_INGREDIENT_MAPPING, 'rows:', mappingLines.length - 1);
}

main();
