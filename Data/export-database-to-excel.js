#!/usr/bin/env node
/**
 * Xuất toàn bộ dữ liệu từ Database ra file Excel
 * 
 * Cách dùng:
 *   node Data/export-database-to-excel.js
 * 
 * Options:
 *   --out      Đường dẫn file output (mặc định: Data/output/database-export-<timestamp>.xlsx)
 */

const envPath = require('path').join(__dirname, '../src/backend/.env');
require('dotenv').config({ path: envPath });
console.log('📄 Loading .env from:', envPath);

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  console.error('❌ Cần cài đặt xlsx: npm install xlsx');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
let outputPath = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outputPath = args[++i];
}

// Default output path
if (!outputPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(__dirname, 'output');
  fs.mkdirSync(outputDir, { recursive: true });
  outputPath = path.join(outputDir, `database-export-${timestamp}.xlsx`);
}

// Database Connection
const dbUrl = process.env.SUPABASE_DB_URL ||
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

// Tables to export
const tables = [
  { name: 'recipes', friendlyName: 'Recipes' },
  { name: 'ingredients', friendlyName: 'Ingredients' },
  { name: 'ingredient_categories', friendlyName: 'Ingredient_Categories' },
  { name: 'recipe_ingredients', friendlyName: 'Recipe_Ingredients' },
  { name: 'recipe_steps', friendlyName: 'Recipe_Steps' },
  { name: 'recipe_categories', friendlyName: 'Recipe_Categories' },
  { name: 'recipe_category_mappings', friendlyName: 'Recipe_Cat_Mappings' },
  { name: 'admins', friendlyName: 'Admins' },
  { name: 'users', friendlyName: 'Users' },
  { name: 'user_favorites', friendlyName: 'User_Favorites' },
  { name: 'ratings', friendlyName: 'Ratings' },
  { name: 'pending_ingredients', friendlyName: 'Pending_Ingredients' }
];

