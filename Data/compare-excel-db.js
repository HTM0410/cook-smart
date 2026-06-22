#!/usr/bin/env node
/**
 * So sanh file Excel voi database de tim thay doi
 */

require('dotenv').config({ path: require('path').join(__dirname, '../src/backend/.env') });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const XLSX = require('xlsx');

const filePath = path.resolve(process.argv[2] || 'output/database-export-2026-01-23T15-13-00 - Copy.xlsx');

if (!fs.existsSync(filePath)) {
  console.error('File khong ton tai:', filePath);
  process.exit(1);
}

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

// Compare two values
function compareValues(excelVal, dbVal, colName) {
  // Handle null/undefined
  if (excelVal === null || excelVal === undefined || excelVal === '') {
    if (dbVal === null || dbVal === undefined || dbVal === '') return true;
    return false;
  }
  if (dbVal === null || dbVal === undefined) return false;

  // Handle dates (Excel stores as numbers)
  if (colName.includes('_at') && typeof excelVal === 'number') {
    return true; // Skip date comparison for now
  }

  // Handle numbers
  if (typeof excelVal === 'number' && typeof dbVal === 'number') {
    return Math.abs(excelVal - dbVal) < 0.001;
  }
  if (typeof excelVal === 'number') {
    return excelVal === parseFloat(dbVal);
  }

  // String comparison
  return String(excelVal).trim() === String(dbVal).trim();
}

async function compareData() {
  console.log('='.repeat(70));
  console.log('SO SANH FILE EXCEL VOI DATABASE');
  console.log('='.repeat(70));
  console.log('');
  console.log('File:', filePath);
  console.log('');

  const workbook = XLSX.readFile(filePath);
  
  await sequelize.authenticate();
  console.log('Ket noi database thanh cong!');
  console.log('');

  let totalChanges = 0;

  for (const sheetName of Object.keys(sheetToTable)) {
    const tableName = sheetToTable[sheetName];
    const sheet = workbook.Sheets[sheetName];
    
    if (!sheet) {
      console.log(`Sheet ${sheetName} khong ton tai trong file`);
      continue;
    }

    const excelData = XLSX.utils.sheet_to_json(sheet);
    
    // Get DB data
    const dbData = await sequelize.query(
      `SELECT * FROM "${tableName}" ORDER BY id`,
      { type: QueryTypes.SELECT }
    );

    // Create lookup maps
    const dbMap = new Map(dbData.map(row => [row.id, row]));
    const excelMap = new Map(excelData.map(row => [row.id, row]));

    console.log('-'.repeat(70));
    console.log(`TABLE: ${tableName}`);
    console.log(`  Excel: ${excelData.length} dong | DB: ${dbData.length} dong`);

    const changes = [];
    const newRecords = [];
    const deletedRecords = [];

    // Check for changes and new records in Excel
    for (const excelRow of excelData) {
      const dbRow = dbMap.get(excelRow.id);
      
      if (!dbRow) {
        newRecords.push(excelRow.id);
        continue;
      }

      // Compare each column
      const rowChanges = [];
      for (const col of Object.keys(excelRow)) {
        if (col === 'id') continue;
        
        const excelVal = excelRow[col];
        const dbVal = dbRow[col];

        if (!compareValues(excelVal, dbVal, col)) {
          rowChanges.push({
            column: col,
            excel: excelVal,
            db: dbVal
          });
        }
      }

      if (rowChanges.length > 0) {
        changes.push({
          id: excelRow.id,
          changes: rowChanges
        });
      }
    }

    // Check for deleted records (in DB but not in Excel)
    for (const dbRow of dbData) {
      if (!excelMap.has(dbRow.id)) {
        deletedRecords.push(dbRow.id);
      }
    }

    // Report
    if (changes.length === 0 && newRecords.length === 0 && deletedRecords.length === 0) {
      console.log('  => Khong co thay doi');
    } else {
      if (newRecords.length > 0) {
        console.log(`  THEM MOI (${newRecords.length}): ID = ${newRecords.join(', ')}`);
        totalChanges += newRecords.length;
      }

      if (deletedRecords.length > 0) {
        console.log(`  DA XOA (${deletedRecords.length}): ID = ${deletedRecords.join(', ')}`);
      }

      if (changes.length > 0) {
        console.log(`  THAY DOI (${changes.length} dong):`);
        totalChanges += changes.length;
        
        for (const change of changes.slice(0, 10)) { // Show max 10
          console.log(`    ID ${change.id}:`);
          for (const c of change.changes.slice(0, 3)) { // Show max 3 columns per row
            const excelStr = String(c.excel).substring(0, 40);
            const dbStr = String(c.db).substring(0, 40);
            console.log(`      [${c.column}]`);
            console.log(`        Excel: "${excelStr}${String(c.excel).length > 40 ? '...' : ''}"`);
            console.log(`        DB:    "${dbStr}${String(c.db).length > 40 ? '...' : ''}"`);
          }
          if (change.changes.length > 3) {
            console.log(`      ... va ${change.changes.length - 3} thay doi khac`);
          }
        }
        if (changes.length > 10) {
          console.log(`    ... va ${changes.length - 10} dong khac`);
        }
      }
    }
  }

  console.log('');
  console.log('='.repeat(70));
  console.log(`TONG SO THAY DOI: ${totalChanges}`);
  console.log('='.repeat(70));

  if (totalChanges === 0) {
    console.log('');
    console.log('File Excel KHONG co thay doi so voi database hien tai.');
  } else {
    console.log('');
    console.log('De ap dung cac thay doi, chay:');
    console.log(`  node Data/update-db-from-excel.js --file "${path.relative(process.cwd(), filePath)}"`);
  }

  await sequelize.close();
}

compareData().catch(err => {
  console.error('Loi:', err);
  process.exit(1);
});
