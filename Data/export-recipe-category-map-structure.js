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

async function exportRecipeCategoryMapStructure() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Cấu trúc bảng (Schema)
    console.log('📋 Creating schema sheet...');
    const schemaData = [
      ['Cột', 'Kiểu dữ liệu', 'Ràng buộc', 'Mô tả'],
      ['id', 'INTEGER', 'PRIMARY KEY, AUTO_INCREMENT', 'ID tự động tăng, khóa chính'],
      ['recipe_id', 'INTEGER', 'NOT NULL, FOREIGN KEY → recipes(id)', 'ID của công thức (tham chiếu bảng recipes)'],
      ['category_id', 'INTEGER', 'NOT NULL, FOREIGN KEY → recipe_categories(id)', 'ID của danh mục (tham chiếu bảng recipe_categories)'],
      ['created_at', 'DATETIME', 'NOT NULL, DEFAULT CURRENT_TIMESTAMP', 'Thời gian tạo bản ghi'],
      ['updated_at', 'DATETIME', 'NOT NULL, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', 'Thời gian cập nhật bản ghi'],
      ['', '', '', ''],
      ['Ràng buộc bổ sung:', '', '', ''],
      ['UNIQUE KEY', 'unique_recipe_category', '(recipe_id, category_id)', 'Mỗi công thức chỉ có thể có 1 lần phân loại cho mỗi danh mục'],
      ['INDEX', 'idx_recipe_id', 'recipe_id', 'Index để tìm kiếm nhanh theo recipe_id'],
      ['INDEX', 'idx_category_id', 'category_id', 'Index để tìm kiếm nhanh theo category_id'],
      ['FOREIGN KEY', 'fk_recipe', 'recipe_id → recipes(id) ON DELETE CASCADE', 'Xóa công thức sẽ xóa tất cả mapping'],
      ['FOREIGN KEY', 'fk_category', 'category_id → recipe_categories(id) ON DELETE CASCADE', 'Xóa danh mục sẽ xóa tất cả mapping'],
    ];

    const schemaWS = XLSX.utils.aoa_to_sheet(schemaData);
    
    // Set column widths
    schemaWS['!cols'] = [
      { wch: 20 }, // Cột
      { wch: 50 }, // Kiểu dữ liệu
      { wch: 60 }, // Ràng buộc
      { wch: 80 }  // Mô tả
    ];

    XLSX.utils.book_append_sheet(workbook, schemaWS, 'Cấu trúc bảng');

    // Sheet 2: Dữ liệu hiện tại
    console.log('📋 Exporting current data...');
    const currentData = await sequelize.query(`
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

    console.log(`✅ Found ${Array.isArray(currentData) ? currentData.length : 0} mappings`);

    if (Array.isArray(currentData) && currentData.length > 0) {
      const dataWS = XLSX.utils.json_to_sheet(currentData.map(item => ({
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
      dataWS['!cols'] = [
        { wch: 8 },  // ID
        { wch: 10 }, // Recipe ID
        { wch: 30 }, // Tên công thức
        { wch: 12 }, // Category ID
        { wch: 25 }, // Tên danh mục
        { wch: 15 }, // Loại danh mục
        { wch: 12 }, // Ngày tạo
        { wch: 12 }  // Ngày cập nhật
      ];

      XLSX.utils.book_append_sheet(workbook, dataWS, 'Dữ liệu hiện tại');
    }

    // Sheet 3: Template để nhập dữ liệu mới
    console.log('📋 Creating template sheet...');
    
    // Lấy danh sách recipes và categories để làm reference
    const recipes = await sequelize.query(`
      SELECT id, recipe_name 
      FROM recipes 
      WHERE status = 'visible'
      ORDER BY id
    `, { type: sequelize.QueryTypes.SELECT });

    const categories = await sequelize.query(`
      SELECT id, category_name, category_type 
      FROM recipe_categories 
      ORDER BY category_type, category_name
    `, { type: sequelize.QueryTypes.SELECT });

    // Tạo template với hướng dẫn
    const templateData = [
      ['HƯỚNG DẪN:', '', ''],
      ['1. Điền Recipe ID (ID của công thức) vào cột "Recipe ID"', '', ''],
      ['2. Điền Category ID (ID của danh mục) vào cột "Category ID"', '', ''],
      ['3. Không cần điền ID (sẽ tự động tạo)', '', ''],
      ['4. Mỗi dòng là một mapping giữa công thức và danh mục', '', ''],
      ['5. Một công thức có thể có nhiều danh mục (mỗi danh mục một dòng)', '', ''],
      ['', '', ''],
      ['Recipe ID', 'Category ID', 'Ghi chú'],
    ];

    // Thêm 10 dòng trống để nhập dữ liệu
    for (let i = 0; i < 10; i++) {
      templateData.push(['', '', '']);
    }

    templateData.push(['', '', '']);
    templateData.push(['DANH SÁCH RECIPES (Tham khảo):', '', '']);
    templateData.push(['Recipe ID', 'Tên công thức', '']);

    if (Array.isArray(recipes)) {
      recipes.forEach(r => {
        templateData.push([r.id, r.recipe_name, '']);
      });
    }

    templateData.push(['', '', '']);
    templateData.push(['DANH SÁCH CATEGORIES (Tham khảo):', '', '']);
    templateData.push(['Category ID', 'Tên danh mục', 'Loại']);

    if (Array.isArray(categories)) {
      categories.forEach(c => {
        templateData.push([c.id, c.category_name, c.category_type]);
      });
    }

    const templateWS = XLSX.utils.aoa_to_sheet(templateData);
    
    // Set column widths
    templateWS['!cols'] = [
      { wch: 12 }, // Recipe ID
      { wch: 30 }, // Category ID / Tên
      { wch: 50 }  // Ghi chú / Loại
    ];

    XLSX.utils.book_append_sheet(workbook, templateWS, 'Template nhập dữ liệu');

    // Sheet 4: Reference tables (để dễ tra cứu)
    console.log('📋 Creating reference sheets...');
    
    // Recipes reference
    if (Array.isArray(recipes) && recipes.length > 0) {
      const recipesRefData = recipes.map(r => ({
        'Recipe ID': r.id,
        'Tên công thức': r.recipe_name
      }));
      const recipesRefWS = XLSX.utils.json_to_sheet(recipesRefData);
      recipesRefWS['!cols'] = [
        { wch: 12 },
        { wch: 40 }
      ];
      XLSX.utils.book_append_sheet(workbook, recipesRefWS, 'Danh sách Recipes');
    }

    // Categories reference
    if (Array.isArray(categories) && categories.length > 0) {
      const categoriesRefData = categories.map(c => ({
        'Category ID': c.id,
        'Tên danh mục': c.category_name,
        'Loại': c.category_type
      }));
      const categoriesRefWS = XLSX.utils.json_to_sheet(categoriesRefData);
      categoriesRefWS['!cols'] = [
        { wch: 12 },
        { wch: 30 },
        { wch: 15 }
      ];
      XLSX.utils.book_append_sheet(workbook, categoriesRefWS, 'Danh sách Categories');
    }

    // Save file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + 'T' + 
                     new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    const outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = path.join(outputDir, `recipe-category-map-structure-${timestamp}.xlsx`);
    XLSX.writeFile(workbook, filename);
    
    console.log(`\n✅ Excel file created: ${filename}`);
    console.log('\n📊 Summary:');
    console.log(`   - Sheet 1: Cấu trúc bảng (Schema)`);
    console.log(`   - Sheet 2: Dữ liệu hiện tại (${Array.isArray(currentData) ? currentData.length : 0} mappings)`);
    console.log(`   - Sheet 3: Template nhập dữ liệu`);
    console.log(`   - Sheet 4: Danh sách Recipes (${Array.isArray(recipes) ? recipes.length : 0} recipes)`);
    console.log(`   - Sheet 5: Danh sách Categories (${Array.isArray(categories) ? categories.length : 0} categories)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

exportRecipeCategoryMapStructure();
