/* eslint-disable */
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

  // Inspect every table used by models, print current columns
  const tables = [
    'meal_plans',
    'meal_plan_items',
    'users',
    'recipes',
    'recipe_steps',
    'recipe_ingredients',
    'ingredients',
    'ingredient_categories',
    'user_favorites',
    'recipe_reviews',
    'pending_ingredients',
    'comments',
    'recipe_categories',
    'recipe_category_map',
    'user_views',
    'recipe_embeddings',
    'chat_sessions',
    'chat_messages',
    'ingredient_conflicts',
    'detection_history',
    'commentlikes',
    'admins',
  ];

  const dbColumns = {};
  for (const t of tables) {
    const r = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1
        ORDER BY ordinal_position`,
      [t]
    );
    dbColumns[t] = r.rows.map((c) => c.column_name);
    console.log(`[${t}] (${r.rows.length} cols): ${dbColumns[t].join(', ')}`);
  }

  await client.end();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
