require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

// Dữ liệu categories 21-35 (tags)
const categories = [
  { id: 21, category_name: 'Tốt cho sức khỏe', category_type: 'tag' },
  { id: 22, category_name: 'Ít tinh bột', category_type: 'tag' },
  { id: 23, category_name: 'Ăn kiêng', category_type: 'tag' },
  { id: 24, category_name: 'Dễ nấu', category_type: 'tag' },
  { id: 25, category_name: 'Nhanh', category_type: 'tag' },
  { id: 26, category_name: 'Chay', category_type: 'tag' },
  { id: 27, category_name: 'Thuần chay', category_type: 'tag' },
  { id: 28, category_name: 'Không gluten', category_type: 'tag' },
  { id: 29, category_name: 'Giàu đạm', category_type: 'tag' },
  { id: 30, category_name: 'Ít calo', category_type: 'tag' },
  { id: 31, category_name: 'Cay', category_type: 'tag' },
  { id: 32, category_name: 'Ngọt', category_type: 'tag' },
  { id: 33, category_name: 'Mặn', category_type: 'tag' },
  { id: 34, category_name: 'Món ăn quen thuộc', category_type: 'tag' },
  { id: 35, category_name: 'Món ăn cao cấp', category_type: 'tag' },
];

async function updateCategories() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    console.log(`📋 Updating ${categories.length} categories (21-35)...\n`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    const transaction = await sequelize.transaction();

    try {
      for (const category of categories) {
        try {
          // Kiểm tra category đã tồn tại chưa
          const existing = await sequelize.query(`
            SELECT id, category_name, category_type 
            FROM recipe_categories 
            WHERE id = :id
          `, {
            replacements: { id: category.id },
            type: sequelize.QueryTypes.SELECT,
            transaction
          });

          const exists = Array.isArray(existing) && existing.length > 0;

          if (exists) {
            const oldData = existing[0];
            console.log(`   📝 Updating ID ${category.id}: "${oldData.category_name}" → "${category.category_name}"`);
            
            await sequelize.query(`
              UPDATE recipe_categories 
              SET category_name = :category_name,
                  category_type = :category_type,
                  updated_at = NOW()
              WHERE id = :id
            `, {
              replacements: {
                id: category.id,
                category_name: category.category_name,
                category_type: category.category_type
              },
              type: sequelize.QueryTypes.UPDATE,
              transaction
            });
          } else {
            console.log(`   ➕ Inserting new category ID ${category.id}: "${category.category_name}"`);
            
            await sequelize.query(`
              INSERT INTO recipe_categories (id, category_name, category_type, created_at, updated_at)
              VALUES (:id, :category_name, :category_type, NOW(), NOW())
            `, {
              replacements: {
                id: category.id,
                category_name: category.category_name,
                category_type: category.category_type
              },
              type: sequelize.QueryTypes.INSERT,
              transaction
            });
          }
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            id: category.id,
            category_name: category.category_name,
            error: error.message
          });
          console.error(`   ❌ Error updating ID ${category.id}: ${error.message}`);
        }
      }

      await transaction.commit();
      console.log(`\n✅ Update completed!\n`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // Báo cáo kết quả
    console.log('📊 Update Summary:');
    console.log(`   ✅ Success: ${successCount} categories`);
    console.log(`   ❌ Errors: ${errorCount} categories`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(err => {
        console.log(`   - ID ${err.id} (${err.category_name}): ${err.error}`);
      });
    }

    // Hiển thị kết quả sau khi update
    console.log('\n📋 Updated categories:');
    const result = await sequelize.query(`
      SELECT id, category_name, category_type 
      FROM recipe_categories 
      WHERE id BETWEEN 21 AND 35
      ORDER BY id
    `, { type: sequelize.QueryTypes.SELECT });

    if (Array.isArray(result) && result.length > 0) {
      result.forEach(cat => {
        console.log(`   ${cat.id.toString().padStart(2, ' ')}. ${cat.category_name} (${cat.category_type})`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

updateCategories();
