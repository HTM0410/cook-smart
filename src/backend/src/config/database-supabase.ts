import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Supabase / PostgreSQL
// Có thể dùng connection string hoặc thông tin riêng lẻ
const dbUrl = process.env.SUPABASE_DB_URL || 
  `postgresql://${process.env.SUPABASE_DB_USER || 'postgres'}:${process.env.SUPABASE_DB_PASS}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/${process.env.SUPABASE_DB_NAME || 'postgres'}`;

// Chỉ bật SSL khi dùng Supabase (host *.supabase.co hoặc *.supabase.com pooler), tắt SSL cho Postgres local
const useSSL = /supabase\.(co|com)/.test(dbUrl);

export const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: useSSL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false // Supabase yêu cầu SSL
        }
      }
    : {},
  pool: {
    max: 10, // Giảm từ 20 xuống 10 để tránh quá tải
    min: 2,  // Giảm từ 5 xuống 2
    acquire: 60000, // Tăng từ 30000 lên 60000 (60 seconds)
    idle: 10000,
    evict: 10000
  },
  retry: {
    max: 3
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  }
});

export const connectDB = async () => {
  console.log('📡 connectDB() function called');
  
  try {
    // Validate connection config
    console.log('🔍 Validating Supabase configuration...');
    if (!process.env.SUPABASE_DB_URL && !process.env.SUPABASE_DB_HOST) {
      console.error('❌ Thiếu cấu hình Supabase!');
      console.error('Cần set SUPABASE_DB_URL hoặc SUPABASE_DB_HOST, SUPABASE_DB_USER, SUPABASE_DB_PASS trong .env');
      throw new Error('Missing Supabase configuration');
    }
    
    console.log('✅ Supabase config validated');
    console.log('🔄 Đang kết nối đến Supabase PostgreSQL...');
    
    if (process.env.SUPABASE_DB_URL) {
      // Mask password in log
      const maskedUrl = process.env.SUPABASE_DB_URL.replace(/:([^:@]+)@/, ':****@');
      console.log(`📍 Using SUPABASE_DB_URL: ${maskedUrl.substring(0, 80)}...`);
    } else {
      console.log(`📍 Using SUPABASE_DB_HOST: ${process.env.SUPABASE_DB_HOST}`);
      console.log(`📍 Database: ${process.env.SUPABASE_DB_NAME || 'postgres'}`);
    }
    
    console.log('⏱️  Starting database authentication (timeout: 30s)...');
    const startTime = Date.now();
    
    // Set timeout cho connection - giảm xuống 30s để fail nhanh hơn
    const connectionPromise = sequelize.authenticate().then(() => {
      const elapsed = Date.now() - startTime;
      console.log(`✅ Authentication successful (${elapsed}ms)`);
    }).catch((err) => {
      const elapsed = Date.now() - startTime;
      console.error(`❌ Authentication failed after ${elapsed}ms:`, err.message);
      throw err;
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => {
        const elapsed = Date.now() - startTime;
        console.error(`⏱️  Connection timeout after ${elapsed}ms (30s limit)`);
        reject(new Error(`Connection timeout after ${elapsed}ms (30s limit)`));
      }, 30000) // Giảm từ 60s xuống 30s
    );
    
    await Promise.race([connectionPromise, timeoutPromise]);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Supabase PostgreSQL connection established successfully (${elapsed}ms).`);
    console.log(`📦 Database '${process.env.SUPABASE_DB_NAME || 'postgres'}' is ready.`);
  } catch (error: any) {
    console.error('❌ Unable to connect to Supabase:', error.message);
    console.error('❌ Error name:', error.name);
    if (error.stack) {
      console.error('❌ Error stack:', error.stack);
    }
    if (error.message.includes('getaddrinfo ENOENT')) {
      console.error('💡 Kiểm tra lại SUPABASE_DB_HOST hoặc SUPABASE_DB_URL trong file .env');
    }
    if (error.message.includes('password authentication failed')) {
      console.error('💡 Kiểm tra lại password trong SUPABASE_DB_URL hoặc SUPABASE_DB_PASS');
    }
    if (error.message.includes('timeout')) {
      console.error('💡 Connection timeout - có thể do network hoặc Supabase connection pool limit');
      console.error('💡 Thử dùng direct connection (port 5432) thay vì pooler (port 6543)');
    }
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 Không thể resolve hostname - kiểm tra SUPABASE_DB_HOST hoặc SUPABASE_DB_URL');
    }
    throw error;
  }
};

export default sequelize;

