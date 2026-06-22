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

async function importFromExcel() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Tìm file Excel mới nhất trong thư mục output
    const outputDir = path.join(__dirname, 'output');
    const files = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('recipe-category-map-export-') && f.endsWith('.xlsx'))
      .map(f => ({
        name: f,
        path: path.join(outputDir, f),
        time: fs.statSync(path.join(outputDir, f)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      console.error('❌ Không tìm thấy file Excel export!');
      console.log('💡 Hãy chạy script export-recipe-category-map.js trước');
      process.exit(1);
    }

    const excelFile = files[0];
    console.log(`📂 Reading file: ${excelFile.name}\n`);

    // Đọc file Excel
    const workbook = XLSX.readFile(excelFile.path);
    
    // Đọc sheet "Dữ liệu đơn giản (CSV)" hoặc sheet đầu tiên
    let sheetName = 'Dữ liệu đơn giản (CSV)';
    if (!workbook.SheetNames.includes(sheetName)) {
      sheetName = workbook.SheetNames[0];
      console.log(`⚠️  Sheet "${sheetName}" không tồn tại, sử dụng sheet đầu tiên: "${sheetName}"`);
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📋 Found ${data.length} rows in Excel file\n`);

    if (data.length === 0) {
      console.error('❌ File Excel không có dữ liệu!');
      process.exit(1);
    }

    // Validate và parse dữ liệu
    console.log('🔍 Validating data...');
    const mappings = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const id = row.id || row.ID || row['id'];
      const recipeId = row.recipe_id || row['Recipe ID'] || row['recipe_id'];
      const categoryId = row.category_id || row['Category ID'] || row['category_id'];

      if (!id || !recipeId || !categoryId) {
        errors.push({
          row: i + 2, // +2 vì có header và index bắt đầu từ 0
          data: row,
          error: 'Thiếu id, recipe_id hoặc category_id'
        });
        continue;
      }

      mappings.push({
        id: parseInt(id),
        recipe_id: parseInt(recipeId),
        category_id: parseInt(categoryId)
      });
    }

    if (errors.length > 0) {
      console.warn(`⚠️  Found ${errors.length} invalid rows:`);
      errors.forEach(err => {
        console.warn(`   - Row ${err.row}: ${err.error}`);
      });
      console.log('');
    }

    console.log(`✅ Valid mappings: ${mappings.length} / ${data.length}\n`);

    if (mappings.length === 0) {
      console.error('❌ Không có dữ liệu hợp lệ để import!');
      process.exit(1);
    }

    // Validate với database
    console.log('🔍 Validating with database...');
    const recipeIds = [...new Set(mappings.map(m => m.recipe_id))];
    const categoryIds = [...new Set(mappings.map(m => m.category_id))];

    const recipes = await sequelize.query(`
      SELECT id FROM recipes WHERE id IN (${recipeIds.join(',')})
    `, { type: sequelize.QueryTypes.SELECT });

    const categories = await sequelize.query(`
      SELECT id FROM recipe_categories WHERE id IN (${categoryIds.join(',')})
    `, { type: sequelize.QueryTypes.SELECT });

    const existingRecipeIds = Array.isArray(recipes) ? recipes.map(r => r.id) : [];
    const existingCategoryIds = Array.isArray(categories) ? categories.map(c => c.id) : [];

    const missingRecipeIds = recipeIds.filter(id => !existingRecipeIds.includes(id));
    const missingCategoryIds = categoryIds.filter(id => !existingCategoryIds.includes(id));

    if (missingRecipeIds.length > 0) {
      console.warn(`⚠️  Warning: ${missingRecipeIds.length} recipe IDs không tồn tại: ${missingRecipeIds.join(', ')}`);
    }

    if (missingCategoryIds.length > 0) {
      console.warn(`⚠️  Warning: ${missingCategoryIds.length} category IDs không tồn tại: ${missingCategoryIds.join(', ')}`);
    }

    // Lọc dữ liệu hợp lệ
    const validMappings = mappings.filter(m => 
      existingRecipeIds.includes(m.recipe_id) && 
      existingCategoryIds.includes(m.category_id)
    );

    console.log(`✅ Valid mappings with database: ${validMappings.length} / ${mappings.length}\n`);

    if (validMappings.length === 0) {
      console.error('❌ Không có dữ liệu hợp lệ với database!');
      process.exit(1);
    }

    // Xóa dữ liệu cũ
    console.log('🗑️  Deleting old data...');
    await sequelize.query(`DELETE FROM recipe_category_map`, {
      type: sequelize.QueryTypes.DELETE
    });
    console.log('✅ Old data deleted\n');

    // Import dữ liệu mới
    console.log('📥 Importing new data...');
    let successCount = 0;
    let errorCount = 0;
    const importErrors = [];

    const transaction = await sequelize.transaction();

    try {
      for (const item of validMappings) {
        try {
          await sequelize.query(`
            INSERT INTO recipe_category_map (id, recipe_id, category_id, created_at, updated_at)
            VALUES (:id, :recipe_id, :category_id, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              recipe_id = EXCLUDED.recipe_id,
              category_id = EXCLUDED.category_id,
              updated_at = NOW()
          `, {
            replacements: {
              id: item.id,
              recipe_id: item.recipe_id,
              category_id: item.category_id
            },
            type: sequelize.QueryTypes.INSERT,
            transaction
          });
          successCount++;
        } catch (error) {
          errorCount++;
          importErrors.push({
            id: item.id,
            recipe_id: item.recipe_id,
            category_id: item.category_id,
            error: error.message
          });
        }
      }

      await transaction.commit();
      console.log(`✅ Import completed!\n`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // Báo cáo kết quả
    console.log('📊 Import Summary:');
    console.log(`   ✅ Success: ${successCount} mappings`);
    console.log(`   ❌ Errors: ${errorCount} mappings`);
    
    if (importErrors.length > 0) {
      console.log('\n❌ Import errors:');
      importErrors.slice(0, 10).forEach(err => {
        console.log(`   - ID ${err.id}: Recipe ${err.recipe_id} + Category ${err.category_id} - ${err.error}`);
      });
      if (importErrors.length > 10) {
        console.log(`   ... và ${importErrors.length - 10} lỗi khác`);
      }
    }

    // Kiểm tra kết quả
    const result = await sequelize.query(`
      SELECT COUNT(*) as count FROM recipe_category_map
    `, { type: sequelize.QueryTypes.SELECT });

    const count = Array.isArray(result) && result.length > 0 ? result[0].count : 0;
    console.log(`\n📈 Total mappings in database: ${count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Cho phép chỉ định file cụ thể từ command line
const args = process.argv.slice(2);
if (args.length > 0) {
  const filePath = args[0];
  if (fs.existsSync(filePath)) {
    // Override file path
    const originalReadFile = XLSX.readFile;
    XLSX.readFile = function(path) {
      if (path.includes('recipe-category-map-export-')) {
        return originalReadFile(filePath);
      }
      return originalReadFile(path);
    };
  }
}

importFromExcel();
