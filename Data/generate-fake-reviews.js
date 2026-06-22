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

// Mẫu comment theo rating
const commentsByRating = {
  5: [
    'Món này tuyệt vời! Rất ngon và dễ làm.',
    'Công thức hoàn hảo, gia đình tôi rất thích!',
    'Đã làm nhiều lần, lần nào cũng thành công.',
    'Món ăn ngon miệng, hương vị đậm đà.',
    'Rất dễ làm theo, kết quả vượt mong đợi!',
    'Món này đã trở thành món yêu thích của tôi.',
    'Công thức chi tiết, rất dễ hiểu.',
    'Ngon tuyệt vời! Sẽ làm lại nhiều lần nữa.',
    'Món ăn đúng vị, gia đình khen ngợi.',
    'Tuyệt vời! Đã chia sẻ với bạn bè.'
  ],
  4: [
    'Món ăn khá ngon, công thức dễ làm.',
    'Tốt, nhưng có thể điều chỉnh thêm một chút.',
    'Hương vị ổn, sẽ thử lại.',
    'Món ăn ngon, phù hợp với khẩu vị.',
    'Công thức hay, kết quả khá tốt.',
    'Được, nhưng cần thêm một chút gia vị.',
    'Món ăn ổn, dễ làm theo.',
    'Khá ngon, gia đình thích.',
    'Tốt, sẽ làm lại.',
    'Món ăn ngon, đáng thử.'
  ],
  3: [
    'Món ăn bình thường, không có gì đặc biệt.',
    'Ổn, nhưng chưa thực sự ấn tượng.',
    'Công thức đơn giản, kết quả tạm được.',
    'Món ăn ổn, có thể thử.',
    'Không tệ, nhưng cũng không xuất sắc.',
    'Bình thường, phù hợp cho bữa ăn hàng ngày.',
    'Món ăn ổn, không có gì nổi bật.',
    'Tạm được, sẽ thử điều chỉnh thêm.',
    'Không quá tệ, nhưng cũng không quá ngon.',
    'Món ăn bình thường, dễ làm.'
  ],
  2: [
    'Món ăn không ngon lắm, cần cải thiện.',
    'Hương vị chưa đạt, có thể do cách làm.',
    'Không như mong đợi, hơi thất vọng.',
    'Món ăn tạm được, nhưng chưa hài lòng.',
    'Công thức cần điều chỉnh thêm.',
    'Món ăn không ngon như tưởng tượng.',
    'Hơi thất vọng với kết quả.',
    'Cần cải thiện thêm về hương vị.',
    'Món ăn chưa đạt yêu cầu.',
    'Không ngon lắm, sẽ thử cách khác.'
  ],
  1: [
    'Món ăn không ngon, không nên thử lại.',
    'Rất thất vọng với công thức này.',
    'Món ăn không đạt yêu cầu.',
    'Không hài lòng với kết quả.',
    'Công thức cần được xem xét lại.',
    'Món ăn không ngon, không khuyến khích.',
    'Rất không hài lòng.',
    'Món ăn không đạt chất lượng.',
    'Thất vọng với công thức này.',
    'Không nên thử lại.'
  ]
};

// Hàm lấy comment ngẫu nhiên theo rating
function getRandomComment(rating) {
  const comments = commentsByRating[rating] || [];
  if (comments.length === 0) return null;
  
  // 70% có comment, 30% không có
  if (Math.random() < 0.3) return null;
  
  return comments[Math.floor(Math.random() * comments.length)];
}

// Hàm tạo rating với phân bố hợp lý (nhiều 4-5 sao hơn)
function generateRating() {
  const rand = Math.random();
  if (rand < 0.4) return 5;      // 40% - 5 sao
  if (rand < 0.65) return 4;     // 25% - 4 sao
  if (rand < 0.85) return 3;     // 20% - 3 sao
  if (rand < 0.95) return 2;     // 10% - 2 sao
  return 1;                      // 5% - 1 sao
}

