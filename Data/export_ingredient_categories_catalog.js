#!/usr/bin/env node
/**
 * Xuất catalog category nguyên liệu: category_id,category_name
 * Nguồn: DB table ingredient_categories
 * Output: Data/ingredient_unified_output/ingredient_categories_catalog.csv
 *
 * Chạy: node Data/export_ingredient_categories_catalog.js
 */

const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '../src/backend/.env');
require('dotenv').config({ path: envPath });

const { Sequelize, QueryTypes } = require('sequelize');

const OUT_DIR = path.join(__dirname, 'ingredient_unified_output');
const OUTPUT = path.join(OUT_DIR, 'ingredient_categories_catalog.csv');

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
  if (s.includes(',') || s.includes('\"') || s.includes('\\n')) return '\"' + s.replace(/\"/g, '\"\"') + '\"';
  return s;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sequelize.authenticate();

  const result = await sequelize.query(
    `SELECT id AS category_id,
            category_name
     FROM ingredient_categories
     ORDER BY id`,
    { type: QueryTypes.SELECT }
  );

  const data = Array.isArray(result?.[0]) ? result[0] : (Array.isArray(result) ? result : []);
  const lines = ['category_id,category_name'];
  for (const r of data) {
    lines.push([r.category_id, escapeCsv(r.category_name || '')].join(','));
  }

  fs.writeFileSync(OUTPUT, '\\uFEFF' + lines.join('\\n'), 'utf8');
  console.log('Wrote', OUTPUT, 'rows:', data.length);

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

