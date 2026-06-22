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

async function importCategories() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Tìm file Excel mới nhất trong thư mục output
    const outputDir = path.join(__dirname, 'output');
    if (!fs.existsSync(outputDir)) {
      console.error('❌ Output directory not found!');
      return;
    }

    const files = fs.readdirSync(outputDir)
      .filter(f => f.startsWith('categories-export-') && f.endsWith('.xlsx'))
      .map(f => ({
        name: f,
        path: path.join(outputDir, f),
        time: fs.statSync(path.join(outputDir, f)).mtime
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length === 0) {
      console.error('❌ No categories export file found!');
      console.log('   Please run: node Data/export-categories-to-excel.js first');
      return;
    }

    const latestFile = files[0];
    console.log(`📂 Reading file: ${latestFile.name}\n`);

    // Đọc file Excel
    const workbook = XLSX.readFile(latestFile.path);
    const sheetName = 'Recipe Categories';
    
    if (!workbook.SheetNames.includes(sheetName)) {
      console.error(`❌ Sheet "${sheetName}" not found!`);
      return;
    }

    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`📋 Found ${data.length} rows to process\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    // Bắt đầu transaction
    await sequelize.transaction(async (t) => {
      for (const row of data) {
        const recipeId = row['Recipe ID'];
        const newCategoryIds = row['Category IDs (mới - để trống nếu không đổi)'];

        // Bỏ qua nếu không có recipe ID hoặc không có category IDs mới
        if (!recipeId || !newCategoryIds || newCategoryIds.toString().trim() === '') {
          skipped++;
          continue;
        }

        try {
          // Parse category IDs (phân cách bằng dấu phẩy)
          const categoryIds = newCategoryIds.toString()
            .split(',')
            .map(id => parseInt(id.trim()))
            .filter(id => !isNaN(id) && id > 0);

          if (categoryIds.length === 0) {
            console.log(`⚠️  Recipe ID ${recipeId}: No valid category IDs`);
            skipped++;
            continue;
          }

          // Xóa tất cả categories cũ của recipe
          await sequelize.query(
            `DELETE FROM recipe_category_map WHERE recipe_id = $1`,
            { bind: [recipeId], transaction: t }
          );

          // Thêm categories mới
          for (const categoryId of categoryIds) {
            // Kiểm tra category có tồn tại không
            const [categoryCheck] = await sequelize.query(
              `SELECT id FROM recipe_categories WHERE id = $1`,
              { bind: [categoryId], transaction: t }
            );

            if (categoryCheck.length === 0) {
              console.log(`⚠️  Category ID ${categoryId} not found, skipping...`);
              continue;
            }

            // Insert mapping
            await sequelize.query(
              `INSERT INTO recipe_category_map (recipe_id, category_id, created_at, updated_at)
               VALUES ($1, $2, NOW(), NOW())
               ON CONFLICT (recipe_id, category_id) DO NOTHING`,
              { bind: [recipeId, categoryId], transaction: t }
            );
          }

          // Lấy tên recipe để log
          const [recipeName] = await sequelize.query(
            `SELECT recipe_name FROM recipes WHERE id = $1`,
            { bind: [recipeId], transaction: t }
          );

          const name = recipeName[0]?.recipe_name || `ID ${recipeId}`;
          console.log(`✅ Updated: ${name} (ID: ${recipeId}) -> Categories: ${categoryIds.join(', ')}`);
          updated++;

        } catch (err) {
          console.error(`❌ Error processing Recipe ID ${recipeId}:`, err.message);
          errors++;
        }
      }
    });

    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log('\n✅ Import completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

// Cho phép truyền file path từ command line
const args = process.argv.slice(2);
if (args.length > 0) {
  const filePath = args[0];
  console.log(`📂 Using file: ${filePath}`);
  // Có thể thêm logic để đọc file cụ thể ở đây
}

importCategories();
