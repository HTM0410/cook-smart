#!/usr/bin/env node
/**
 * Áp dụng file clean (có 3 cột Trạng thái / Nội dung / Mapping) lên:
 * - ingredient_unified_output/ingredients_unified.csv
 * - ingredient_unified_output/recipe_ingredient_mapping.csv
 *
 * Tạo 2 file MỚI (không sửa file gốc):
 * - ingredient_unified_output/ingredients_unified_cleaned.csv
 * - ingredient_unified_output/recipe_ingredient_mapping_cleaned.csv
 *
 * Quy tắc:
 * - Sửa: đổi name theo cột 'Nội dung' (giữ id).
 * - Xóa: xóa ingredient khỏi bảng unified và remap mọi recipe_ingredient_mapping.ingredient_id sang id trong cột 'Mapping'.
 * - Xóa vĩnh viễn: xóa ingredient khỏi unified và xóa mọi dòng mapping dùng id đó.
 */

const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');

const CLEAN_PATH = path.join(OUT_DIR, 'db_ingredients_clean.csv');
const UNIFIED_IN = path.join(OUT_DIR, 'ingredients_unified.csv');
const MAP_IN = path.join(OUT_DIR, 'recipe_ingredient_mapping.csv');

const UNIFIED_OUT = path.join(OUT_DIR, 'ingredients_unified_cleaned.csv');
const MAP_OUT = path.join(OUT_DIR, 'recipe_ingredient_mapping_cleaned.csv');

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

function normStatus(s) {
  return String(s || '').trim().toLowerCase();
}

function buildInstructions(cleanRows) {
  const rename = new Map();        // id -> newName
  const delForever = new Set();    // id
  const remap = new Map();         // fromId -> toId

  for (const r of cleanRows) {
    const id = parseInt(r.id, 10);
    if (!Number.isFinite(id)) continue;
    const st = normStatus(r['Trạng thái'] || r['Trạng thái '] || r['Trạng thái\t'] || r['Trạng thái\r']);
    const content = String(r['Nội dung'] || r['Nội Dung'] || '').trim();
    const mappingRaw = String(r['Mapping'] || '').trim();
    const mappingId = mappingRaw ? parseInt(mappingRaw, 10) : NaN;

    if (!st) continue;
    if (st.startsWith('sửa')) {
      if (content) rename.set(id, content);
    } else if (st.startsWith('xóa vĩnh viễn')) {
      delForever.add(id);
    } else if (st.startsWith('xóa')) {
      if (Number.isFinite(mappingId)) remap.set(id, mappingId);
    }
  }

  // Chống remap tới id bị xoá vĩnh viễn
  for (const [fromId, toId] of remap.entries()) {
    if (delForever.has(toId)) {
      // nếu đích bị xoá vĩnh viễn, thì coi như xoá vĩnh viễn luôn
      remap.delete(fromId);
      delForever.add(fromId);
    }
  }

  return { rename, delForever, remap };
}

function followRemap(id, remap) {
  // resolve chain a->b->c
  let cur = id;
  const seen = new Set();
  while (remap.has(cur)) {
    if (seen.has(cur)) break;
    seen.add(cur);
    cur = remap.get(cur);
  }
  return cur;
}

function main() {
  const clean = readCsv(CLEAN_PATH);
  const { rename, delForever, remap } = buildInstructions(clean.rows);

  const unified = readCsv(UNIFIED_IN);
  const map = readCsv(MAP_IN);

  // 1) Build cleaned unified ingredient table
  const unifiedOutRows = [];
  for (const r of unified.rows) {
    const id = parseInt(r.id, 10);
    if (!Number.isFinite(id)) continue;

    if (delForever.has(id) || remap.has(id)) {
      // Xóa vĩnh viễn hoặc Xóa (remap) -> bỏ khỏi bảng ingredients
      continue;
    }

    if (rename.has(id)) r.name = rename.get(id);
    unifiedOutRows.push(r);
  }

  // 2) Rewrite recipe_ingredient_mapping with remap / delete
  const mapOutRows = [];
  for (const r of map.rows) {
    const iid = parseInt(r.ingredient_id, 10);
    if (!Number.isFinite(iid)) continue;

    if (delForever.has(iid)) {
      continue; // bỏ dòng
    }

    const newId = followRemap(iid, remap);
    if (delForever.has(newId)) continue;

    r.ingredient_id = String(newId);
    mapOutRows.push(r);
  }

  // write outputs (keep same headers)
  const unifiedHeaders = unified.headers.length ? unified.headers : ['id', 'name', 'source', 'variants_count', 'category_id'];
  const mapHeaders = map.headers.length ? map.headers : ['recipe_id', 'ingredient_id', 'quantity', 'unit', 'notes'];

  fs.writeFileSync(
    UNIFIED_OUT,
    '\uFEFF' + unifiedHeaders.join(',') + '\n' +
      unifiedOutRows.map((r) => unifiedHeaders.map((h) => escapeCsv(r[h] || '')).join(',')).join('\n'),
    'utf8'
  );

  fs.writeFileSync(
    MAP_OUT,
    '\uFEFF' + mapHeaders.join(',') + '\n' +
      mapOutRows.map((r) => mapHeaders.map((h) => escapeCsv(r[h] || '')).join(',')).join('\n'),
    'utf8'
  );

  console.log('Wrote', UNIFIED_OUT, 'rows:', unifiedOutRows.length);
  console.log('Wrote', MAP_OUT, 'rows:', mapOutRows.length);
}

main();

