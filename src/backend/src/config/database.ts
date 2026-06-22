import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'cooksmart',
  process.env.DB_USER || 'root',
  process.env.DB_PASS || 'hoanghhk123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 20, // Increased from 10
      min: 5,  // Keep minimum connections
      acquire: 30000, // Max time to get connection
      idle: 10000,    // Max idle time before release
      evict: 10000    // Run eviction every 10 seconds
    },
    retry: {
      max: 3 // Retry failed connections 3 times
    },
    define: {
      timestamps: true,
      underscored: true,
      freezeTableName: true
    }
  }
);

export const connectDB = async () => {
  try {
    // Tạo database nếu chưa có
    const createDbSequelize = new Sequelize('', process.env.DB_USER || 'root', process.env.DB_PASS || 'hoanghhk123', {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      dialect: 'mysql',
      logging: false
    });
    
    await createDbSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'cooksmart'}\`;`);
    await createDbSequelize.close();
    
    // Kết nối với database đã tạo
    await sequelize.authenticate();
    console.log('✅ MySQL connection established successfully.');
    console.log(`📦 Database '${process.env.DB_NAME || 'cooksmart'}' is ready.`);
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error);
  }
};

export default sequelize;