async function exportDatabase() {
  console.log('🔌 Kết nối database...');
  
  try {
    await sequelize.authenticate();
    console.log('✅ Kết nối thành công');
    console.log('');

    const workbook = XLSX.utils.book_new();
    const exportStats = [];

    for (const table of tables) {
      console.log(`📥 Đang xuất: ${table.name}...`);
      
      try {
        // Check if table exists
        const [tableExists] = await sequelize.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = '${table.name}'
          );
        `, { type: QueryTypes.SELECT });

        if (!tableExists.exists) {
          console.log(`   ⚠️  Bảng không tồn tại, bỏ qua`);
          continue;
        }

        // Get all data from table
        const data = await sequelize.query(
          `SELECT * FROM "${table.name}" ORDER BY id`,
          { type: QueryTypes.SELECT }
        );

        if (data.length === 0) {
          console.log(`   📭 Không có dữ liệu`);
          // Create empty sheet with headers
          const [columns] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '${table.name}'
            ORDER BY ordinal_position;
          `, { type: QueryTypes.SELECT });
          
          if (columns) {
            const emptySheet = XLSX.utils.aoa_to_sheet([
              await sequelize.query(`
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '${table.name}'
                ORDER BY ordinal_position;
              `, { type: QueryTypes.SELECT }).then(([cols]) => cols.map(c => c.column_name))
            ]);
            XLSX.utils.book_append_sheet(workbook, emptySheet, table.friendlyName);
          }
          exportStats.push({ table: table.name, rows: 0 });
          continue;
        }

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Auto-size columns
        const maxWidth = 50;
        const colWidths = {};
        const headers = Object.keys(data[0]);
        
        headers.forEach((header, i) => {
          let maxLen = header.length;
          data.forEach(row => {
            const val = row[header];
            if (val !== null && val !== undefined) {
              const len = String(val).length;
              if (len > maxLen) maxLen = Math.min(len, maxWidth);
            }
          });
          colWidths[i] = { wch: maxLen + 2 };
        });
        
        worksheet['!cols'] = Object.values(colWidths);

        XLSX.utils.book_append_sheet(workbook, worksheet, table.friendlyName);
        console.log(`   ✅ ${data.length} rows`);
        exportStats.push({ table: table.name, rows: data.length });

      } catch (error) {
        console.log(`   ❌ Lỗi: ${error.message}`);
        exportStats.push({ table: table.name, rows: 0, error: error.message });
      }
    }

    // Add summary sheet
    console.log('');
    console.log('📊 Tạo sheet tổng hợp...');
    
    const summaryData = [
      ['📊 BÁO CÁO XUẤT DỮ LIỆU DATABASE'],
      [''],
      ['Thời gian xuất:', new Date().toLocaleString('vi-VN')],
      ['Database:', process.env.SUPABASE_DB_HOST || 'Supabase'],
      [''],
      ['THỐNG KÊ THEO BẢNG:'],
      ['Tên bảng', 'Số dòng', 'Ghi chú'],
      ...exportStats.map(s => [s.table, s.rows, s.error || '']),
      [''],
      ['TỔNG CỘNG:', exportStats.reduce((sum, s) => sum + s.rows, 0), 'dòng dữ liệu']
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Also create a joined view for recipes
    console.log('📋 Tạo view chi tiết công thức...');
    
    try {
      const recipesDetail = await sequelize.query(`
        SELECT 
          r.id as recipe_id,
          r.recipe_name,
          r.description,
          r.image_url,
          r.prep_time,
          r.cook_time,
          r.servings,
          r.difficulty,
          r.status,
          r.created_at,
          STRING_AGG(DISTINCT rc.category_name, ', ') as categories,
          COUNT(DISTINCT ri.id) as ingredient_count,
          COUNT(DISTINCT rs.id) as step_count,
          COALESCE(AVG(rt.score), 0) as avg_rating,
          COUNT(DISTINCT rt.id) as rating_count
        FROM recipes r
        LEFT JOIN recipe_category_mappings rcm ON r.id = rcm.recipe_id
        LEFT JOIN recipe_categories rc ON rcm.category_id = rc.id
        LEFT JOIN recipe_ingredients ri ON r.id = ri.recipe_id
        LEFT JOIN recipe_steps rs ON r.id = rs.recipe_id
        LEFT JOIN ratings rt ON r.id = rt.recipe_id
        GROUP BY r.id, r.recipe_name, r.description, r.image_url, 
                 r.prep_time, r.cook_time, r.servings, r.difficulty, 
                 r.status, r.created_at
        ORDER BY r.id
      `, { type: QueryTypes.SELECT });

      if (recipesDetail.length > 0) {
        const detailSheet = XLSX.utils.json_to_sheet(recipesDetail);
        XLSX.utils.book_append_sheet(workbook, detailSheet, 'Recipes_Detail');
        console.log(`   ✅ ${recipesDetail.length} công thức với chi tiết`);
      }
    } catch (e) {
      console.log(`   ⚠️  Không thể tạo view chi tiết: ${e.message}`);
    }

    // Write file
    XLSX.writeFile(workbook, outputPath);

    console.log('');
    console.log('═══════════════════════════════════════════');
    console.log('🎉 XUẤT DỮ LIỆU THÀNH CÔNG!');
    console.log('═══════════════════════════════════════════');
    console.log('');
    console.log('📁 File:', outputPath);
    console.log('');
    console.log('📊 Thống kê:');
    exportStats.forEach(s => {
      const icon = s.error ? '❌' : (s.rows > 0 ? '✅' : '📭');
      console.log(`   ${icon} ${s.table}: ${s.rows} rows`);
    });
    console.log('');
    console.log(`   📦 Tổng: ${exportStats.reduce((sum, s) => sum + s.rows, 0)} dòng dữ liệu`);

  } catch (error) {
    console.error('❌ Lỗi kết nối database:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

exportDatabase();
