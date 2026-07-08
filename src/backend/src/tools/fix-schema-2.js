/* eslint-disable */
/**
 * Fix the remaining schema issue: severity enum default, and add users.phone column.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Client } = require('pg');

(async () => {
  const url = process.env.SUPABASE_DB_URL;
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('Connected\n');

  // 1) ingredient_conflicts.severity: drop default then re-convert to enum
  console.log('=== ingredient_conflicts.severity ===');
  const sevInfo = await client.query(
    `SELECT data_type, column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ingredient_conflicts' AND column_name='severity'`
  );
  console.log('current:', sevInfo.rows[0]);

  // Drop default first
  await client.query(`ALTER TABLE ingredient_conflicts ALTER COLUMN severity DROP DEFAULT`).catch((e) =>
    console.log('drop default:', e.message)
  );
  // Convert to enum
  await client.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ingredient_conflicts_severity') THEN
         CREATE TYPE enum_ingredient_conflicts_severity AS ENUM ('low','medium','high');
       END IF;
     END$$;`
  );
  // Convert column type to enum (USING cast text -> enum)
  await client.query(
    `ALTER TABLE ingredient_conflicts
       ALTER COLUMN severity TYPE enum_ingredient_conflicts_severity
       USING severity::enum_ingredient_conflicts_severity`
  ).catch((e) => console.log('alter type:', e.message));
  // Re-add default
  await client.query(
    `ALTER TABLE ingredient_conflicts ALTER COLUMN severity SET DEFAULT 'medium'::enum_ingredient_conflicts_severity`
  );
  console.log('severity now: enum with default medium');

  // 2) Add users.phone (referenced in authController)
  console.log('\n=== users.phone ===');
  const phoneExists = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='users' AND column_name='phone'`
  );
  if (phoneExists.rowCount === 0) {
    await client.query(`ALTER TABLE users ADD COLUMN phone VARCHAR(20)`);
    console.log('+ users.phone added');
  } else {
    console.log('users.phone exists');
  }

  // 3) Verify recipes.calories, recipe_name_unaccented, is_vegetarian etc
  console.log('\n=== recipes extensions ===');
  const recipesCols = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='recipes'`
  );
  const have = new Set(recipesCols.rows.map((r) => r.column_name));
  const need = ['calories', 'recipe_name_unaccented', 'description_unaccented', 'is_vegetarian', 'is_low_calorie', 'is_quick_recipe', 'cuisine_type', 'suitable_for_diabetes'];
  for (const c of need) {
    if (!have.has(c)) {
      let ddl = 'TEXT';
      if (c.startsWith('is_') || c === 'suitable_for_diabetes') ddl = 'BOOLEAN NOT NULL DEFAULT false';
      if (c === 'cuisine_type') ddl = 'VARCHAR(50)';
      console.log(`+ recipes.${c} (${ddl})`);
      await client.query(`ALTER TABLE recipes ADD COLUMN ${c} ${ddl}`);
    } else {
      console.log(`· recipes.${c} ok`);
    }
  }

  // 4) Add chat_messages.metadata default if not set
  console.log('\n=== chat_messages.metadata ===');
  const metaDefault = await client.query(
    `SELECT column_default FROM information_schema.columns
      WHERE table_schema='public' AND table_name='chat_messages' AND column_name='metadata'`
  );
  if (!metaDefault.rows[0]?.column_default) {
    await client.query(`ALTER TABLE chat_messages ALTER COLUMN metadata SET DEFAULT '{}'::jsonb`);
    console.log('+ metadata default set');
  } else {
    console.log('· metadata default ok');
  }

  // 5) Align sequences for all auto-increment tables
  console.log('\n=== Aligning sequences ===');
  const tables = [
    'users',
    'user_favorites',
    'admins',
    'recipes',
    'recipe_steps',
    'recipe_ingredients',
    'ingredients',
    'ingredient_categories',
    'recipe_reviews',
    'pending_ingredients',
    'comments',
    'recipe_categories',
    'recipe_category_map',
    'user_views',
    'chat_sessions',
    'meal_plans',
    'meal_plan_items',
    'ingredient_conflicts',
    'detection_history',
    'commentlikes',
  ];
  for (const t of tables) {
    try {
      const r = await client.query(`SELECT pg_get_serial_sequence($1, 'id') AS s`, [t]);
      const seq = r.rows[0]?.s;
      if (seq) {
        await client.query(
          `SELECT setval($1, GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${t}), 1), true)`,
          [seq]
        );
        console.log(`  ✓ ${t} aligned`);
      }
    } catch (e) {
      console.log(`  ! ${t}: ${e.message}`);
    }
  }

  await client.end();
  console.log('\n✅ Schema fixes complete');
})().catch((e) => {
  console.error('ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});
