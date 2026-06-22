require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function exportRecipeCategoryMap() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Export dữ liệu Recipe_Category_Map
    console.log('📋 Exporting Recipe_Category_Map data...');
    const mappings = await sequelize.query(`
      SELECT 
        rcm.id,
        rcm.recipe_id as "Recipe ID",
        r.recipe_name as "Tên công thức",
        rcm.category_id as "Category ID",
        rc.category_name as "Tên danh mục",
        rc.category_type as "Loại danh mục",
        rcm.created_at as "Ngày tạo",
        rcm.updated_at as "Ngày cập nhật"
      FROM recipe_category_map rcm
      INNER JOIN recipes r ON rcm.recipe_id = r.id
      INNER JOIN recipe_categories rc ON rcm.category_id = rc.id
      ORDER BY rcm.id
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    console.log(`✅ Found ${Array.isArray(mappings) ? mappings.length : 0} mappings\n`);

    // Tạo workbook
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Dữ liệu đầy đủ với tên
    if (Array.isArray(mappings) && mappings.length > 0) {
      const fullDataWS = XLSX.utils.json_to_sheet(mappings.map(item => ({
        'ID': item.id,
        'Recipe ID': item['Recipe ID'],
        'Tên công thức': item['Tên công thức'],
        'Category ID': item['Category ID'],
        'Tên danh mục': item['Tên danh mục'],
        'Loại danh mục': item['Loại danh mục'],
        'Ngày tạo': item['Ngày tạo'] ? new Date(item['Ngày tạo']).toISOString().split('T')[0] : '',
        'Ngày cập nhật': item['Ngày cập nhật'] ? new Date(item['Ngày cập nhật']).toISOString().split('T')[0] : ''
      })));

      // Set column widths
      fullDataWS['!cols'] = [
        { wch: 8 },  // ID
        { wch: 10 }, // Recipe ID
        { wch: 30 }, // Tên công thức
        { wch: 12 }, // Category ID
        { wch: 25 }, // Tên danh mục
        { wch: 15 }, // Loại danh mục
        { wch: 12 }, // Ngày tạo
        { wch: 12 }  // Ngày cập nhật
      ];

      XLSX.utils.book_append_sheet(workbook, fullDataWS, 'Dữ liệu đầy đủ');
    }

    // Sheet 2: Dữ liệu đơn giản (chỉ ID) - để import lại
    if (Array.isArray(mappings) && mappings.length > 0) {
      const simpleDataWS = XLSX.utils.json_to_sheet(mappings.map(item => ({
        'id': item.id,
        'recipe_id': item['Recipe ID'],
        'category_id': item['Category ID']
      })));

      // Set column widths
      simpleDataWS['!cols'] = [
        { wch: 8 },  // id
        { wch: 12 }, // recipe_id
        { wch: 12 }  // category_id
      ];

      XLSX.utils.book_append_sheet(workbook, simpleDataWS, 'Dữ liệu đơn giản (CSV)');
    }

    // Sheet 3: Thống kê theo Recipe
    console.log('📊 Creating statistics by Recipe...');
    const recipeStats = await sequelize.query(`
      SELECT 
        r.id as "Recipe ID",
        r.recipe_name as "Tên công thức",
        COUNT(rcm.id) as "Số lượng danh mục",
        STRING_AGG(rc.category_name, ', ' ORDER BY rc.category_type, rc.category_name) as "Danh sách danh mục"
      FROM recipes r
      LEFT JOIN recipe_category_map rcm ON r.id = rcm.recipe_id
      LEFT JOIN recipe_categories rc ON rcm.category_id = rc.id
      WHERE r.status = 'visible'
      GROUP BY r.id, r.recipe_name
      HAVING COUNT(rcm.id) > 0
      ORDER BY r.id
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    if (Array.isArray(recipeStats) && recipeStats.length > 0) {
      const recipeStatsWS = XLSX.utils.json_to_sheet(recipeStats.map(item => ({
        'Recipe ID': item['Recipe ID'],
        'Tên công thức': item['Tên công thức'],
        'Số lượng danh mục': item['Số lượng danh mục'],
        'Danh sách danh mục': item['Danh sách danh mục']
      })));

      recipeStatsWS['!cols'] = [
        { wch: 10 },
        { wch: 30 },
        { wch: 18 },
        { wch: 60 }
      ];

      XLSX.utils.book_append_sheet(workbook, recipeStatsWS, 'Thống kê theo Recipe');
    }

    // Sheet 4: Thống kê theo Category
    console.log('📊 Creating statistics by Category...');
    const categoryStats = await sequelize.query(`
      SELECT 
        rc.id as "Category ID",
        rc.category_name as "Tên danh mục",
        rc.category_type as "Loại",
        COUNT(rcm.id) as "Số lượng công thức"
      FROM recipe_categories rc
      LEFT JOIN recipe_category_map rcm ON rc.id = rcm.category_id
      GROUP BY rc.id, rc.category_name, rc.category_type
      HAVING COUNT(rcm.id) > 0
      ORDER BY rc.category_type, COUNT(rcm.id) DESC
    `, {
      type: sequelize.QueryTypes.SELECT
    });

    if (Array.isArray(categoryStats) && categoryStats.length > 0) {
      const categoryStatsWS = XLSX.utils.json_to_sheet(categoryStats.map(item => ({
        'Category ID': item['Category ID'],
        'Tên danh mục': item['Tên danh mục'],
        'Loại': item['Loại'],
        'Số lượng công thức': item['Số lượng công thức']
      })));

      categoryStatsWS['!cols'] = [
        { wch: 12 },
        { wch: 25 },
        { wch: 15 },
        { wch: 20 }
      ];

      XLSX.utils.book_append_sheet(workbook, categoryStatsWS, 'Thống kê theo Category');
    }

    // Save file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + 'T' + 
                     new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    const outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = path.join(outputDir, `recipe-category-map-export-${timestamp}.xlsx`);
    XLSX.writeFile(workbook, filename);
    
    console.log(`\n✅ Excel file created: ${filename}`);
    console.log('\n📊 Summary:');
    console.log(`   - Sheet 1: Dữ liệu đầy đủ (${Array.isArray(mappings) ? mappings.length : 0} mappings)`);
    console.log(`   - Sheet 2: Dữ liệu đơn giản (CSV format)`);
    console.log(`   - Sheet 3: Thống kê theo Recipe (${Array.isArray(recipeStats) ? recipeStats.length : 0} recipes)`);
    console.log(`   - Sheet 4: Thống kê theo Category (${Array.isArray(categoryStats) ? categoryStats.length : 0} categories)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

exportRecipeCategoryMap();
