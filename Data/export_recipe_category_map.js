#!/usr/bin/env node
/**
 * Xuất toàn bộ bảng recipe_category_map ra CSV.
 *
 * Output:
 *   Data/ingredient_unified_output/recipe_category_map.csv
 *
 * Chạy:
 *   node Data/export_recipe_category_map.js
 */

const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../src/backend/.env');
require('dotenv').config({ path: envPath });

const { Sequelize, QueryTypes } = require('sequelize');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');
const OUT_PATH = path.join(OUT_DIR, 'recipe_category_map.csv');

const dbUrl = process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

const useSSL = /supabase\\.co/.test(dbUrl);
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

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await sequelize.authenticate();

  const result = await sequelize.query(
    'SELECT id, recipe_id, category_id, created_at, updated_at FROM recipe_category_map ORDER BY id',
    { type: QueryTypes.SELECT }
  );
  const rows = Array.isArray(result?.[0]) ? result[0] : (Array.isArray(result) ? result : []);

  const headers = ['id', 'recipe_id', 'category_id', 'created_at', 'updated_at'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCsv(r[h])).join(','));
  }

  fs.writeFileSync(OUT_PATH, '\uFEFF' + lines.join('\n'), 'utf8');
  console.log('Wrote', OUT_PATH, 'rows:', rows.length);

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