async function generateFakeReviews() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Lấy danh sách recipes
    const [recipes] = await sequelize.query(
      `SELECT id FROM recipes WHERE status = 'visible' ORDER BY id`
    );
    
    // Lấy danh sách users
    const [users] = await sequelize.query(
      `SELECT id FROM users WHERE status = 'active' ORDER BY id`
    );

    if (recipes.length === 0) {
      console.log('❌ Không tìm thấy recipe nào!');
      await sequelize.close();
      return;
    }

    if (users.length === 0) {
      console.log('❌ Không tìm thấy user nào!');
      await sequelize.close();
      return;
    }

    console.log(`📊 Tìm thấy ${recipes.length} recipes và ${users.length} users`);

    // Lấy các đánh giá hiện có để tránh trùng lặp
    const [existingReviews] = await sequelize.query(
      `SELECT user_id, recipe_id FROM recipe_reviews`
    );
    
    const existingSet = new Set(
      existingReviews.map(r => `${r.user_id}-${r.recipe_id}`)
    );

    console.log(`📝 Đã có ${existingReviews.length} đánh giá hiện tại`);

    // Số lượng đánh giá muốn tạo (mặc định: 3-10 đánh giá mỗi recipe)
    const reviewsPerRecipe = process.argv[2] ? parseInt(process.argv[2]) : 5;
    const totalReviews = recipes.length * reviewsPerRecipe;

    console.log(`\n🎲 Bắt đầu tạo ${totalReviews} đánh giá fake...`);
    console.log(`   (Trung bình ${reviewsPerRecipe} đánh giá mỗi recipe)\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Tạo đánh giá cho mỗi recipe
    for (const recipe of recipes) {
      const recipeId = recipe.id;
      
      // Tạo số lượng đánh giá ngẫu nhiên cho recipe này (1-10)
      const numReviews = Math.floor(Math.random() * reviewsPerRecipe) + 1;
      
      // Chọn ngẫu nhiên users để đánh giá
      const shuffledUsers = [...users].sort(() => Math.random() - 0.5);
      const selectedUsers = shuffledUsers.slice(0, Math.min(numReviews, users.length));

      for (const user of selectedUsers) {
        const userId = user.id;
        const key = `${userId}-${recipeId}`;

        // Kiểm tra xem đã có đánh giá chưa
        if (existingSet.has(key)) {
          skipped++;
          continue;
        }

        // Tạo rating và comment
        const rating = generateRating();
        const comment = getRandomComment(rating);

        try {
          await sequelize.query(
            `INSERT INTO recipe_reviews (user_id, recipe_id, rating, comment, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, true, NOW(), NOW())`,
            {
              bind: [userId, recipeId, rating, comment]
            }
          );

          existingSet.add(key); // Thêm vào set để tránh trùng trong cùng lần chạy
          created++;

          if (created % 50 === 0) {
            console.log(`   ✅ Đã tạo ${created} đánh giá...`);
          }
        } catch (error) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            skipped++;
          } else {
            console.error(`   ❌ Lỗi khi tạo đánh giá cho user ${userId}, recipe ${recipeId}:`, error.message);
            errors++;
          }
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 KẾT QUẢ:');
    console.log(`   ✅ Đã tạo: ${created} đánh giá`);
    console.log(`   ⏭️  Đã bỏ qua (trùng lặp): ${skipped} đánh giá`);
    console.log(`   ❌ Lỗi: ${errors} đánh giá`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Thống kê rating
    const [stats] = await sequelize.query(
      `SELECT 
        rating,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM recipe_reviews WHERE is_active = true), 2) as percentage
       FROM recipe_reviews 
       WHERE is_active = true
       GROUP BY rating 
       ORDER BY rating DESC`
    );

    console.log('⭐ PHÂN BỐ RATING:');
    stats.forEach(stat => {
      const stars = '⭐'.repeat(stat.rating);
      console.log(`   ${stars} (${stat.rating} sao): ${stat.count} đánh giá (${stat.percentage}%)`);
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
generateFakeReviews();
