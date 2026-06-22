require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function createOrResetAdmin() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Thông tin admin mặc định
    const adminUsername = 'admin';
    const adminPassword = 'admin123456'; // Mật khẩu mặc định
    const adminRole = 'superadmin';

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    // Kiểm tra xem admin đã tồn tại chưa
    const [results] = await sequelize.query(
      `SELECT id, username FROM admins WHERE username = $1`,
      {
        bind: [adminUsername]
      }
    );

    if (results && results.length > 0) {
      // Update password nếu admin đã tồn tại
      await sequelize.query(
        `UPDATE admins SET password = $1, role = $2, updated_at = NOW() WHERE username = $3`,
        {
          bind: [hashedPassword, adminRole, adminUsername]
        }
      );
      console.log('✅ Đã cập nhật tài khoản admin!');
    } else {
      // Tạo admin mới
      await sequelize.query(
        `INSERT INTO admins (username, password, role, created_at, updated_at) 
         VALUES ($1, $2, $3, NOW(), NOW())`,
        {
          bind: [adminUsername, hashedPassword, adminRole]
        }
      );
      console.log('✅ Đã tạo tài khoản admin mới!');
    }

    console.log('\n📋 THÔNG TIN ĐĂNG NHẬP ADMIN:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Username: ${adminUsername}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log(`👑 Role: ${adminRole}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

createOrResetAdmin();
