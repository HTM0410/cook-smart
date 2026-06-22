#!/usr/bin/env node
/**
 * Tim cac records trong DB nhung khong co trong Excel (du lieu cu can xoa)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../src/backend/.env') });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const XLSX = require('xlsx');

const filePath = path.resolve(process.argv[2] || 'output/database-export-2026-01-23T15-13-00 - Copy.xlsx');

const dbUrl = process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

const sheetToTable = {
  'Recipes': 'recipes',
  'Ingredients': 'ingredients', 
  'Ingredient_Categories': 'ingredient_categories',
  'Recipe_Ingredients': 'recipe_ingredients',
  'Recipe_Steps': 'recipe_steps',
  'Recipe_Categories': 'recipe_categories'
};

async function findOrphans() {
  console.log('='.repeat(70));
  console.log('TIM DU LIEU CU TRONG DB KHONG CO TRONG EXCEL');
  console.log('='.repeat(70));
  console.log('');
  console.log('File Excel:', filePath);
  console.log('');

  const workbook = XLSX.readFile(filePath);
  await sequelize.authenticate();
  console.log('Ket noi database thanh cong!');
  console.log('');

  const orphansByTable = {};
  let totalOrphans = 0;

  for (const [sheetName, tableName] of Object.entries(sheetToTable)) {
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      console.log(`Sheet ${sheetName} khong ton tai`);
      continue;
    }

    const excelData = XLSX.utils.sheet_to_json(sheet);
    const excelIds = new Set(excelData.map(row => row.id));

    // Get all IDs from database
    const dbData = await sequelize.query(
      `SELECT id FROM "${tableName}" ORDER BY id`,
      { type: QueryTypes.SELECT }
    );

    const orphans = dbData.filter(row => !excelIds.has(row.id));

    console.log('-'.repeat(70));
    console.log(`TABLE: ${tableName}`);
    console.log(`  Excel: ${excelData.length} records | DB: ${dbData.length} records`);

    if (orphans.length === 0) {
      console.log('  => Khong co du lieu cu can xoa');
    } else {
      console.log(`  => CO ${orphans.length} records trong DB nhung KHONG co trong Excel:`);
      const orphanIds = orphans.map(o => o.id);
      console.log(`     IDs: ${orphanIds.slice(0, 20).join(', ')}${orphanIds.length > 20 ? '...' : ''}`);
      
      orphansByTable[tableName] = orphanIds;
      totalOrphans += orphans.length;

      // Show sample data for important tables
      if (['recipes', 'ingredients'].includes(tableName) && orphans.length > 0) {
        const sampleIds = orphanIds.slice(0, 5);
        const nameCol = tableName === 'recipes' ? 'recipe_name' : 'ingredient_name';
        const samples = await sequelize.query(
          `SELECT id, ${nameCol} FROM "${tableName}" WHERE id IN (${sampleIds.join(',')})`,
          { type: QueryTypes.SELECT }
        );
        console.log('     Du lieu mau:');
        samples.forEach(s => {
          console.log(`       - ID ${s.id}: ${s[nameCol]}`);
        });
      }
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log(`TONG SO RECORDS CAN XOA: ${totalOrphans}`);
  console.log('='.repeat(70));

  if (totalOrphans > 0) {
    console.log('');
    console.log('De xoa cac records nay, ban co the:');
    console.log('');
    console.log('1. Xoa tu dong (THAN TRONG!):');
    console.log('   node Data/find-orphan-records.js --delete');
    console.log('');
    console.log('2. Xoa thu cong tung table:');
    for (const [table, ids] of Object.entries(orphansByTable)) {
      if (ids.length > 0) {
        console.log(`   DELETE FROM ${table} WHERE id IN (${ids.join(',')});`);
      }
    }
  }

  // If --delete flag, actually delete
  if (process.argv.includes('--delete')) {
    console.log('');
    console.log('='.repeat(70));
    console.log('DANG XOA DU LIEU CU...');
    console.log('='.repeat(70));

    // Delete in correct order (respect foreign keys)
    const deleteOrder = [
      'recipe_ingredients',
      'recipe_steps', 
      'recipes',
      'ingredients',
      'ingredient_categories',
      'recipe_categories'
    ];

    for (const table of deleteOrder) {
      const ids = orphansByTable[table];
      if (ids && ids.length > 0) {
        try {
          await sequelize.query(
            `DELETE FROM "${table}" WHERE id IN (${ids.join(',')})`,
            { type: QueryTypes.DELETE }
          );
          console.log(`  ✓ ${table}: Xoa ${ids.length} records`);
        } catch (err) {
          console.log(`  ✗ ${table}: Loi - ${err.message}`);
        }
      }
    }

    console.log('');
    console.log('Hoan tat xoa du lieu cu!');
  }

  await sequelize.close();
}

findOrphans().catch(err => {
  console.error('Loi:', err);
  process.exit(1);
});
