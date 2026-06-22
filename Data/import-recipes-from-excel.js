#!/usr/bin/env node
/**
 * Import công thức từ file Excel vào Database (Supabase PostgreSQL)
 * 
 * Cách dùng:
 *   node Data/import-recipes-from-excel.js --file Data/input/my-recipes.xlsx
 * 
 * Options:
 *   --file      Đường dẫn file Excel (bắt buộc)
 *   --dry-run   Chỉ kiểm tra dữ liệu, không import thật
 *   --admin-id  ID admin tạo recipes (mặc định: 1)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../src/backend/.env') });

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes, Op } = require('sequelize');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  console.error('❌ Cần cài đặt xlsx: npm install xlsx');
  process.exit(1);
}

// =======================================
// Parse arguments
// =======================================
const args = process.argv.slice(2);
const params = {
  file: '',
  dryRun: false,
  adminId: 1
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--file') {
    params.file = args[++i];
  } else if (arg === '--dry-run') {
    params.dryRun = true;
  } else if (arg === '--admin-id') {
    params.adminId = parseInt(args[++i], 10);
  }
}

if (!params.file) {
  console.error('❌ Thiếu tham số --file');
  console.log('Cách dùng: node Data/import-recipes-from-excel.js --file <path-to-excel>');
  process.exit(1);
}

const filePath = path.resolve(params.file);
if (!fs.existsSync(filePath)) {
  console.error(`❌ File không tồn tại: ${filePath}`);
  process.exit(1);
}

// =======================================
// Database Connection
// =======================================
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

// =======================================
// Define Models (simplified)
// =======================================
const Recipe = sequelize.define('Recipe', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  recipeName: { type: DataTypes.STRING(150), allowNull: false, field: 'recipe_name' },
  description: { type: DataTypes.TEXT, allowNull: true },
  imageUrl: { type: DataTypes.STRING(255), allowNull: true, field: 'image_url' },
  prepTime: { type: DataTypes.INTEGER, allowNull: false, field: 'prep_time' },
  cookTime: { type: DataTypes.INTEGER, allowNull: false, field: 'cook_time' },
  servings: { type: DataTypes.INTEGER, allowNull: false },
  difficulty: { type: DataTypes.ENUM('easy', 'medium', 'hard'), allowNull: false },
  createdBy: { type: DataTypes.INTEGER, allowNull: false, field: 'created_by' },
  status: { type: DataTypes.ENUM('visible', 'hidden'), defaultValue: 'visible' }
}, { tableName: 'recipes', underscored: true });

const Ingredient = sequelize.define('Ingredient', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  ingredientName: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'ingredient_name' },
  categoryId: { type: DataTypes.INTEGER, allowNull: true, field: 'category_id' },
  description: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: 'ingredients', underscored: true });

const IngredientCategory = sequelize.define('IngredientCategory', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  categoryName: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'category_name' }
}, { tableName: 'ingredient_categories', underscored: true });

const RecipeIngredient = sequelize.define('RecipeIngredient', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  recipeId: { type: DataTypes.INTEGER, allowNull: false, field: 'recipe_id' },
  ingredientId: { type: DataTypes.INTEGER, allowNull: false, field: 'ingredient_id' },
  quantity: { type: DataTypes.STRING(50), allowNull: false },
  unit: { type: DataTypes.STRING(20), allowNull: true },
  notes: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: 'recipe_ingredients', underscored: true });

const RecipeStep = sequelize.define('RecipeStep', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  recipeId: { type: DataTypes.INTEGER, allowNull: false, field: 'recipe_id' },
  stepNumber: { type: DataTypes.INTEGER, allowNull: false, field: 'step_number' },
  instruction: { type: DataTypes.TEXT, allowNull: false },
  imageUrl: { type: DataTypes.STRING(255), allowNull: true, field: 'image_url' }
}, { tableName: 'recipe_steps', underscored: true });

const RecipeCategory = sequelize.define('RecipeCategory', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  categoryName: { type: DataTypes.STRING(100), allowNull: false, unique: true, field: 'category_name' }
}, { tableName: 'recipe_categories', underscored: true });

const RecipeCategoryMapping = sequelize.define('RecipeCategoryMapping', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  recipeId: { type: DataTypes.INTEGER, allowNull: false, field: 'recipe_id' },
  categoryId: { type: DataTypes.INTEGER, allowNull: false, field: 'category_id' }
}, { tableName: 'recipe_category_mappings', underscored: true });

// =======================================
// Helper functions
// =======================================
function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  
  const getSheet = (name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet);
  };

  return {
    recipes: getSheet('Recipes'),
    ingredients: getSheet('Ingredients'),
    steps: getSheet('Steps')
  };
}

function validateData(data) {
  const errors = [];
  const recipeIds = new Set();

  // Validate recipes
  for (let i = 0; i < data.recipes.length; i++) {
    const r = data.recipes[i];
    const row = i + 2; // Excel row (header is row 1)

    if (!r.recipe_id) errors.push(`Recipes row ${row}: Thiếu recipe_id`);
    if (!r.recipe_name) errors.push(`Recipes row ${row}: Thiếu recipe_name`);
    if (!r.prep_time && r.prep_time !== 0) errors.push(`Recipes row ${row}: Thiếu prep_time`);
    if (!r.cook_time && r.cook_time !== 0) errors.push(`Recipes row ${row}: Thiếu cook_time`);
    if (!r.servings) errors.push(`Recipes row ${row}: Thiếu servings`);
    if (!['easy', 'medium', 'hard'].includes(r.difficulty)) {
      errors.push(`Recipes row ${row}: difficulty phải là easy/medium/hard`);
    }

    if (recipeIds.has(r.recipe_id)) {
      errors.push(`Recipes row ${row}: recipe_id "${r.recipe_id}" bị trùng`);
    }
    recipeIds.add(r.recipe_id);
  }

  // Validate ingredients
  for (let i = 0; i < data.ingredients.length; i++) {
    const ing = data.ingredients[i];
    const row = i + 2;

    if (!ing.recipe_id) errors.push(`Ingredients row ${row}: Thiếu recipe_id`);
    if (!ing.ingredient_name) errors.push(`Ingredients row ${row}: Thiếu ingredient_name`);
    if (!ing.quantity && ing.quantity !== 0) errors.push(`Ingredients row ${row}: Thiếu quantity`);

    if (ing.recipe_id && !recipeIds.has(ing.recipe_id)) {
      errors.push(`Ingredients row ${row}: recipe_id "${ing.recipe_id}" không tồn tại trong sheet Recipes`);
    }
  }

  // Validate steps
  for (let i = 0; i < data.steps.length; i++) {
    const step = data.steps[i];
    const row = i + 2;

    if (!step.recipe_id) errors.push(`Steps row ${row}: Thiếu recipe_id`);
    if (!step.step_number) errors.push(`Steps row ${row}: Thiếu step_number`);
    if (!step.instruction) errors.push(`Steps row ${row}: Thiếu instruction`);

    if (step.recipe_id && !recipeIds.has(step.recipe_id)) {
      errors.push(`Steps row ${row}: recipe_id "${step.recipe_id}" không tồn tại trong sheet Recipes`);
    }
  }

  return errors;
}

// =======================================
// Main import function
// =======================================
async function importRecipes() {
  console.log('📂 Đọc file Excel:', filePath);
  const data = parseExcel(filePath);

  console.log(`📊 Tìm thấy:`);
  console.log(`   - ${data.recipes.length} công thức`);
  console.log(`   - ${data.ingredients.length} nguyên liệu`);
  console.log(`   - ${data.steps.length} bước thực hiện`);
  console.log('');

  // Validate
  console.log('🔍 Kiểm tra dữ liệu...');
  const errors = validateData(data);
  if (errors.length > 0) {
    console.error('❌ Có lỗi trong dữ liệu:');
    errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }
  console.log('✅ Dữ liệu hợp lệ');
  console.log('');

  if (params.dryRun) {
    console.log('🏃 Chế độ dry-run: Không import thật');
    console.log('   Bỏ cờ --dry-run để import vào database');
    return;
  }

  // Connect to database
  console.log('🔌 Kết nối database...');
  await sequelize.authenticate();
  console.log('✅ Kết nối thành công');
  console.log('');

  const transaction = await sequelize.transaction();

  try {
    // Map recipe_id (temp) -> real database id
    const recipeIdMap = new Map();

    // Import ingredient categories first
    console.log('📁 Import danh mục nguyên liệu...');
    const ingredientCategorySet = new Set();
    data.ingredients.forEach(ing => {
      if (ing.category) ingredientCategorySet.add(ing.category);
    });

    const ingredientCategoryMap = new Map();
    for (const catName of ingredientCategorySet) {
      const [cat] = await IngredientCategory.findOrCreate({
        where: { categoryName: catName },
        defaults: { categoryName: catName },
        transaction
      });
      ingredientCategoryMap.set(catName, cat.id);
    }

    // Import recipe categories
    console.log('📁 Import danh mục công thức...');
    const recipeCategorySet = new Set();
    data.recipes.forEach(r => {
      if (r.categories) {
        r.categories.split(',').map(c => c.trim()).filter(Boolean).forEach(c => recipeCategorySet.add(c));
      }
    });

    const recipeCategoryMap = new Map();
    for (const catName of recipeCategorySet) {
      const [cat] = await RecipeCategory.findOrCreate({
        where: { categoryName: catName },
        defaults: { categoryName: catName },
        transaction
      });
      recipeCategoryMap.set(catName, cat.id);
    }

    // Import ingredients
    console.log('🥕 Import nguyên liệu...');
    const ingredientNameSet = new Set();
    data.ingredients.forEach(ing => ingredientNameSet.add(ing.ingredient_name));

    const ingredientMap = new Map();
    for (const ingName of ingredientNameSet) {
      const ingData = data.ingredients.find(i => i.ingredient_name === ingName);
      const categoryId = ingData?.category ? ingredientCategoryMap.get(ingData.category) : null;

      const [ing] = await Ingredient.findOrCreate({
        where: { ingredientName: ingName },
        defaults: {
          ingredientName: ingName,
          categoryId: categoryId,
          description: null
        },
        transaction
      });
      ingredientMap.set(ingName, ing.id);
    }

    // Import recipes
    console.log('🍲 Import công thức...');
    for (const r of data.recipes) {
      const imageUrl = r.image_url || (r.image_filename ? `/images/recipes/${r.image_filename}` : null);

      const recipe = await Recipe.create({
        recipeName: r.recipe_name,
        description: r.description || null,
        imageUrl: imageUrl,
        prepTime: parseInt(r.prep_time, 10) || 0,
        cookTime: parseInt(r.cook_time, 10) || 0,
        servings: parseInt(r.servings, 10) || 2,
        difficulty: r.difficulty || 'medium',
        createdBy: params.adminId,
        status: r.status || 'visible'
      }, { transaction });

      recipeIdMap.set(r.recipe_id, recipe.id);

      // Map categories
      if (r.categories) {
        const categories = r.categories.split(',').map(c => c.trim()).filter(Boolean);
        for (const catName of categories) {
          const categoryId = recipeCategoryMap.get(catName);
          if (categoryId) {
            await RecipeCategoryMapping.create({
              recipeId: recipe.id,
              categoryId: categoryId
            }, { transaction });
          }
        }
      }

      console.log(`   ✓ ${r.recipe_name}`);
    }

    // Import recipe ingredients
    console.log('🥗 Import nguyên liệu cho công thức...');
    for (const ing of data.ingredients) {
      const recipeId = recipeIdMap.get(ing.recipe_id);
      const ingredientId = ingredientMap.get(ing.ingredient_name);

      if (recipeId && ingredientId) {
        await RecipeIngredient.create({
          recipeId,
          ingredientId,
          quantity: String(ing.quantity),
          unit: ing.unit || null,
          notes: ing.notes || null
        }, { transaction });
      }
    }

    // Import steps
    console.log('📝 Import các bước thực hiện...');
    for (const step of data.steps) {
      const recipeId = recipeIdMap.get(step.recipe_id);
      const imageUrl = step.step_image_filename ? `/images/steps/${step.step_image_filename}` : null;

      if (recipeId) {
        await RecipeStep.create({
          recipeId,
          stepNumber: parseInt(step.step_number, 10),
          instruction: step.instruction,
          imageUrl: imageUrl
        }, { transaction });
      }
    }

    await transaction.commit();

    console.log('');
    console.log('🎉 Import hoàn tất!');
    console.log(`   - ${data.recipes.length} công thức`);
    console.log(`   - ${data.ingredients.length} nguyên liệu`);
    console.log(`   - ${data.steps.length} bước thực hiện`);

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Lỗi import:', error.message);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run
importRecipes().catch(err => {
  console.error(err);
  process.exit(1);
});
