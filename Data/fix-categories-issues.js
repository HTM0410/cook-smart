require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function fixCategoriesIssues() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // 1. Kiểm tra và sửa categories bị lỗi encoding
    console.log('🔍 Checking for encoding issues...');
    const allCategories = await sequelize.query(`
      SELECT id, category_name, category_type
      FROM recipe_categories
      ORDER BY id
    `, { type: sequelize.QueryTypes.SELECT });

    const encodingFixes = {
      // Cuisine fixes
      1: { name: 'Việt Nam', type: 'cuisine' },
      2: { name: 'Châu Âu', type: 'cuisine' },
      3: { name: 'Nhật Bản', type: 'cuisine' },
      4: { name: 'Hàn Quốc', type: 'cuisine' },
      5: { name: 'Trung Quốc', type: 'cuisine' },
      6: { name: 'Thái Lan', type: 'cuisine' },
      7: { name: 'Mỹ', type: 'cuisine' },
      8: { name: 'Mexico', type: 'cuisine' },
      9: { name: 'Ấn Độ', type: 'cuisine' },
      10: { name: 'Địa Trung Hải', type: 'cuisine' },
      // Course fixes
      11: { name: 'Món chính', type: 'course' },
      12: { name: 'Món phụ', type: 'course' },
      13: { name: 'Khai vị', type: 'course' },
      14: { name: 'Tráng miệng', type: 'course' },
      15: { name: 'Món canh', type: 'course' },
      16: { name: 'Món nướng', type: 'course' },
      17: { name: 'Món chiên', type: 'course' },
      18: { name: 'Món hấp', type: 'course' },
      19: { name: 'Món xào', type: 'course' },
      20: { name: 'Món luộc', type: 'course' },
    };

    console.log(`📋 Found ${Array.isArray(allCategories) ? allCategories.length : 0} categories\n`);

    // 2. Sửa các categories bị lỗi
    console.log('🔧 Fixing encoding issues...');
    let fixedCount = 0;
    const transaction = await sequelize.transaction();

    try {
      for (const [id, fix] of Object.entries(encodingFixes)) {
        const categoryId = parseInt(id);
        const existing = Array.isArray(allCategories) 
          ? allCategories.find(c => c.id === categoryId)
          : null;

        if (existing && existing.category_name !== fix.name) {
          console.log(`   📝 Fixing ID ${categoryId}: "${existing.category_name}" → "${fix.name}"`);
          
          await sequelize.query(`
            UPDATE recipe_categories 
            SET category_name = :name,
                category_type = :type,
                updated_at = NOW()
            WHERE id = :id
          `, {
            replacements: {
              id: categoryId,
              name: fix.name,
              type: fix.type
            },
            type: sequelize.QueryTypes.UPDATE,
            transaction
          });
          fixedCount++;
        }
      }

      await transaction.commit();
      console.log(`✅ Fixed ${fixedCount} categories\n`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // 3. Kiểm tra recipe counts
    console.log('📊 Checking recipe counts...');
    const categoriesWithCounts = await sequelize.query(`
      SELECT 
        rc.id,
        rc.category_name,
        rc.category_type,
        COUNT(DISTINCT rcm.recipe_id) as recipe_count
      FROM recipe_categories rc
      LEFT JOIN recipe_category_map rcm ON rc.id = rcm.category_id
      LEFT JOIN recipes r ON rcm.recipe_id = r.id AND r.status = 'visible'
      GROUP BY rc.id, rc.category_name, rc.category_type
      ORDER BY rc.category_type, rc.id
    `, { type: sequelize.QueryTypes.SELECT });

    console.log(`📋 Categories with recipe counts:\n`);
    
    if (Array.isArray(categoriesWithCounts)) {
      const byType = {
        cuisine: [],
        course: [],
        tag: []
      };

      categoriesWithCounts.forEach(cat => {
        if (byType[cat.category_type]) {
          byType[cat.category_type].push(cat);
        }
      });

      console.log('🍜 CUISINE:');
      byType.cuisine.forEach(cat => {
        console.log(`   ${cat.id.toString().padStart(2, ' ')}. ${cat.category_name.padEnd(20)} - ${cat.recipe_count} recipes`);
      });

      console.log('\n🍽️  COURSE:');
      byType.course.forEach(cat => {
        console.log(`   ${cat.id.toString().padStart(2, ' ')}. ${cat.category_name.padEnd(20)} - ${cat.recipe_count} recipes`);
      });

      console.log('\n🏷️  TAG:');
      byType.tag.forEach(cat => {
        console.log(`   ${cat.id.toString().padStart(2, ' ')}. ${cat.category_name.padEnd(20)} - ${cat.recipe_count} recipes`);
      });

      const totalWithRecipes = categoriesWithCounts.filter(c => c.recipe_count > 0).length;
      const totalRecipes = categoriesWithCounts.reduce((sum, c) => sum + parseInt(c.recipe_count || 0), 0);
      
      console.log(`\n📈 Summary:`);
      console.log(`   - Categories with recipes: ${totalWithRecipes}/${categoriesWithCounts.length}`);
      console.log(`   - Total recipe mappings: ${totalRecipes}`);
    }

    // 4. Kiểm tra categories không đúng loại
    console.log('\n🔍 Checking for incorrect category types...');
    const incorrectTypes = await sequelize.query(`
      SELECT id, category_name, category_type
      FROM recipe_categories
      WHERE category_type NOT IN ('cuisine', 'course', 'tag')
    `, { type: sequelize.QueryTypes.SELECT });

    if (Array.isArray(incorrectTypes) && incorrectTypes.length > 0) {
      console.warn(`⚠️  Found ${incorrectTypes.length} categories with incorrect types:`);
      incorrectTypes.forEach(cat => {
        console.warn(`   - ID ${cat.id}: ${cat.category_name} (${cat.category_type})`);
      });
    } else {
      console.log('✅ All categories have correct types');
    }

    console.log('\n✅ System check completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixCategoriesIssues();
