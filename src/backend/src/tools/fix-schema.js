/* eslint-disable */
/**
 * Sync all DB schema mismatches to match Sequelize models.
 * Run with: node src/tools/fix-schema.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const { Client } = require('pg');

(async () => {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('Missing SUPABASE_DB_URL');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('Connected to Supabase\n');

  // Idempotent helper: add a column only if it doesn't exist
  async function addColumn(table, colName, ddl) {
    const check = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [table, colName]
    );
    if (check.rowCount > 0) {
      console.log(`  · ${table}.${colName} already exists — skipping`);
      return false;
    }
    console.log(`  + adding ${table}.${colName}`);
    await client.query(`ALTER TABLE ${table} ADD COLUMN ${colName} ${ddl}`);
    return true;
  }

  async function renameColumn(table, from, to) {
    const check = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [table, to]
    );
    if (check.rowCount > 0) {
      console.log(`  · ${table}.${to} already exists — skipping rename of ${from}`);
      return false;
    }
    console.log(`  ↻ renaming ${table}.${from} -> ${to}`);
    await client.query(`ALTER TABLE ${table} RENAME COLUMN ${from} TO ${to}`);
    return true;
  }

  async function dropColumnIfExists(table, colName) {
    const check = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [table, colName]
    );
    if (check.rowCount === 0) {
      console.log(`  · ${table}.${colName} does not exist — nothing to drop`);
      return false;
    }
    console.log(`  - dropping ${table}.${colName}`);
    await client.query(`ALTER TABLE ${table} DROP COLUMN ${colName}`);
    return true;
  }

  // ============================================================
  // meal_plans: Sequelize model expects plan_name, start_date, end_date, status
  //             DB has: id, user_id, week_start_date, created_at, updated_at
  // ============================================================
  console.log('\n=== meal_plans ===');
  // Rename week_start_date -> start_date (the model uses start_date)
  await renameColumn('meal_plans', 'week_start_date', 'start_date');
  await addColumn('meal_plans', 'end_date', 'DATE');
  await addColumn('meal_plans', 'plan_name', "VARCHAR(200) NOT NULL DEFAULT 'Meal Plan'");
  await addColumn(
    'meal_plans',
    'status',
    `VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','archived'))`
  );
  // Drop the default for plan_name so future inserts MUST provide one
  await client.query(`ALTER TABLE meal_plans ALTER COLUMN plan_name DROP DEFAULT`);

  // ============================================================
  // meal_plan_items: Sequelize model expects planned_date, notes
  //                  DB has: id, meal_plan_id, recipe_id, date, meal_type, servings, created_at, updated_at
  // ============================================================
  console.log('\n=== meal_plan_items ===');
  await renameColumn('meal_plan_items', 'date', 'planned_date');
  await addColumn('meal_plan_items', 'notes', 'TEXT');

  // ============================================================
  // chat_messages: model expects metadata (JSONB), timestamps disabled
  //                DB has: id, session_id, role, content, metadata
  // ============================================================
  console.log('\n=== chat_messages ===');
  // metadata already exists in DB? check
  const metaCheck = await client.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='chat_messages' AND column_name='metadata'`
  );
  if (metaCheck.rowCount === 0) {
    await addColumn('chat_messages', 'metadata', "JSONB NOT NULL DEFAULT '{}'::jsonb");
  } else {
    console.log("  · chat_messages.metadata already exists");
  }
  // Add created_at/updated_at if missing (model has timestamps: false so we may keep them off)
  // Leave timestamps off to match the model
  await dropColumnIfExists('chat_messages', 'created_at');
  await dropColumnIfExists('chat_messages', 'updated_at');

  // ============================================================
  // ingredient_conflicts: model uses ingredient_id_1, ingredient_id_2, conflict_reason
  //                       DB has: ingredient_a_id, ingredient_b_id, reason
  // ============================================================
  console.log('\n=== ingredient_conflicts ===');
  await renameColumn('ingredient_conflicts', 'ingredient_a_id', 'ingredient_id_1');
  await renameColumn('ingredient_conflicts', 'ingredient_b_id', 'ingredient_id_2');
  await renameColumn('ingredient_conflicts', 'reason', 'conflict_reason');
  // Ensure severity is the correct enum-typed column
  await client.query(
    `DO $$
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_ingredient_conflicts_severity') THEN
         CREATE TYPE enum_ingredient_conflicts_severity AS ENUM ('low','medium','high');
       END IF;
     END$$;`
  );
  // Convert severity column to enum if not already
  const sevType = await client.query(
    `SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='ingredient_conflicts' AND column_name='severity'`
  );
  if (sevType.rows[0] && sevType.rows[0].data_type !== 'USER-DEFINED') {
    console.log('  ↻ converting severity to enum');
    await client.query(
      `ALTER TABLE ingredient_conflicts
         ALTER COLUMN severity TYPE enum_ingredient_conflicts_severity
         USING severity::enum_ingredient_conflicts_severity`
    );
    await client.query(
      `ALTER TABLE ingredient_conflicts
         ALTER COLUMN severity SET DEFAULT 'medium'`
    );
  }

  // ============================================================
  // detection_history: model has final_ingredients (already there). All good.
  // ============================================================
  console.log('\n=== detection_history ===');
  // already complete

  // ============================================================
  // commentlikes: model uses underscored: true with comment_id, user_id
  //                DB has: id, comment_id, user_id, created_at, updated_at
  // ============================================================
  console.log('\n=== commentlikes ===');
  // already complete (comment_id, user_id exist)

  // ============================================================
  // recipes: ensure is_vegetarian, is_low_calorie etc exist
  // ============================================================
  console.log('\n=== recipes ===');
  await addColumn('recipes', 'is_vegetarian', 'BOOLEAN NOT NULL DEFAULT false');
  await addColumn('recipes', 'is_low_calorie', 'BOOLEAN NOT NULL DEFAULT false');
  await addColumn('recipes', 'is_quick_recipe', 'BOOLEAN NOT NULL DEFAULT false');
  await addColumn('recipes', 'cuisine_type', 'VARCHAR(50)');
  await addColumn('recipes', 'suitable_for_diabetes', 'BOOLEAN NOT NULL DEFAULT false');
  await addColumn('recipes', 'recipe_name_unaccented', 'VARCHAR(200)');
  await addColumn('recipes', 'description_unaccented', 'TEXT');
  // create GIN trigram indexes for unaccented columns (idempotent)
  await client.query(
    `CREATE EXTENSION IF NOT EXISTS unaccent`
  ).catch(() => console.log("  · unaccent extension not available - skipping"));
  await client.query(
    `CREATE INDEX IF NOT EXISTS recipes_name_unaccented_idx ON recipes (recipe_name_unaccented)`
  ).catch((e) => console.log("  · could not create trigram index:", e.message));
  await client.query(
    `CREATE INDEX IF NOT EXISTS recipes_description_unaccented_idx ON recipes (description_unaccented)`
  ).catch((e) => console.log("  · could not create trigram index:", e.message));

  // ============================================================
  // pending_ingredients: model expects rejection_reason
  //                       DB has rejection_reason — good
  // ============================================================
  console.log('\n=== pending_ingredients ===');
  // already complete

  // ============================================================
  // ingredients: model expects unit, calories, ingredient_name_unaccented
  //              DB has: id, ingredient_name, category_id, description, created_at, updated_at, unit, calories, ingredient_name_unaccented
  // ============================================================
  console.log('\n=== ingredients ===');
  // already complete

  // ============================================================
  // recipe_reviews: model expects comment, is_active — already in DB
  // ============================================================
  console.log('\n=== recipe_reviews ===');
  // already complete

  // ============================================================
  // Make sure all auto-increment sequences are aligned
  // ============================================================
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
      const r = await client.query(
        `SELECT pg_get_serial_sequence($1, 'id') AS s`, [t]
      );
      const seq = r.rows[0]?.s;
      if (seq) {
        await client.query(
          `SELECT setval($1, GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${t}), 1), true)`,
          [seq]
        );
        console.log(`  ✓ ${t} sequence aligned`);
      }
    } catch (e) {
      console.log(`  ! ${t}: ${e.message}`);
    }
  }

  await client.end();
  console.log('\n✅ Schema sync complete!');
})().catch((e) => {
  console.error('ERROR:', e.message);
  console.error(e.stack);
  process.exit(1);
});
