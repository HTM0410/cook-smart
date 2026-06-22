require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function createTable() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Tạo bảng search_keywords
    const query = `
      CREATE TABLE IF NOT EXISTS search_keywords (
        id SERIAL PRIMARY KEY,
        keyword VARCHAR(255) NOT NULL UNIQUE,
        search_count INTEGER NOT NULL DEFAULT 0,
        last_searched_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_search_keywords_search_count ON search_keywords(search_count DESC);
      CREATE INDEX IF NOT EXISTS idx_search_keywords_last_searched ON search_keywords(last_searched_at DESC);
    `;

    await sequelize.query(query);
    console.log('✅ Table search_keywords created successfully!');

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await sequelize.close();
    process.exit(1);
  }
}

createTable();
