require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function assignCategories() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Lấy một số recipes để test
    const [recipes] = await sequelize.query(`
      SELECT id, recipe_name 
      FROM recipes 
      WHERE status = 'visible'
      ORDER BY id
      LIMIT 10
    `);

    console.log(`📋 Found ${recipes.length} recipes to assign categories\n`);

    // Lấy categories
    const [categories] = await sequelize.query(`
      SELECT id, category_name, category_type 
      FROM recipe_categories
      ORDER BY category_type, category_name
    `);

    const cuisineMap = {};
    const courseMap = {};
    const tagMap = {};

    categories.forEach(c => {
      if (c.category_type === 'cuisine') {
        cuisineMap[c.category_name] = c.id;
      } else if (c.category_type === 'course') {
        courseMap[c.category_name] = c.id;
      } else if (c.category_type === 'tag') {
        tagMap[c.category_name] = c.id;
      }
    });

    // Gán categories cho từng recipe dựa trên tên
    for (const recipe of recipes) {
      const recipeName = recipe.recipe_name.toLowerCase();
      const categoryIds = [];

      // Gán cuisine: mặc định là "Việt Nam" cho các món Việt
      if (recipeName.includes('bún') || recipeName.includes('phở') || 
          recipeName.includes('bánh') || recipeName.includes('canh') ||
          recipeName.includes('gà') || recipeName.includes('cá')) {
        if (cuisineMap['Việt Nam']) {
          categoryIds.push(cuisineMap['Việt Nam']);
        }
      }

      // Gán course dựa trên tên món
      if (recipeName.includes('canh') || recipeName.includes('súp')) {
        if (courseMap['Món canh']) {
          categoryIds.push(courseMap['Món canh']);
        }
      } else if (recipeName.includes('bánh')) {
        if (courseMap['Món chính']) {
          categoryIds.push(courseMap['Món chính']);
        }
      } else {
        if (courseMap['Món chính']) {
          categoryIds.push(courseMap['Món chính']);
        }
      }

      // Gán tags
      if (tagMap['Dễ nấu']) {
        categoryIds.push(tagMap['Dễ nấu']);
      }
      if (tagMap['Healthy']) {
        categoryIds.push(tagMap['Healthy']);
      }

      // Insert vào recipe_category_map
      if (categoryIds.length > 0) {
        for (const categoryId of categoryIds) {
          try {
            await sequelize.query(`
              INSERT INTO recipe_category_map (recipe_id, category_id, created_at, updated_at)
              VALUES ($1, $2, NOW(), NOW())
              ON CONFLICT (recipe_id, category_id) DO NOTHING
            `, {
              bind: [recipe.id, categoryId]
            });
          } catch (err) {
            // Ignore duplicate errors
          }
        }
        console.log(`✅ Assigned ${categoryIds.length} categories to: ${recipe.recipe_name}`);
      }
    }

    // Kiểm tra kết quả
    const [result] = await sequelize.query(`
      SELECT COUNT(*) as total
      FROM recipe_category_map
    `);
    console.log(`\n✅ Total category mappings: ${result[0].total}`);

    // Hiển thị một số recipes với categories
    const [recipesWithCats] = await sequelize.query(`
      SELECT r.id, r.recipe_name, 
             STRING_AGG(rc.category_name, ', ' ORDER BY rc.category_type, rc.category_name) as categories
      FROM recipes r
      INNER JOIN recipe_category_map rcm ON r.id = rcm.recipe_id
      INNER JOIN recipe_categories rc ON rcm.category_id = rc.id
      GROUP BY r.id, r.recipe_name
      LIMIT 5
    `);

    console.log('\n📋 Sample recipes with categories:');
    recipesWithCats.forEach(r => {
      console.log(`   - ${r.recipe_name}: ${r.categories}`);
    });

    console.log('\n✅ Categories assignment completed!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

assignCategories();
