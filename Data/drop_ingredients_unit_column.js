#!/usr/bin/env node
/**
 * Drop column `unit` from table `ingredients`.
 *
 * Chạy:
 *   node Data/drop_ingredients_unit_column.js
 */

const path = require('path');
const fs = require('fs');
const envPath = path.join(__dirname, '../src/backend/.env');
require('dotenv').config({ path: envPath });

const { Sequelize, QueryTypes } = require('sequelize');

const dbUrl = process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

const useSSL = /supabase\\.co/.test(dbUrl);
const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: useSSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

async function main() {
  await sequelize.authenticate();

  const cols = await sequelize.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='ingredients' ORDER BY ordinal_position",
    { type: QueryTypes.SELECT }
  );
  const rows = Array.isArray(cols?.[0]) ? cols[0] : (Array.isArray(cols) ? cols : []);
  const hasUnit = rows.some((r) => r.column_name === 'unit');

  if (!hasUnit) {
    console.log('Column ingredients.unit does not exist. Nothing to do.');
    await sequelize.close();
    return;
  }

  await sequelize.query('ALTER TABLE ingredients DROP COLUMN unit;');
  console.log('Dropped column ingredients.unit');

  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

