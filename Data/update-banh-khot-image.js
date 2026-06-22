require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function updateBanhKhotImage() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    const newImageUrl = 'https://www.huongnghiepaau.com/wp-content/uploads/2016/07/mon-banh-khot.jpg';
    
    // Tìm recipe "bánh khọt" (có thể có nhiều biến thể tên)
    const results = await sequelize.query(
      `SELECT id, recipe_name, image_url 
       FROM recipes 
       WHERE LOWER(recipe_name) LIKE '%bánh khọt%' 
          OR LOWER(recipe_name) LIKE '%banh khot%'
       ORDER BY id`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (!results || results.length === 0) {
      console.log('⚠️  Không tìm thấy recipe "bánh khọt"');
      
      // Thử tìm với các từ khóa khác
      const allResults = await sequelize.query(
        `SELECT id, recipe_name, image_url 
         FROM recipes 
         WHERE LOWER(recipe_name) LIKE '%khọt%' 
            OR LOWER(recipe_name) LIKE '%khot%'
         ORDER BY id
         LIMIT 10`,
        { type: Sequelize.QueryTypes.SELECT }
      );
      
      if (allResults && allResults.length > 0) {
        console.log('\n📋 Tìm thấy các recipe có từ "khọt":');
        allResults.forEach((recipe) => {
          console.log(`  - ID: ${recipe.id}, Tên: ${recipe.recipe_name}, Ảnh: ${recipe.image_url || 'N/A'}`);
        });
      }
      
      await sequelize.close();
      return;
    }

    console.log(`\n📋 Tìm thấy ${results.length} recipe(s):`);
    results.forEach((recipe) => {
      console.log(`  - ID: ${recipe.id}, Tên: ${recipe.recipe_name}`);
      console.log(`    Ảnh cũ: ${recipe.image_url || 'N/A'}`);
    });

    // Update tất cả các recipe tìm thấy
    for (const recipe of results) {
      await sequelize.query(
        `UPDATE recipes 
         SET image_url = $1, updated_at = NOW() 
         WHERE id = $2`,
        {
          bind: [newImageUrl, recipe.id]
        }
      );
      console.log(`✅ Đã cập nhật ảnh cho recipe ID ${recipe.id}: ${recipe.recipe_name}`);
    }

    console.log(`\n✅ Hoàn thành! Đã cập nhật ${results.length} recipe(s) với link ảnh mới:`);
    console.log(`   ${newImageUrl}`);

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

updateBanhKhotImage();
