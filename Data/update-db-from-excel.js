#!/usr/bin/env node
/**
 * Update database tu file Excel export
 * 
 * Cach dung:
 *   node Data/update-db-from-excel.js --file "Data/output/database-export-xxx.xlsx"
 * 
 * Options:
 *   --file      Duong dan file Excel
 *   --dry-run   Chi kiem tra, khong update that
 *   --tables    Chi update cac tables cu the (vd: --tables recipes,ingredients)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../src/backend/.env') });

const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');
const XLSX = require('xlsx');

// Parse arguments
const args = process.argv.slice(2);
const params = {
  file: '',
  dryRun: false,
  tables: null // null = all tables
};

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file') params.file = args[++i];
  if (args[i] === '--dry-run') params.dryRun = true;
  if (args[i] === '--tables') params.tables = args[++i].split(',');
}

if (!params.file) {
  console.error('Thieu --file');
  console.log('Cach dung: node Data/update-db-from-excel.js --file <path-to-excel>');
  process.exit(1);
}

const filePath = path.resolve(params.file);
if (!fs.existsSync(filePath)) {
  console.error('File khong ton tai:', filePath);
  process.exit(1);
}

// Database connection
const dbUrl = process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  }
});

// Sheet name to table name mapping
const sheetToTable = {
  'Recipes': 'recipes',
  'Ingredients': 'ingredients',
  'Ingredient_Categories': 'ingredient_categories',
  'Recipe_Ingredients': 'recipe_ingredients',
  'Recipe_Steps': 'recipe_steps',
  'Recipe_Categories': 'recipe_categories',
  'Admins': 'admins',
  'Users': 'users',
  'User_Favorites': 'user_favorites',
  'Pending_Ingredients': 'pending_ingredients'
};

// Convert Excel date to proper date string
function excelDateToJSDate(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate;
  
  // Excel date is number of days since 1900-01-01
  const date = new Date((excelDate - 25569) * 86400 * 1000);
  return date.toISOString();
}

// Process row data - convert Excel dates
function processRow(row, tableName) {
  const processed = { ...row };
  
  // Convert date columns
  if (processed.created_at && typeof processed.created_at === 'number') {
    processed.created_at = excelDateToJSDate(processed.created_at);
  }
  if (processed.updated_at && typeof processed.updated_at === 'number') {
    processed.updated_at = excelDateToJSDate(processed.updated_at);
  }
  
  return processed;
}

async function updateDatabase() {
  console.log('='.repeat(60));
  console.log('UPDATE DATABASE TU FILE EXCEL');
  console.log('='.repeat(60));
  console.log('');
  console.log('File:', filePath);
  console.log('Dry run:', params.dryRun ? 'CO (chi kiem tra)' : 'KHONG (update that)');
  console.log('');

  // Read Excel
  const workbook = XLSX.readFile(filePath);
  
  // Connect to DB
  console.log('Ket noi database...');
  await sequelize.authenticate();
  console.log('Ket noi thanh cong!');
  console.log('');

  const results = [];

  for (const sheetName of workbook.SheetNames) {
    const tableName = sheetToTable[sheetName];
    
    // Skip non-data sheets
    if (!tableName) {
      console.log(`Bo qua sheet: ${sheetName} (khong phai data table)`);
      continue;
    }

    // Check if table filter is applied
    if (params.tables && !params.tables.includes(tableName)) {
      console.log(`Bo qua table: ${tableName} (khong trong danh sach)`);
      continue;
    }

    console.log('-'.repeat(60));
    console.log(`Sheet: ${sheetName} -> Table: ${tableName}`);

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    if (data.length === 0) {
      console.log('  Khong co du lieu');
      results.push({ table: tableName, inserted: 0, updated: 0, errors: 0 });
      continue;
    }

    console.log(`  So dong: ${data.length}`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const row of data) {
      const processedRow = processRow(row, tableName);
      const id = processedRow.id;

      if (!id) {
        console.log('  Loi: Dong khong co id');
        errors++;
        continue;
      }

      try {
        if (params.dryRun) {
          // Just check if record exists
          const [existing] = await sequelize.query(
            `SELECT id FROM "${tableName}" WHERE id = :id`,
            { replacements: { id }, type: QueryTypes.SELECT }
          );
          if (existing) {
            updated++;
          } else {
            inserted++;
          }
        } else {
          // Check if record exists
          const [existing] = await sequelize.query(
            `SELECT id FROM "${tableName}" WHERE id = :id`,
            { replacements: { id }, type: QueryTypes.SELECT }
          );

          if (existing) {
            // Update existing record
            const columns = Object.keys(processedRow).filter(k => k !== 'id');
            const setClause = columns.map(c => `"${c}" = :${c}`).join(', ');
            
            await sequelize.query(
              `UPDATE "${tableName}" SET ${setClause} WHERE id = :id`,
              { replacements: processedRow, type: QueryTypes.UPDATE }
            );
            updated++;
          } else {
            // Insert new record
            const columns = Object.keys(processedRow);
            const colNames = columns.map(c => `"${c}"`).join(', ');
            const colValues = columns.map(c => `:${c}`).join(', ');
            
            await sequelize.query(
              `INSERT INTO "${tableName}" (${colNames}) VALUES (${colValues})`,
              { replacements: processedRow, type: QueryTypes.INSERT }
            );
            inserted++;
          }
        }
      } catch (err) {
        console.log(`  Loi dong id=${id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`  Ket qua: Insert=${inserted}, Update=${updated}, Errors=${errors}`);
    results.push({ table: tableName, inserted, updated, errors });
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log('TONG KET');
  console.log('='.repeat(60));
  
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  results.forEach(r => {
    console.log(`${r.table}: Insert=${r.inserted}, Update=${r.updated}, Errors=${r.errors}`);
    totalInserted += r.inserted;
    totalUpdated += r.updated;
    totalErrors += r.errors;
  });

  console.log('-'.repeat(60));
  console.log(`TONG: Insert=${totalInserted}, Update=${totalUpdated}, Errors=${totalErrors}`);

  if (params.dryRun) {
    console.log('');
    console.log('Day la ket qua DRY RUN - khong co thay doi nao duoc ap dung.');
    console.log('Bo co --dry-run de update that.');
  }

  await sequelize.close();
}

updateDatabase().catch(err => {
  console.error('Loi:', err);
  process.exit(1);
});
