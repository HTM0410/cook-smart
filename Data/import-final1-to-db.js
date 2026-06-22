#!/usr/bin/env node
/**
 * Import bộ CSV "Final 1" vào Postgres local.
 *
 * Input files (absolute paths - chỉnh nếu cần):
 * - ingredients.csv
 * - recipes.csv
 * - Recipe_Ingredients.csv
 * - Recipe_Steps.csv
 * - recipe_category_map.csv
 *
 * Mặc định: TRUNCATE các bảng liên quan và nạp lại dữ liệu.
 *
 * Chạy:
 *   node Data/import-final1-to-db.js
 */

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');

const envPath = path.join(__dirname, '../src/backend/.env');
require('dotenv').config({ path: envPath });

const dbUrl = process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

const useSSL = /supabase\.co/.test(dbUrl);
const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: useSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

const BASE = 'H:/2025.2/DA/Chuẩn hóa dữ liệu/Final/final 1';
const FILE_INGREDIENTS = path.join(BASE, 'ingredients.csv');
const FILE_RECIPES = path.join(BASE, 'recipes.csv');
const FILE_RECIPE_ING = path.join(BASE, 'Recipe_Ingredients.csv');
const FILE_STEPS = path.join(BASE, 'Recipe_Steps.csv');
const FILE_RECIPE_CAT_MAP = path.join(BASE, 'recipe_category_map.csv');

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
  const headers = parseCsvLine(lines[0]).map((h) => String(h).replace(/^\uFEFF/, '').trim());
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cells[i] != null ? cells[i] : ''; });
    return obj;
  });
  return { headers, rows };
}

function toInt(v, def = 0) {
  const s = String(v ?? '').trim();
  if (!s) return def;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : def;
}

