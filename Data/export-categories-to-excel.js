require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');
const XLSX = require('xlsx');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function exportCategories() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // 1. Export recipe_categories
    console.log('📋 Exporting recipe_categories...');
    const [categories] = await sequelize.query(`
      SELECT 
        id,
        category_name,
        category_type,
        description,
        created_at,
        updated_at
      FROM recipe_categories
      ORDER BY category_type, category_name
    `);
    console.log(`✅ Found ${categories.length} categories`);

    // 2. Export recipes with their current categories
    console.log('\n📋 Exporting recipes with categories...');
    const [recipesWithCategories] = await sequelize.query(`
      SELECT 
        r.id as recipe_id,
        r.recipe_name,
        STRING_AGG(rc.id::text, ', ') as category_ids,
        STRING_AGG(rc.category_name, ' | ') as category_names,
        STRING_AGG(rc.category_type::text, ' | ') as category_types
      FROM recipes r
      LEFT JOIN recipe_category_map rcm ON r.id = rcm.recipe_id
      LEFT JOIN recipe_categories rc ON rcm.category_id = rc.id
      WHERE r.status = 'visible'
      GROUP BY r.id, r.recipe_name
      ORDER BY r.id
    `);
    console.log(`✅ Found ${recipesWithCategories.length} recipes`);

    // 3. Export all recipes (for reference)
    console.log('\n📋 Exporting all recipes...');
    const [allRecipes] = await sequelize.query(`
      SELECT 
        id as recipe_id,
        recipe_name,
        description,
        prep_time,
        cook_time,
        servings,
        difficulty,
        status
      FROM recipes
      WHERE status = 'visible'
      ORDER BY id
    `);
    console.log(`✅ Found ${allRecipes.length} recipes`);

    // 4. Create Excel workbook
    console.log('\n📝 Creating Excel file...');
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Categories
    const categoriesWS = XLSX.utils.json_to_sheet(categories.map(c => ({
      'ID': c.id,
      'Tên danh mục': c.category_name,
      'Loại': c.category_type,
      'Mô tả': c.description || '',
      'Ngày tạo': c.created_at ? new Date(c.created_at).toISOString().split('T')[0] : '',
      'Ngày cập nhật': c.updated_at ? new Date(c.updated_at).toISOString().split('T')[0] : ''
    })));
    XLSX.utils.book_append_sheet(workbook, categoriesWS, 'Categories');

    // Sheet 2: Recipe Categories Mapping (current)
    const mappingWS = XLSX.utils.json_to_sheet(recipesWithCategories.map(r => ({
      'Recipe ID': r.recipe_id,
      'Tên món': r.recipe_name,
      'Category IDs (hiện tại)': r.category_ids || '',
      'Category Names (hiện tại)': r.category_names || '',
      'Category Types (hiện tại)': r.category_types || '',
      'Category IDs (mới - để trống nếu không đổi)': '',
      'Ghi chú': ''
    })));
    XLSX.utils.book_append_sheet(workbook, mappingWS, 'Recipe Categories');

    // Sheet 3: All Recipes (reference)
    const recipesWS = XLSX.utils.json_to_sheet(allRecipes.map(r => ({
      'Recipe ID': r.recipe_id,
      'Tên món': r.recipe_name,
      'Mô tả': r.description || '',
      'Thời gian chuẩn bị (phút)': r.prep_time,
      'Thời gian nấu (phút)': r.cook_time,
      'Số khẩu phần': r.servings,
      'Độ khó': r.difficulty,
      'Trạng thái': r.status
    })));
    XLSX.utils.book_append_sheet(workbook, recipesWS, 'All Recipes');

    // Sheet 4: Template for new mappings
    const templateWS = XLSX.utils.json_to_sheet([
      {
        'Recipe ID': '',
        'Tên món': '',
        'Category IDs (phân cách bằng dấu phẩy)': '',
        'Ví dụ: 1,5,21': '1 = Việt Nam, 5 = Món chính, 21 = Healthy'
      }
    ]);
    XLSX.utils.book_append_sheet(workbook, templateWS, 'Template');

    // Save file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + 'T' + 
                     new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    const filename = `output/categories-export-${timestamp}.xlsx`;
    XLSX.writeFile(workbook, filename);
    console.log(`\n✅ Excel file created: ${filename}`);

    // Print summary
    console.log('\n📊 Summary:');
    console.log(`   - Categories: ${categories.length}`);
    console.log(`   - Recipes with categories: ${recipesWithCategories.filter(r => r.category_ids).length}`);
    console.log(`   - Recipes without categories: ${recipesWithCategories.filter(r => !r.category_ids).length}`);
    console.log(`   - Total recipes: ${allRecipes.length}`);

    console.log('\n📝 Instructions:');
    console.log('   1. Mở file Excel vừa tạo');
    console.log('   2. Sheet "Recipe Categories": Sửa cột "Category IDs (mới)"');
    console.log('   3. Nhập các Category IDs phân cách bằng dấu phẩy (VD: 1,5,21)');
    console.log('   4. Để trống nếu không muốn thay đổi');
    console.log('   5. Chạy script import: node Data/import-categories-from-excel.js');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

exportCategories();
