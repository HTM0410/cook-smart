#!/usr/bin/env node
/**
 * Tạo bảng nguyên liệu thống nhất (n_id + o_id) và recipe_ingredient mapping trong folder ingredient_unified_output.
 *
 * - Nguyên liệu từ ingredients_canonical_final.csv -> id dạng n1, n2, ..., n720
 * - Nguyên liệu từ DB (db_ingredients.csv) -> id dạng o1, o2, ..., o200
 * - recipe_ingredient_mapping.csv: recipe_id, ingredient_id (n_id hoặc o_id), quantity, unit, notes
 *
 * Chạy: node Data/build_unified_ingredients_and_mapping.js
 * (Chạy export_db_ingredients_for_unified.js trước nếu muốn có o1..oN từ DB)
 */

const path = require('path');
const fs = require('fs');

const STANDARDIZE_DIR = path.join(__dirname, 'ingredient_standardize_output');
const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');

const CANONICAL_FINAL = path.join(STANDARDIZE_DIR, 'ingredients_canonical_final.csv');
const RECIPE_ING_FINAL = path.join(STANDARDIZE_DIR, 'ingredients_with_canonical_id_final.csv');
const DB_INGREDIENTS = path.join(OUT_DIR, 'db_ingredients.csv');
const DB_RECIPE_INGREDIENTS = path.join(OUT_DIR, 'db_recipe_ingredients.csv');

const INGREDIENTS_UNIFIED = path.join(OUT_DIR, 'ingredients_unified.csv');
const RECIPE_INGREDIENT_MAPPING = path.join(OUT_DIR, 'recipe_ingredient_mapping.csv');

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
  const headers = parseCsvLine(lines[0]);
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
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1) Canonical -> n1, n2, ...
  const canonical = readCsv(CANONICAL_FINAL);
  const nIds = [];
  const numToNid = {};
  for (let i = 0; i < canonical.rows.length; i++) {
    const r = canonical.rows[i];
    const numId = parseInt(r.ingredient_id, 10);
    if (isNaN(numId)) continue;
    const nId = 'n' + (i + 1);
    numToNid[numId] = nId;
    nIds.push({ n_id: nId, num_id: numId, name: r.canonical_name || '', variants_count: r.variants_count || '', source: 'canonical' });
  }

  // 2) DB ingredients -> o1, o2, ...
  let oIds = [];
  const dbIdToOid = {};
  if (fs.existsSync(DB_INGREDIENTS)) {
    const dbIng = readCsv(DB_INGREDIENTS);
    dbIng.rows.forEach((r, i) => {
      const oId = 'o' + (i + 1);
      oIds.push({ o_id: oId, db_id: r.id, name: r.ingredient_name || '', category_id: r.category_id || '', source: 'db' });
      dbIdToOid[String(r.id)] = oId;
    });
  }

  // 3) Write ingredients_unified.csv: id, name, source, ...
  const unifiedLines = ['id,name,source,variants_count,category_id'];
  nIds.forEach((x) => {
    unifiedLines.push([x.n_id, escapeCsv(x.name), 'canonical', x.variants_count, ''].join(','));
  });
  oIds.forEach((x) => {
    unifiedLines.push([x.o_id, escapeCsv(x.name), 'db', '', x.category_id].join(','));
  });
  fs.writeFileSync(INGREDIENTS_UNIFIED, '\uFEFF' + unifiedLines.join('\n'), 'utf8');
  console.log('Wrote', INGREDIENTS_UNIFIED, '| n_ids:', nIds.length, 'o_ids:', oIds.length);

  // 4) Recipe-ingredient mapping: từ canonical (ingredients_with_canonical_id_final)
  const recipeIng = readCsv(RECIPE_ING_FINAL);
  const mappingLines = ['recipe_id,ingredient_id,quantity,unit,notes'];
  for (const r of recipeIng.rows) {
    const cid = (r.canonical_id || '').trim();
    if (!cid) continue;
    const num = parseInt(cid, 10);
    if (isNaN(num)) continue;
    const ingredientId = numToNid[num];
    if (!ingredientId) continue;
    mappingLines.push([
      r.recipe_id || '',
      ingredientId,
      escapeCsv(r.quantity),
      escapeCsv(r.unit),
      escapeCsv((r.notes || '').replace(/\n/g, ' ')),
    ].join(','));
  }

  // 5) Nếu có db_recipe_ingredients thì append (map ingredient_id -> o_id)
  if (fs.existsSync(DB_RECIPE_INGREDIENTS)) {
    const dbRi = readCsv(DB_RECIPE_INGREDIENTS);
    for (const r of dbRi.rows) {
      const oId = dbIdToOid[String(r.ingredient_id)];
      if (!oId) continue;
      mappingLines.push([
        r.recipe_id || '',
        oId,
        escapeCsv(r.quantity),
        escapeCsv(r.unit),
        escapeCsv((r.notes || '').replace(/\n/g, ' ')),
      ].join(','));
    }
  }

  fs.writeFileSync(RECIPE_INGREDIENT_MAPPING, '\uFEFF' + mappingLines.join('\n'), 'utf8');
  console.log('Wrote', RECIPE_INGREDIENT_MAPPING, 'rows:', mappingLines.length - 1);
}

main();
