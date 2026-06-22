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

async function exportRecipesOnly() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    const workbook = XLSX.utils.book_new();

    // 1. Export Recipes
    console.log('📋 Exporting recipes...');
    const [recipes] = await sequelize.query(`
      SELECT 
        id,
        recipe_name,
        description,
        image_url,
        prep_time,
        cook_time,
        servings,
        difficulty,
        status,
        created_at,
        updated_at
      FROM recipes
      ORDER BY id
    `);
    console.log(`✅ Found ${recipes.length} recipes`);

    const recipesWS = XLSX.utils.json_to_sheet(recipes.map(r => ({
      'ID': r.id,
      'Tên món': r.recipe_name,
      'Mô tả': r.description || '',
      'Link ảnh': r.image_url || '',
      'Thời gian chuẩn bị (phút)': r.prep_time,
      'Thời gian nấu (phút)': r.cook_time,
      'Số khẩu phần': r.servings,
      'Độ khó': r.difficulty,
      'Trạng thái': r.status,
      'Ngày tạo': r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
      'Ngày cập nhật': r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : ''
    })));
    XLSX.utils.book_append_sheet(workbook, recipesWS, 'Recipes');

    // 2. Export Recipe Steps
    console.log('📋 Exporting recipe steps...');
    const [steps] = await sequelize.query(`
      SELECT 
        id,
        recipe_id,
        step_number,
        instruction,
        image_url
      FROM recipe_steps
      ORDER BY recipe_id, step_number
    `);
    console.log(`✅ Found ${steps.length} steps`);

    const stepsWS = XLSX.utils.json_to_sheet(steps.map(s => ({
      'ID': s.id,
      'Recipe ID': s.recipe_id,
      'Số bước': s.step_number,
      'Hướng dẫn': s.instruction || '',
      'Link ảnh': s.image_url || ''
    })));
    XLSX.utils.book_append_sheet(workbook, stepsWS, 'Recipe_Steps');

    // 3. Export Ingredients
    console.log('📋 Exporting ingredients...');
    const [ingredients] = await sequelize.query(`
      SELECT 
        i.id,
        i.ingredient_name,
        i.category_id,
        ic.category_name as category_name,
        i.description
      FROM ingredients i
      LEFT JOIN ingredient_categories ic ON i.category_id = ic.id
      ORDER BY i.id
    `);
    console.log(`✅ Found ${ingredients.length} ingredients`);

    const ingredientsWS = XLSX.utils.json_to_sheet(ingredients.map(i => ({
      'ID': i.id,
      'Tên nguyên liệu': i.ingredient_name,
      'Category ID': i.category_id,
      'Tên danh mục': i.category_name || '',
      'Mô tả': i.description || ''
    })));
    XLSX.utils.book_append_sheet(workbook, ingredientsWS, 'Ingredients');

    // 4. Export Ingredient Categories
    console.log('📋 Exporting ingredient categories...');
    const [ingredientCategories] = await sequelize.query(`
      SELECT 
        id,
        category_name,
        description
      FROM ingredient_categories
      ORDER BY id
    `);
    console.log(`✅ Found ${ingredientCategories.length} ingredient categories`);

    const ingCatWS = XLSX.utils.json_to_sheet(ingredientCategories.map(ic => ({
      'ID': ic.id,
      'Tên danh mục': ic.category_name,
      'Mô tả': ic.description || ''
    })));
    XLSX.utils.book_append_sheet(workbook, ingCatWS, 'Ingredient_Categories');

    // 5. Export Recipe Ingredients (mapping)
    console.log('📋 Exporting recipe ingredients...');
    const [recipeIngredients] = await sequelize.query(`
      SELECT 
        ri.id,
        ri.recipe_id,
        ri.ingredient_id,
        i.ingredient_name,
        ri.quantity,
        ri.unit
      FROM recipe_ingredients ri
      INNER JOIN ingredients i ON ri.ingredient_id = i.id
      ORDER BY ri.recipe_id, ri.id
    `);
    console.log(`✅ Found ${recipeIngredients.length} recipe ingredients`);

    const recipeIngWS = XLSX.utils.json_to_sheet(recipeIngredients.map(ri => ({
      'ID': ri.id,
      'Recipe ID': ri.recipe_id,
      'Ingredient ID': ri.ingredient_id,
      'Tên nguyên liệu': ri.ingredient_name,
      'Số lượng': ri.quantity,
      'Đơn vị': ri.unit || ''
    })));
    XLSX.utils.book_append_sheet(workbook, recipeIngWS, 'Recipe_Ingredients');

    // 6. Export Recipe Categories
    console.log('📋 Exporting recipe categories...');
    const [recipeCategories] = await sequelize.query(`
      SELECT 
        id,
        category_name,
        category_type,
        description
      FROM recipe_categories
      ORDER BY category_type, category_name
    `);
    console.log(`✅ Found ${recipeCategories.length} recipe categories`);

    const recipeCatWS = XLSX.utils.json_to_sheet(recipeCategories.map(rc => ({
      'ID': rc.id,
      'Tên danh mục': rc.category_name,
      'Loại': rc.category_type,
      'Mô tả': rc.description || ''
    })));
    XLSX.utils.book_append_sheet(workbook, recipeCatWS, 'Recipe_Categories');

    // 7. Export Recipe Category Mappings
    console.log('📋 Exporting recipe category mappings...');
    const [categoryMaps] = await sequelize.query(`
      SELECT 
        rcm.id,
        rcm.recipe_id,
        rcm.category_id,
        rc.category_name,
        rc.category_type
      FROM recipe_category_map rcm
      INNER JOIN recipe_categories rc ON rcm.category_id = rc.id
      ORDER BY rcm.recipe_id, rcm.category_id
    `);
    console.log(`✅ Found ${categoryMaps.length} category mappings`);

    const catMapWS = XLSX.utils.json_to_sheet(categoryMaps.map(cm => ({
      'ID': cm.id,
      'Recipe ID': cm.recipe_id,
      'Category ID': cm.category_id,
      'Tên danh mục': cm.category_name,
      'Loại': cm.category_type
    })));
    XLSX.utils.book_append_sheet(workbook, catMapWS, 'Recipe_Category_Map');

    // 8. Export Pending Ingredients (nếu cần)
    console.log('📋 Exporting pending ingredients...');
    const [pendingIngredients] = await sequelize.query(`
      SELECT 
        id,
        ingredient_name,
        category_id,
        description,
        status,
        reviewed_at,
        created_at
      FROM pending_ingredients
      ORDER BY id
    `);
    console.log(`✅ Found ${pendingIngredients.length} pending ingredients`);

    const pendingWS = XLSX.utils.json_to_sheet(pendingIngredients.map(pi => ({
      'ID': pi.id,
      'Tên nguyên liệu': pi.ingredient_name,
      'Category ID': pi.category_id,
      'Mô tả': pi.description || '',
      'Trạng thái': pi.status,
      'Ngày review': pi.reviewed_at ? new Date(pi.reviewed_at).toISOString().split('T')[0] : '',
      'Ngày tạo': pi.created_at ? new Date(pi.created_at).toISOString().split('T')[0] : ''
    })));
    XLSX.utils.book_append_sheet(workbook, pendingWS, 'Pending_Ingredients');

    // Save file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + 'T' + 
                     new Date().toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
    const outputDir = path.join(__dirname, 'output');
    fs.mkdirSync(outputDir, { recursive: true });
    const filename = path.join(outputDir, `recipes-data-${timestamp}.xlsx`);
    XLSX.writeFile(workbook, filename);
    
    console.log(`\n✅ Excel file created: ${filename}`);
    console.log('\n📊 Summary:');
    console.log(`   - Recipes: ${recipes.length}`);
    console.log(`   - Recipe Steps: ${steps.length}`);
    console.log(`   - Ingredients: ${ingredients.length}`);
    console.log(`   - Ingredient Categories: ${ingredientCategories.length}`);
    console.log(`   - Recipe Ingredients: ${recipeIngredients.length}`);
    console.log(`   - Recipe Categories: ${recipeCategories.length}`);
    console.log(`   - Category Mappings: ${categoryMaps.length}`);
    console.log(`   - Pending Ingredients: ${pendingIngredients.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

exportRecipesOnly();
