require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

async function run() {
  try {
    // Kiểm tra ingredient 426 có tồn tại không
    const [ing] = await sequelize.query('SELECT id, ingredient_name FROM ingredients WHERE id = 426');
    console.log('Ingredient 426:', ing);
    
    // Kiểm tra dòng 743 trong recipe_ingredients
    const [row] = await sequelize.query('SELECT * FROM recipe_ingredients WHERE id = 743');
    console.log('Row 743 in DB:', row);
    
    if (ing.length > 0) {
      // Update dòng 743
      await sequelize.query(`
        INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, notes, created_at, updated_at)
        VALUES (743, 48, 426, 2, 'cây', 'Lạp xưởng (thái sợi/hạt lựu)', NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          recipe_id = EXCLUDED.recipe_id,
          ingredient_id = EXCLUDED.ingredient_id,
          quantity = EXCLUDED.quantity,
          unit = EXCLUDED.unit,
          notes = EXCLUDED.notes,
          updated_at = NOW()
      `);
      console.log('✅ Đã update dòng 743 thành công!');
    } else {
      console.log('❌ Ingredient 426 không tồn tại trong DB!');
    }
    
    await sequelize.close();
  } catch (error) {
    console.error('Lỗi:', error.message);
    await sequelize.close();
  }
}

run();
