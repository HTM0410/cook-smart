const path = require('path');
const envPath = path.join(__dirname, '../src/backend/.env');
require('dotenv').config({ path: envPath });
console.log('📄 Loading .env from:', envPath);

const { Sequelize } = require('sequelize');

// Kiểm tra biến môi trường
if (!process.env.SUPABASE_DB_URL) {
  console.error('❌ SUPABASE_DB_URL không được tìm thấy trong .env file!');
  console.error('   Vui lòng kiểm tra file:', envPath);
  process.exit(1);
}

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

// Mẫu comment 1 sao
const oneStarComments = [
  'Món ăn không ngon, không nên thử lại.',
  'Rất thất vọng với công thức này.',
  'Món ăn không đạt yêu cầu.',
  'Không hài lòng với kết quả.',
  'Công thức cần được xem xét lại.',
  'Món ăn không ngon, không khuyến khích.',
  'Rất không hài lòng.',
  'Món ăn không đạt chất lượng.',
  'Thất vọng với công thức này.',
  'Không nên thử lại.',
  'Món ăn quá tệ, không như mong đợi.',
  'Công thức không đúng, kết quả rất tệ.',
  'Không ngon, hương vị không phù hợp.',
  'Rất thất vọng, sẽ không làm lại.',
  'Món ăn không đạt tiêu chuẩn.',
  'Không hài lòng chút nào.',
  'Công thức cần cải thiện nhiều.',
  'Món ăn tệ, không đáng thử.',
  'Rất không ngon, thất vọng hoàn toàn.',
  'Không khuyến khích ai thử món này.'
];

async function addReviewsForRecipe() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Lấy thông tin từ command line arguments
    const recipeName = process.argv[2] || 'Bánh đa cua Hải Phòng';
    const rating = parseInt(process.argv[3]) || 1;
    const count = parseInt(process.argv[4]) || 100;

    console.log(`📋 Thông tin:`);
    console.log(`   - Tên món: ${recipeName}`);
    console.log(`   - Rating: ${rating} sao`);
    console.log(`   - Số lượng: ${count} đánh giá\n`);

    // Tìm recipe - sử dụng tìm kiếm không phân biệt hoa thường và xử lý encoding
    const searchTerm = recipeName.trim();
    const [recipes] = await sequelize.query(
      `SELECT id, recipe_name FROM recipes 
       WHERE LOWER(recipe_name) LIKE LOWER($1) 
       OR recipe_name ILIKE $2
       LIMIT 1`,
      {
        bind: [`%${searchTerm}%`, `%${searchTerm}%`]
      }
    );

    if (recipes.length === 0) {
      console.log(`❌ Không tìm thấy recipe: "${recipeName}"`);
      console.log(`\n💡 Gợi ý: Kiểm tra lại tên món hoặc tìm kiếm trong database`);
      
      // Liệt kê một số recipe để tham khảo
      const [allRecipes] = await sequelize.query(
        `SELECT recipe_name FROM recipes WHERE status = 'visible' ORDER BY recipe_name LIMIT 10`
      );
      if (allRecipes.length > 0) {
        console.log(`\n📝 Một số recipe có sẵn:`);
        allRecipes.forEach(r => console.log(`   - ${r.recipe_name}`));
      }
      
      await sequelize.close();
      return;
    }

    const recipe = recipes[0];
    console.log(`✅ Tìm thấy recipe: "${recipe.recipe_name}" (ID: ${recipe.id})\n`);

    // Lấy danh sách users
    const [users] = await sequelize.query(
      `SELECT id FROM users WHERE status = 'active' ORDER BY id`
    );

    if (users.length === 0) {
      console.log('❌ Không tìm thấy user nào!');
      await sequelize.close();
      return;
    }

    console.log(`📊 Tìm thấy ${users.length} users`);

    // Lấy các đánh giá hiện có cho recipe này
    const [existingReviews] = await sequelize.query(
      `SELECT user_id FROM recipe_reviews WHERE recipe_id = $1`,
      {
        bind: [recipe.id]
      }
    );
    
    const existingUserIds = new Set(existingReviews.map(r => r.user_id));
    console.log(`📝 Đã có ${existingReviews.length} đánh giá hiện tại cho recipe này\n`);

    // Lọc users chưa đánh giá
    const availableUsers = users.filter(u => !existingUserIds.has(u.id));

    if (availableUsers.length < count) {
      console.log(`⚠️  Chỉ có ${availableUsers.length} users chưa đánh giá, sẽ tạo ${availableUsers.length} đánh giá thay vì ${count}`);
    }

    const usersToUse = availableUsers.slice(0, count);
    console.log(`🎲 Bắt đầu tạo ${usersToUse.length} đánh giá ${rating} sao...\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of usersToUse) {
      const userId = user.id;
      
      // Chọn comment ngẫu nhiên (70% có comment, 30% không có)
      const hasComment = Math.random() < 0.7;
      const comment = hasComment 
        ? oneStarComments[Math.floor(Math.random() * oneStarComments.length)]
        : null;

      try {
        await sequelize.query(
          `INSERT INTO recipe_reviews (user_id, recipe_id, rating, comment, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
          {
            bind: [userId, recipe.id, rating, comment]
          }
        );

        created++;
        if (created % 20 === 0) {
          console.log(`   ✅ Đã tạo ${created}/${usersToUse.length} đánh giá...`);
        }
      } catch (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
          skipped++;
        } else {
          console.error(`   ❌ Lỗi khi tạo đánh giá cho user ${userId}:`, error.message);
          errors++;
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 KẾT QUẢ:');
    console.log(`   ✅ Đã tạo: ${created} đánh giá ${rating} sao`);
    console.log(`   ⏭️  Đã bỏ qua (trùng lặp): ${skipped} đánh giá`);
    console.log(`   ❌ Lỗi: ${errors} đánh giá`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Thống kê rating cho recipe này
    const [stats] = await sequelize.query(
      `SELECT 
        rating,
        COUNT(*) as count
       FROM recipe_reviews 
       WHERE recipe_id = $1 AND is_active = true
       GROUP BY rating 
       ORDER BY rating DESC`,
      {
        bind: [recipe.id]
      }
    );

    console.log(`⭐ PHÂN BỐ RATING CHO "${recipe.recipe_name}":`);
    stats.forEach(stat => {
      const stars = '⭐'.repeat(stat.rating);
      console.log(`   ${stars} (${stat.rating} sao): ${stat.count} đánh giá`);
    });
    console.log('');

    await sequelize.close();
    console.log('✅ Hoàn thành!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    await sequelize.close();
    process.exit(1);
  }
}

// Chạy script
addReviewsForRecipe();
