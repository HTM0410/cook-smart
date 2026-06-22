require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length < 2) {
    throw new Error('CSV file phải có ít nhất 1 dòng header và 1 dòng dữ liệu');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim());
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length !== headers.length) {
      console.warn(`⚠️  Row ${i + 1} có số cột không khớp, bỏ qua`);
      continue;
    }
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    data.push(row);
  }

  return { headers, data };
}

async function importFromCSV(csvFilePath) {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Kiểm tra file tồn tại
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ File không tồn tại: ${csvFilePath}`);
      process.exit(1);
    }

    console.log(`📂 Reading CSV file: ${csvFilePath}\n`);

    // Parse CSV
    const { headers, data } = parseCSV(csvFilePath);
    console.log(`📋 Found ${data.length} rows in CSV file`);
    console.log(`📋 Headers: ${headers.join(', ')}\n`);

    if (data.length === 0) {
      console.error('❌ CSV file không có dữ liệu!');
      process.exit(1);
    }

    // Validate và parse dữ liệu
    console.log('🔍 Validating data...');
    const mappings = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      // Tìm các cột có thể có
      const id = row.ID || row.id || row['ID'] || row['id'];
      const recipeId = row['Recipe ID'] || row['recipe_id'] || row['Recipe ID'] || row['recipe_id'] || row['RecipeID'];
      const categoryId = row['Category ID'] || row['category_id'] || row['Category ID'] || row['category_id'] || row['CategoryID'];

      if (!id || !recipeId || !categoryId) {
        errors.push({
          row: i + 2, // +2 vì có header và index bắt đầu từ 0
          data: row,
          error: 'Thiếu ID, Recipe ID hoặc Category ID'
        });
        continue;
      }

      const parsedId = parseInt(id);
      const parsedRecipeId = parseInt(recipeId);
      const parsedCategoryId = parseInt(categoryId);

      if (isNaN(parsedId) || isNaN(parsedRecipeId) || isNaN(parsedCategoryId)) {
        errors.push({
          row: i + 2,
          data: row,
          error: 'ID, Recipe ID hoặc Category ID không phải là số hợp lệ'
        });
        continue;
      }

      mappings.push({
        id: parsedId,
        recipe_id: parsedRecipeId,
        category_id: parsedCategoryId
      });
    }

    if (errors.length > 0) {
      console.warn(`⚠️  Found ${errors.length} invalid rows:`);
      errors.slice(0, 10).forEach(err => {
        console.warn(`   - Row ${err.row}: ${err.error}`);
      });
      if (errors.length > 10) {
        console.warn(`   ... và ${errors.length - 10} lỗi khác`);
      }
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

// Lấy file path từ command line argument
const csvFilePath = process.argv[2];

if (!csvFilePath) {
  console.error('❌ Vui lòng cung cấp đường dẫn file CSV!');
  console.log('💡 Usage: node import-recipe-category-map-from-csv.js <path-to-csv-file>');
  process.exit(1);
}

importFromCSV(csvFilePath);
