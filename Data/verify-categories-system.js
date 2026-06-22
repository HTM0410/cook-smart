require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function verifySystem() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // 1. Kiểm tra categories
    console.log('📋 Checking categories...');
    const categories = await sequelize.query(`
      SELECT id, category_name, category_type, 
             (SELECT COUNT(*) FROM recipe_category_map WHERE category_id = recipe_categories.id) as recipe_count
      FROM recipe_categories
      ORDER BY category_type, id
    `, { type: sequelize.QueryTypes.SELECT });

    console.log(`✅ Found ${Array.isArray(categories) ? categories.length : 0} categories\n`);

    // Phân loại theo type
    const byType = {
      cuisine: [],
      course: [],
      tag: []
    };

    if (Array.isArray(categories)) {
      categories.forEach(cat => {
        if (byType[cat.category_type]) {
          byType[cat.category_type].push(cat);
        }
      });
    }

    console.log('📊 Categories by type:');
    console.log(`   - Cuisine: ${byType.cuisine.length} categories`);
    console.log(`   - Course: ${byType.course.length} categories`);
    console.log(`   - Tag: ${byType.tag.length} categories\n`);

    // 2. Kiểm tra recipe_category_map
    console.log('📋 Checking recipe_category_map...');
    const mappings = await sequelize.query(`
      SELECT COUNT(*) as total,
             COUNT(DISTINCT recipe_id) as unique_recipes,
             COUNT(DISTINCT category_id) as unique_categories
      FROM recipe_category_map
    `, { type: sequelize.QueryTypes.SELECT });

    if (Array.isArray(mappings) && mappings.length > 0) {
      const stats = mappings[0];
      console.log(`✅ Total mappings: ${stats.total}`);
      console.log(`   - Unique recipes: ${stats.unique_recipes}`);
      console.log(`   - Unique categories: ${stats.unique_categories}\n`);
    }

    // 3. Kiểm tra recipes không có category
    console.log('📋 Checking recipes without categories...');
    const recipesWithoutCategories = await sequelize.query(`
      SELECT r.id, r.recipe_name
      FROM recipes r
      LEFT JOIN recipe_category_map rcm ON r.id = rcm.recipe_id
      WHERE rcm.id IS NULL AND r.status = 'visible'
      ORDER BY r.id
    `, { type: sequelize.QueryTypes.SELECT });

    if (Array.isArray(recipesWithoutCategories) && recipesWithoutCategories.length > 0) {
      console.warn(`⚠️  Found ${recipesWithoutCategories.length} recipes without categories:`);
      recipesWithoutCategories.slice(0, 10).forEach(r => {
        console.warn(`   - ID ${r.id}: ${r.recipe_name}`);
      });
      if (recipesWithoutCategories.length > 10) {
        console.warn(`   ... và ${recipesWithoutCategories.length - 10} recipes khác`);
      }
      console.log('');
    } else {
      console.log('✅ All visible recipes have categories\n');
    }

    // 4. Kiểm tra categories không được sử dụng
    console.log('📋 Checking unused categories...');
    const unusedCategories = await sequelize.query(`
      SELECT rc.id, rc.category_name, rc.category_type
      FROM recipe_categories rc
      LEFT JOIN recipe_category_map rcm ON rc.id = rcm.category_id
      WHERE rcm.id IS NULL
      ORDER BY rc.category_type, rc.id
    `, { type: sequelize.QueryTypes.SELECT });

    if (Array.isArray(unusedCategories) && unusedCategories.length > 0) {
      console.warn(`⚠️  Found ${unusedCategories.length} unused categories:`);
      unusedCategories.slice(0, 10).forEach(c => {
        console.warn(`   - ID ${c.id}: ${c.category_name} (${c.category_type})`);
      });
      if (unusedCategories.length > 10) {
        console.warn(`   ... và ${unusedCategories.length - 10} categories khác`);
      }
      console.log('');
    } else {
      console.log('✅ All categories are being used\n');
    }

    // 5. Kiểm tra duplicate mappings
    console.log('📋 Checking for duplicate mappings...');
    const duplicates = await sequelize.query(`
      SELECT recipe_id, category_id, COUNT(*) as count
      FROM recipe_category_map
      GROUP BY recipe_id, category_id
      HAVING COUNT(*) > 1
    `, { type: sequelize.QueryTypes.SELECT });

    if (Array.isArray(duplicates) && duplicates.length > 0) {
      console.error(`❌ Found ${duplicates.length} duplicate mappings!`);
      duplicates.forEach(d => {
        console.error(`   - Recipe ${d.recipe_id} + Category ${d.category_id}: ${d.count} times`);
      });
      console.log('');
    } else {
      console.log('✅ No duplicate mappings found\n');
    }

    // 6. Kiểm tra invalid foreign keys
    console.log('📋 Checking for invalid foreign keys...');
    const invalidRecipes = await sequelize.query(`
      SELECT DISTINCT rcm.recipe_id
      FROM recipe_category_map rcm
      LEFT JOIN recipes r ON rcm.recipe_id = r.id
      WHERE r.id IS NULL
    `, { type: sequelize.QueryTypes.SELECT });

    const invalidCategories = await sequelize.query(`
      SELECT DISTINCT rcm.category_id
      FROM recipe_category_map rcm
      LEFT JOIN recipe_categories rc ON rcm.category_id = rc.id
      WHERE rc.id IS NULL
    `, { type: sequelize.QueryTypes.SELECT });

    if (Array.isArray(invalidRecipes) && invalidRecipes.length > 0) {
      console.error(`❌ Found ${invalidRecipes.length} mappings with invalid recipe_id!`);
      invalidRecipes.forEach(r => {
        console.error(`   - Recipe ID ${r.recipe_id} does not exist`);
      });
      console.log('');
    }

    if (Array.isArray(invalidCategories) && invalidCategories.length > 0) {
      console.error(`❌ Found ${invalidCategories.length} mappings with invalid category_id!`);
      invalidCategories.forEach(c => {
        console.error(`   - Category ID ${c.category_id} does not exist`);
      });
      console.log('');
    }

    if ((!Array.isArray(invalidRecipes) || invalidRecipes.length === 0) &&
        (!Array.isArray(invalidCategories) || invalidCategories.length === 0)) {
      console.log('✅ All foreign keys are valid\n');
    }

    // 7. Tổng kết
    console.log('📊 System Summary:');
    console.log(`   ✅ Categories: ${Array.isArray(categories) ? categories.length : 0}`);
    console.log(`   ✅ Mappings: ${Array.isArray(mappings) && mappings.length > 0 ? mappings[0].total : 0}`);
    console.log(`   ✅ Recipes with categories: ${Array.isArray(mappings) && mappings.length > 0 ? mappings[0].unique_recipes : 0}`);
    console.log(`   ${Array.isArray(recipesWithoutCategories) && recipesWithoutCategories.length > 0 ? '⚠️' : '✅'} Recipes without categories: ${Array.isArray(recipesWithoutCategories) ? recipesWithoutCategories.length : 0}`);
    console.log(`   ${Array.isArray(unusedCategories) && unusedCategories.length > 0 ? '⚠️' : '✅'} Unused categories: ${Array.isArray(unusedCategories) ? unusedCategories.length : 0}`);
    console.log(`   ${Array.isArray(duplicates) && duplicates.length > 0 ? '❌' : '✅'} Duplicate mappings: ${Array.isArray(duplicates) ? duplicates.length : 0}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

verifySystem();
