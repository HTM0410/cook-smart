#!/usr/bin/env node
/**
 * Xuất bảng ingredients và recipe_ingredients từ DB ra CSV trong thư mục ingredient_unified_output.
 * Chạy trước build_unified_ingredients_and_mapping.js nếu muốn gộp thêm nguyên liệu từ DB (o1, o2, ...).
 *
 * Cách chạy: node Data/export_db_ingredients_for_unified.js
 */

const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '../src/backend/.env');
require('dotenv').config({ path: envPath });

const { Sequelize, QueryTypes } = require('sequelize');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');
const DB_INGREDIENTS_PATH = path.join(OUT_DIR, 'db_ingredients.csv');
const DB_RECIPE_INGREDIENTS_PATH = path.join(OUT_DIR, 'db_recipe_ingredients.csv');

const dbUrl = process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

const useSSL = /supabase\.co/.test(dbUrl);
const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: useSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

function escapeCsv(val) {
  if (val == null || val === '') return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await sequelize.authenticate();

  const ingredientsResult = await sequelize.query(
    'SELECT id, ingredient_name, category_id, description, unit FROM ingredients ORDER BY id',
    { type: QueryTypes.SELECT }
  );
  const rows = Array.isArray(ingredientsResult?.[0])
    ? ingredientsResult[0]
    : Array.isArray(ingredientsResult)
      ? ingredientsResult
      : [];
  const lines = ['id,ingredient_name,category_id,description,unit'];
  for (const r of rows) {
    lines.push([r.id, r.ingredient_name, r.category_id || '', r.description || '', r.unit || ''].map(escapeCsv).join(','));
  }
  fs.writeFileSync(DB_INGREDIENTS_PATH, '\uFEFF' + lines.join('\n'), 'utf8');
  console.log('Wrote', DB_INGREDIENTS_PATH, 'rows:', rows.length);

  const riResult = await sequelize.query(
    'SELECT recipe_id, ingredient_id, quantity, unit, notes FROM recipe_ingredients ORDER BY recipe_id, ingredient_id',
    { type: QueryTypes.SELECT }
  );
  const riRows = Array.isArray(riResult?.[0])
    ? riResult[0]
    : Array.isArray(riResult)
      ? riResult
      : [];
  const riLines = ['recipe_id,ingredient_id,quantity,unit,notes'];
  for (const r of riRows) {
    riLines.push([r.recipe_id, r.ingredient_id, r.quantity || '', r.unit || '', (r.notes || '').replace(/\r?\n/g, ' ')].map(escapeCsv).join(','));
  }
  fs.writeFileSync(DB_RECIPE_INGREDIENTS_PATH, '\uFEFF' + riLines.join('\n'), 'utf8');
  console.log('Wrote', DB_RECIPE_INGREDIENTS_PATH, 'rows:', riRows.length);

  await sequelize.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