function toNullableInt(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toNullableFloat(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function mapDifficulty(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s.includes('dễ')) return 'easy';
  if (s.includes('trung')) return 'medium';
  if (s.includes('khó')) return 'hard';
  // fallback
  return 'easy';
}

async function bulkInsert(table, columns, rows, batchSize = 1000) {
  if (!rows.length) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const valuesSql = [];
    const binds = [];
    let p = 1;
    for (const r of batch) {
      const placeholders = columns.map(() => `$${p++}`);
      valuesSql.push(`(${placeholders.join(',')})`);
      for (const c of columns) binds.push(r[c]);
    }
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${valuesSql.join(',')};`;
    await sequelize.query(sql, { bind: binds, type: QueryTypes.INSERT });
    inserted += batch.length;
  }
  return inserted;
}

async function setSeq(table, idCol = 'id') {
  const seqNameRes = await sequelize.query(
    `SELECT pg_get_serial_sequence('${table}', '${idCol}') AS seq`,
    { type: QueryTypes.SELECT }
  );
  const seqName = seqNameRes?.[0]?.seq;
  if (!seqName) return;
  await sequelize.query(
    `SELECT setval('${seqName}', COALESCE((SELECT MAX(${idCol}) FROM ${table}), 0) + 1, false);`,
    { type: QueryTypes.SELECT }
  );
}

async function main() {
  console.log('Connecting DB...');
  await sequelize.authenticate();

  console.log('Reading CSV files...');
  const ing = readCsv(FILE_INGREDIENTS);
  const recipes = readCsv(FILE_RECIPES);
  const recipeIng = readCsv(FILE_RECIPE_ING);
  const steps = readCsv(FILE_STEPS);
  const rcMap = readCsv(FILE_RECIPE_CAT_MAP);

  console.log('Truncating tables...');
  await sequelize.query('BEGIN;');
  try {
    // Truncate theo nhóm để tránh lỗi FK, dùng CASCADE cho bảng cha
    await sequelize.query('TRUNCATE TABLE recipe_category_map RESTART IDENTITY;');
    await sequelize.query('TRUNCATE TABLE recipe_steps RESTART IDENTITY;');
    await sequelize.query('TRUNCATE TABLE recipe_ingredients RESTART IDENTITY;');
    await sequelize.query('TRUNCATE TABLE recipes RESTART IDENTITY CASCADE;');
    await sequelize.query('TRUNCATE TABLE ingredients RESTART IDENTITY CASCADE;');
    await sequelize.query('COMMIT;');
  } catch (e) {
    await sequelize.query('ROLLBACK;');
    throw e;
  }

  const now = new Date();

  console.log('Preparing rows...');
  // Dedupe ingredients theo ingredient_name (DB unique). Giữ id đầu tiên, remap id trùng sang id đã giữ.
  const nameToKeptId = new Map();      // name -> keptId
  const dupIdToKeptId = new Map();     // oldId -> keptId
  const ingRows = [];
  for (const r of ing.rows) {
    const id = toInt(r.id);
    const name = String(r.ingredient_name || '').trim();
    if (!name) continue;
    const existing = nameToKeptId.get(name);
    if (existing != null) {
      dupIdToKeptId.set(id, existing);
      continue;
    }
    nameToKeptId.set(name, id);
    ingRows.push({
      id,
      ingredient_name: name,
      category_id: toInt(r.category_id, 14),
      description: (String(r.description || '').trim() || null),
      created_at: now,
      updated_at: now,
    });
  }

  const recipeRows = recipes.rows.map((r) => ({
    id: toInt(r.id),
    recipe_name: String(r.recipe_name || '').trim(),
    description: (String(r.description || '').trim() || null),
    image_url: (String(r.image_url || '').trim() || null),
    prep_time: toInt(r.prep_time, 0),
    cook_time: toInt(r.cook_time, 0),
    servings: toInt(r.servings, 1),
    difficulty: mapDifficulty(r.difficulty),
    created_by: toInt(r.created_by, 1),
    status: (String(r.status || '').trim() || 'visible'),
    created_at: now,
    updated_at: now,
  }));

  const recipeIdSet = new Set(recipeRows.map((r) => r.id));
  const ingredientIdSet = new Set(ingRows.map((r) => r.id));

  const stepRowsAll = steps.rows.map((r) => ({
    id: toInt(r.id),
    recipe_id: toInt(r.recipe_id),
    step_number: toInt(r.step_number),
    instruction: String(r.instruction || '').trim(),
    image_url: (String(r.image_url || '').trim() || null),
    created_at: now,
    updated_at: now,
  }));
  const stepRows = stepRowsAll.filter((r) => recipeIdSet.has(r.recipe_id));

  const recipeIngRowsAll = recipeIng.rows.map((r) => {
    const oldIngId = toInt(r.ingredient_id);
    const remapped = dupIdToKeptId.get(oldIngId) ?? oldIngId;
    return {
      id: toInt(r.id),
      recipe_id: toInt(r.recipe_id),
      ingredient_id: remapped,
      quantity: toNullableFloat(r.quantity),
      unit: (String(r.unit || '').trim() || null),
      notes: (String(r.notes || '').trim() || null),
      created_at: now,
      updated_at: now,
    };
  });
  const recipeIngRows = recipeIngRowsAll.filter(
    (r) => recipeIdSet.has(r.recipe_id) && ingredientIdSet.has(r.ingredient_id)
  );
  // Dedupe recipe_ingredients theo unique (recipe_id, ingredient_id)
  const riKeyToRow = new Map();
  for (const r of recipeIngRows) {
    const key = `${r.recipe_id}:${r.ingredient_id}`;
    const existing = riKeyToRow.get(key);
    if (!existing) {
      riKeyToRow.set(key, r);
      continue;
    }
    // Nếu bản trước thiếu quantity mà bản sau có, ưu tiên lấy quantity/unit/notes
    const exQty = existing.quantity;
    const curQty = r.quantity;
    if ((exQty == null || exQty === '') && curQty != null) {
      existing.quantity = curQty;
      existing.unit = r.unit;
      existing.notes = r.notes;
    }
  }
  const recipeIngRowsDedup = Array.from(riKeyToRow.values());

  // recipe_category_map.csv header: ID,Recipe ID,Category ID
  const rcMapRowsAll = rcMap.rows.map((r) => ({
    id: toInt(r.ID ?? r.id),
    recipe_id: toInt(r['Recipe ID'] ?? r.recipe_id),
    category_id: toInt(r['Category ID'] ?? r.category_id),
    created_at: now,
    updated_at: now,
  }));
  const rcMapRowsFiltered = rcMapRowsAll.filter(
    (r) => recipeIdSet.has(r.recipe_id) && r.category_id > 0
  );
  // Dedupe theo unique (recipe_id, category_id)
  const rcKeyToRow = new Map();
  for (const r of rcMapRowsFiltered) {
    const key = `${r.recipe_id}:${r.category_id}`;
    if (!rcKeyToRow.has(key)) rcKeyToRow.set(key, r);
  }
  const rcMapRows = Array.from(rcKeyToRow.values());

  const droppedSteps = stepRowsAll.length - stepRows.length;
  const droppedRecipeIng = recipeIngRowsAll.length - recipeIngRows.length;
  const droppedRecipeIngDup = recipeIngRows.length - recipeIngRowsDedup.length;
  const droppedRcMap = rcMapRowsAll.length - rcMapRowsFiltered.length;
  const droppedRcMapDup = rcMapRowsFiltered.length - rcMapRows.length;
  if (droppedSteps || droppedRecipeIng || droppedRcMap) {
    console.log('Filtered orphan rows:', {
      recipe_steps_dropped: droppedSteps,
      recipe_ingredients_dropped: droppedRecipeIng,
      recipe_category_map_dropped: droppedRcMap,
    });
  }
  if (droppedRecipeIngDup) {
    console.log('Deduped recipe_ingredients (recipe_id,ingredient_id):', droppedRecipeIngDup);
  }
  if (droppedRcMapDup) {
    console.log('Deduped recipe_category_map (recipe_id,category_id):', droppedRcMapDup);
  }

  console.log('Inserting ingredients...');
  await bulkInsert('ingredients', ['id', 'ingredient_name', 'category_id', 'description', 'created_at', 'updated_at'], ingRows, 1000);

  console.log('Inserting recipes...');
  await bulkInsert('recipes', ['id', 'recipe_name', 'description', 'image_url', 'prep_time', 'cook_time', 'servings', 'difficulty', 'created_by', 'status', 'created_at', 'updated_at'], recipeRows, 500);

  console.log('Inserting recipe_steps...');
  await bulkInsert('recipe_steps', ['id', 'recipe_id', 'step_number', 'instruction', 'image_url', 'created_at', 'updated_at'], stepRows, 1000);

  console.log('Inserting recipe_ingredients...');
  await bulkInsert('recipe_ingredients', ['id', 'recipe_id', 'ingredient_id', 'quantity', 'unit', 'notes', 'created_at', 'updated_at'], recipeIngRowsDedup, 1000);

  console.log('Inserting recipe_category_map...');
  await bulkInsert('recipe_category_map', ['id', 'recipe_id', 'category_id', 'created_at', 'updated_at'], rcMapRows, 2000);

  console.log('Fixing sequences...');
  await setSeq('ingredients');
  await setSeq('recipes');
  await setSeq('recipe_steps');
  await setSeq('recipe_ingredients');
  await setSeq('recipe_category_map');

  console.log('Done.');
  await sequelize.close();
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});

