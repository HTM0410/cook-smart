import { sequelize } from '../src/config/database-supabase';

(async () => {
  try {
    await sequelize.authenticate();
    const [rows] = await sequelize.query(
      "SELECT id, recipe_name FROM recipes WHERE unaccent(recipe_name) ILIKE unaccent('%banh xeo%') AND status='visible' LIMIT 20"
    );
    console.log('=== Recipes containing banh xeo ===');
    (rows as any[]).forEach((r) => console.log(`  - #${r.id}: ${r.recipe_name}`));

    const [rows2] = await sequelize.query(
      "SELECT id, recipe_name FROM recipes WHERE unaccent(recipe_name) ILIKE unaccent('%banh%') AND status='visible' ORDER BY LENGTH(recipe_name) ASC LIMIT 25"
    );
    console.log('=== Top 25 shortest recipes with banh ===');
    (rows2 as any[]).forEach((r) => console.log(`  - #${r.id}: ${r.recipe_name}`));
    await sequelize.close();
  } catch (e: any) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();