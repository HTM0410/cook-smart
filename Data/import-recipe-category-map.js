require('dotenv').config({ path: '../src/backend/.env' });
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.SUPABASE_DB_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
});

// Dữ liệu cần import
const mappingData = [
  { id: 1, recipe_id: 1, category_id: 35 },
  { id: 2, recipe_id: 1, category_id: 11 },
  { id: 3, recipe_id: 1, category_id: 1 },
  { id: 4, recipe_id: 1, category_id: 34 },
  { id: 5, recipe_id: 1, category_id: 29 },
  { id: 6, recipe_id: 1, category_id: 33 },
  { id: 7, recipe_id: 1, category_id: 28 },
  { id: 8, recipe_id: 2, category_id: 11 },
  { id: 9, recipe_id: 2, category_id: 1 },
  { id: 10, recipe_id: 2, category_id: 34 },
  { id: 11, recipe_id: 2, category_id: 29 },
  { id: 12, recipe_id: 2, category_id: 33 },
  { id: 13, recipe_id: 2, category_id: 16 },
  { id: 14, recipe_id: 2, category_id: 28 },
  { id: 15, recipe_id: 2, category_id: 35 },
  { id: 16, recipe_id: 3, category_id: 11 },
  { id: 17, recipe_id: 3, category_id: 1 },
  { id: 18, recipe_id: 3, category_id: 34 },
  { id: 19, recipe_id: 3, category_id: 29 },
  { id: 20, recipe_id: 3, category_id: 33 },
  { id: 21, recipe_id: 3, category_id: 16 },
  { id: 22, recipe_id: 3, category_id: 28 },
  { id: 23, recipe_id: 3, category_id: 35 },
  { id: 24, recipe_id: 4, category_id: 11 },
  { id: 25, recipe_id: 4, category_id: 1 },
  { id: 26, recipe_id: 4, category_id: 34 },
  { id: 27, recipe_id: 4, category_id: 29 },
  { id: 28, recipe_id: 4, category_id: 33 },
  { id: 29, recipe_id: 5, category_id: 24 },
  { id: 30, recipe_id: 5, category_id: 13 },
  { id: 31, recipe_id: 5, category_id: 30 },
  { id: 32, recipe_id: 5, category_id: 1 },
  { id: 33, recipe_id: 5, category_id: 25 },
  { id: 34, recipe_id: 5, category_id: 21 },
  { id: 35, recipe_id: 5, category_id: 29 },
  { id: 36, recipe_id: 5, category_id: 33 },
  { id: 37, recipe_id: 5, category_id: 28 },
  { id: 38, recipe_id: 6, category_id: 11 },
  { id: 39, recipe_id: 6, category_id: 1 },
  { id: 40, recipe_id: 6, category_id: 29 },
  { id: 41, recipe_id: 6, category_id: 33 },
  { id: 42, recipe_id: 6, category_id: 35 },
  { id: 43, recipe_id: 7, category_id: 1 },
  { id: 44, recipe_id: 7, category_id: 34 },
  { id: 45, recipe_id: 7, category_id: 21 },
  { id: 46, recipe_id: 7, category_id: 29 },
  { id: 47, recipe_id: 7, category_id: 33 },
  { id: 48, recipe_id: 7, category_id: 15 },
  { id: 49, recipe_id: 8, category_id: 11 },
  { id: 50, recipe_id: 8, category_id: 1 },
  { id: 51, recipe_id: 8, category_id: 34 },
  { id: 52, recipe_id: 8, category_id: 29 },
  { id: 53, recipe_id: 8, category_id: 33 },
  { id: 54, recipe_id: 8, category_id: 28 },
  { id: 55, recipe_id: 8, category_id: 35 },
  { id: 56, recipe_id: 9, category_id: 11 },
  { id: 57, recipe_id: 9, category_id: 1 },
  { id: 58, recipe_id: 9, category_id: 29 },
  { id: 59, recipe_id: 9, category_id: 33 },
  { id: 60, recipe_id: 9, category_id: 35 },
  { id: 61, recipe_id: 10, category_id: 11 },
  { id: 62, recipe_id: 10, category_id: 1 },
  { id: 63, recipe_id: 10, category_id: 34 },
  { id: 64, recipe_id: 10, category_id: 29 },
  { id: 65, recipe_id: 10, category_id: 33 },
  { id: 66, recipe_id: 10, category_id: 28 },
  { id: 67, recipe_id: 10, category_id: 35 },
  { id: 68, recipe_id: 11, category_id: 11 },
  { id: 69, recipe_id: 11, category_id: 1 },
  { id: 70, recipe_id: 11, category_id: 34 },
  { id: 71, recipe_id: 11, category_id: 29 },
  { id: 72, recipe_id: 11, category_id: 33 },
  { id: 73, recipe_id: 11, category_id: 28 },
  { id: 74, recipe_id: 11, category_id: 35 },
  { id: 75, recipe_id: 12, category_id: 11 },
  { id: 76, recipe_id: 12, category_id: 1 },
  { id: 77, recipe_id: 12, category_id: 34 },
  { id: 78, recipe_id: 12, category_id: 29 },
  { id: 79, recipe_id: 12, category_id: 33 },
  { id: 80, recipe_id: 12, category_id: 28 },
  { id: 81, recipe_id: 12, category_id: 35 },
  { id: 82, recipe_id: 13, category_id: 1 },
  { id: 83, recipe_id: 13, category_id: 34 },
  { id: 84, recipe_id: 13, category_id: 31 },
  { id: 85, recipe_id: 13, category_id: 29 },
  { id: 86, recipe_id: 13, category_id: 33 },
  { id: 87, recipe_id: 13, category_id: 11 },
  { id: 88, recipe_id: 13, category_id: 28 },
  { id: 89, recipe_id: 14, category_id: 11 },
  { id: 90, recipe_id: 14, category_id: 1 },
  { id: 91, recipe_id: 14, category_id: 34 },
  { id: 92, recipe_id: 14, category_id: 29 },
  { id: 93, recipe_id: 14, category_id: 33 },
  { id: 94, recipe_id: 14, category_id: 28 },
  { id: 95, recipe_id: 14, category_id: 35 },
  { id: 96, recipe_id: 15, category_id: 11 },
  { id: 97, recipe_id: 15, category_id: 1 },
  { id: 98, recipe_id: 15, category_id: 29 },
  { id: 99, recipe_id: 15, category_id: 33 },
  { id: 100, recipe_id: 15, category_id: 28 },
  { id: 101, recipe_id: 15, category_id: 35 },
  { id: 102, recipe_id: 16, category_id: 11 },
  { id: 103, recipe_id: 16, category_id: 1 },
  { id: 104, recipe_id: 16, category_id: 34 },
  { id: 105, recipe_id: 16, category_id: 29 },
  { id: 106, recipe_id: 16, category_id: 33 },
  { id: 107, recipe_id: 16, category_id: 28 },
  { id: 108, recipe_id: 16, category_id: 35 },
  { id: 109, recipe_id: 17, category_id: 11 },
  { id: 110, recipe_id: 17, category_id: 1 },
  { id: 111, recipe_id: 17, category_id: 29 },
  { id: 112, recipe_id: 17, category_id: 33 },
  { id: 113, recipe_id: 17, category_id: 28 },
  { id: 114, recipe_id: 17, category_id: 35 },
  { id: 115, recipe_id: 18, category_id: 11 },
  { id: 116, recipe_id: 18, category_id: 1 },
  { id: 117, recipe_id: 18, category_id: 34 },
  { id: 118, recipe_id: 18, category_id: 29 },
  { id: 119, recipe_id: 18, category_id: 33 },
  { id: 120, recipe_id: 18, category_id: 28 },
  { id: 121, recipe_id: 18, category_id: 35 },
  { id: 122, recipe_id: 19, category_id: 11 },
  { id: 123, recipe_id: 19, category_id: 1 },
  { id: 124, recipe_id: 19, category_id: 29 },
  { id: 125, recipe_id: 19, category_id: 33 },
  { id: 126, recipe_id: 19, category_id: 28 },
  { id: 127, recipe_id: 19, category_id: 35 },
  { id: 128, recipe_id: 20, category_id: 11 },
  { id: 129, recipe_id: 20, category_id: 1 },
  { id: 130, recipe_id: 20, category_id: 29 },
  { id: 131, recipe_id: 20, category_id: 33 },
  { id: 132, recipe_id: 20, category_id: 28 },
  { id: 133, recipe_id: 20, category_id: 35 },
  { id: 134, recipe_id: 21, category_id: 11 },
  { id: 135, recipe_id: 21, category_id: 1 },
  { id: 136, recipe_id: 21, category_id: 34 },
  { id: 137, recipe_id: 21, category_id: 29 },
  { id: 138, recipe_id: 21, category_id: 33 },
  { id: 139, recipe_id: 21, category_id: 28 },
  { id: 140, recipe_id: 21, category_id: 35 },
  { id: 141, recipe_id: 22, category_id: 24 },
  { id: 142, recipe_id: 22, category_id: 21 },
  { id: 143, recipe_id: 22, category_id: 32 },
  { id: 144, recipe_id: 22, category_id: 30 },
  { id: 145, recipe_id: 22, category_id: 1 },
  { id: 146, recipe_id: 22, category_id: 25 },
  { id: 147, recipe_id: 22, category_id: 14 },
  { id: 148, recipe_id: 23, category_id: 11 },
  { id: 149, recipe_id: 23, category_id: 1 },
  { id: 150, recipe_id: 23, category_id: 34 },
  { id: 151, recipe_id: 23, category_id: 29 },
  { id: 152, recipe_id: 23, category_id: 33 },
  { id: 153, recipe_id: 23, category_id: 28 },
  { id: 154, recipe_id: 23, category_id: 35 },
  { id: 155, recipe_id: 24, category_id: 11 },
  { id: 156, recipe_id: 24, category_id: 1 },
  { id: 157, recipe_id: 24, category_id: 29 },
  { id: 158, recipe_id: 24, category_id: 33 },
  { id: 159, recipe_id: 24, category_id: 28 },
  { id: 160, recipe_id: 24, category_id: 35 },
  { id: 161, recipe_id: 25, category_id: 11 },
  { id: 162, recipe_id: 25, category_id: 1 },
  { id: 163, recipe_id: 25, category_id: 29 },
  { id: 164, recipe_id: 25, category_id: 33 },
  { id: 165, recipe_id: 25, category_id: 28 },
  { id: 166, recipe_id: 25, category_id: 35 },
  { id: 167, recipe_id: 26, category_id: 11 },
  { id: 168, recipe_id: 26, category_id: 1 },
  { id: 169, recipe_id: 26, category_id: 34 },
  { id: 170, recipe_id: 26, category_id: 29 },
  { id: 171, recipe_id: 26, category_id: 33 },
  { id: 172, recipe_id: 26, category_id: 16 },
  { id: 173, recipe_id: 26, category_id: 35 },
  { id: 174, recipe_id: 27, category_id: 11 },
  { id: 175, recipe_id: 27, category_id: 1 },
  { id: 176, recipe_id: 27, category_id: 29 },
  { id: 177, recipe_id: 27, category_id: 33 },
  { id: 178, recipe_id: 27, category_id: 28 },
  { id: 179, recipe_id: 27, category_id: 35 },
  { id: 180, recipe_id: 28, category_id: 11 },
  { id: 181, recipe_id: 28, category_id: 1 },
  { id: 182, recipe_id: 28, category_id: 29 },
  { id: 183, recipe_id: 28, category_id: 33 },
  { id: 184, recipe_id: 28, category_id: 28 },
  { id: 185, recipe_id: 28, category_id: 35 },
  { id: 186, recipe_id: 29, category_id: 11 },
  { id: 187, recipe_id: 29, category_id: 1 },
  { id: 188, recipe_id: 29, category_id: 29 },
  { id: 189, recipe_id: 29, category_id: 33 },
  { id: 190, recipe_id: 29, category_id: 16 },
  { id: 191, recipe_id: 29, category_id: 35 },
  { id: 192, recipe_id: 30, category_id: 1 },
  { id: 193, recipe_id: 30, category_id: 34 },
  { id: 194, recipe_id: 30, category_id: 21 },
  { id: 195, recipe_id: 30, category_id: 29 },
  { id: 196, recipe_id: 30, category_id: 33 },
  { id: 197, recipe_id: 30, category_id: 15 },
  { id: 198, recipe_id: 31, category_id: 11 },
  { id: 199, recipe_id: 31, category_id: 1 },
  { id: 200, recipe_id: 31, category_id: 34 },
  { id: 201, recipe_id: 31, category_id: 29 },
  { id: 202, recipe_id: 31, category_id: 33 },
  { id: 203, recipe_id: 31, category_id: 35 },
  { id: 204, recipe_id: 32, category_id: 11 },
  { id: 205, recipe_id: 32, category_id: 1 },
  { id: 206, recipe_id: 32, category_id: 29 },
  { id: 207, recipe_id: 32, category_id: 33 },
  { id: 208, recipe_id: 32, category_id: 35 },
  { id: 209, recipe_id: 33, category_id: 24 },
  { id: 210, recipe_id: 33, category_id: 1 },
  { id: 211, recipe_id: 33, category_id: 34 },
  { id: 212, recipe_id: 33, category_id: 21 },
  { id: 213, recipe_id: 33, category_id: 25 },
  { id: 214, recipe_id: 33, category_id: 29 },
  { id: 215, recipe_id: 33, category_id: 33 },
  { id: 216, recipe_id: 33, category_id: 15 },
  { id: 217, recipe_id: 34, category_id: 11 },
  { id: 218, recipe_id: 34, category_id: 1 },
  { id: 219, recipe_id: 34, category_id: 34 },
  { id: 220, recipe_id: 34, category_id: 29 },
  { id: 221, recipe_id: 34, category_id: 33 },
  { id: 222, recipe_id: 34, category_id: 35 },
  { id: 223, recipe_id: 35, category_id: 31 },
  { id: 224, recipe_id: 35, category_id: 11 },
  { id: 225, recipe_id: 35, category_id: 29 },
  { id: 226, recipe_id: 35, category_id: 33 },
  { id: 227, recipe_id: 35, category_id: 6 },
  { id: 228, recipe_id: 35, category_id: 35 },
  { id: 229, recipe_id: 36, category_id: 24 },
  { id: 230, recipe_id: 36, category_id: 31 },
  { id: 231, recipe_id: 36, category_id: 11 },
  { id: 232, recipe_id: 36, category_id: 1 },
  { id: 233, recipe_id: 36, category_id: 25 },
  { id: 234, recipe_id: 36, category_id: 19 },
  { id: 235, recipe_id: 36, category_id: 29 },
  { id: 236, recipe_id: 36, category_id: 33 },
  { id: 237, recipe_id: 36, category_id: 28 },
  { id: 238, recipe_id: 37, category_id: 24 },
  { id: 239, recipe_id: 37, category_id: 11 },
  { id: 240, recipe_id: 37, category_id: 1 },
  { id: 241, recipe_id: 37, category_id: 17 },
  { id: 242, recipe_id: 37, category_id: 25 },
  { id: 243, recipe_id: 37, category_id: 29 },
  { id: 244, recipe_id: 37, category_id: 33 },
  { id: 245, recipe_id: 38, category_id: 11 },
  { id: 246, recipe_id: 38, category_id: 1 },
  { id: 247, recipe_id: 38, category_id: 29 },
  { id: 248, recipe_id: 38, category_id: 33 },
  { id: 249, recipe_id: 38, category_id: 16 },
  { id: 250, recipe_id: 38, category_id: 35 },
  { id: 251, recipe_id: 39, category_id: 11 },
  { id: 252, recipe_id: 39, category_id: 1 },
  { id: 253, recipe_id: 39, category_id: 34 },
  { id: 254, recipe_id: 39, category_id: 29 },
  { id: 255, recipe_id: 39, category_id: 33 },
  { id: 256, recipe_id: 39, category_id: 28 },
  { id: 257, recipe_id: 39, category_id: 35 },
  { id: 258, recipe_id: 40, category_id: 24 },
  { id: 259, recipe_id: 40, category_id: 11 },
  { id: 260, recipe_id: 40, category_id: 1 },
  { id: 261, recipe_id: 40, category_id: 25 },
  { id: 262, recipe_id: 40, category_id: 29 },
  { id: 263, recipe_id: 40, category_id: 33 },
  { id: 264, recipe_id: 41, category_id: 11 },
  { id: 265, recipe_id: 41, category_id: 1 },
  { id: 266, recipe_id: 41, category_id: 34 },
  { id: 267, recipe_id: 41, category_id: 29 },
  { id: 268, recipe_id: 41, category_id: 33 },
  { id: 269, recipe_id: 41, category_id: 28 },
  { id: 270, recipe_id: 41, category_id: 35 },
  { id: 271, recipe_id: 42, category_id: 11 },
  { id: 272, recipe_id: 42, category_id: 1 },
  { id: 273, recipe_id: 42, category_id: 34 },
  { id: 274, recipe_id: 42, category_id: 29 },
  { id: 275, recipe_id: 42, category_id: 33 },
  { id: 276, recipe_id: 42, category_id: 28 },
  { id: 277, recipe_id: 42, category_id: 35 },
  { id: 278, recipe_id: 43, category_id: 11 },
  { id: 279, recipe_id: 43, category_id: 1 },
  { id: 280, recipe_id: 43, category_id: 34 },
  { id: 281, recipe_id: 43, category_id: 29 },
  { id: 282, recipe_id: 43, category_id: 33 },
  { id: 283, recipe_id: 43, category_id: 28 },
  { id: 284, recipe_id: 43, category_id: 35 },
  { id: 285, recipe_id: 44, category_id: 24 },
  { id: 286, recipe_id: 44, category_id: 11 },
  { id: 287, recipe_id: 44, category_id: 1 },
  { id: 288, recipe_id: 44, category_id: 25 },
  { id: 289, recipe_id: 44, category_id: 29 },
  { id: 290, recipe_id: 44, category_id: 33 },
  { id: 291, recipe_id: 45, category_id: 11 },
  { id: 292, recipe_id: 45, category_id: 1 },
  { id: 293, recipe_id: 45, category_id: 29 },
  { id: 294, recipe_id: 45, category_id: 33 },
  { id: 295, recipe_id: 45, category_id: 35 },
  { id: 296, recipe_id: 46, category_id: 24 },
  { id: 297, recipe_id: 46, category_id: 11 },
  { id: 298, recipe_id: 46, category_id: 1 },
  { id: 299, recipe_id: 46, category_id: 17 },
  { id: 300, recipe_id: 46, category_id: 25 },
  { id: 301, recipe_id: 46, category_id: 29 },
  { id: 302, recipe_id: 46, category_id: 33 },
  { id: 303, recipe_id: 46, category_id: 28 },
  { id: 304, recipe_id: 47, category_id: 24 },
  { id: 305, recipe_id: 47, category_id: 31 },
  { id: 306, recipe_id: 47, category_id: 11 },
  { id: 307, recipe_id: 47, category_id: 1 },
  { id: 308, recipe_id: 47, category_id: 25 },
  { id: 309, recipe_id: 47, category_id: 19 },
  { id: 310, recipe_id: 47, category_id: 29 },
  { id: 311, recipe_id: 47, category_id: 33 },
  { id: 312, recipe_id: 48, category_id: 31 },
  { id: 313, recipe_id: 48, category_id: 11 },
  { id: 314, recipe_id: 48, category_id: 1 },
  { id: 315, recipe_id: 48, category_id: 34 },
  { id: 316, recipe_id: 48, category_id: 29 },
  { id: 317, recipe_id: 48, category_id: 33 },
  { id: 318, recipe_id: 48, category_id: 19 },
  { id: 319, recipe_id: 48, category_id: 28 },
  { id: 320, recipe_id: 49, category_id: 11 },
  { id: 321, recipe_id: 49, category_id: 1 },
  { id: 322, recipe_id: 49, category_id: 29 },
  { id: 323, recipe_id: 49, category_id: 33 },
  { id: 324, recipe_id: 49, category_id: 35 },
  { id: 325, recipe_id: 50, category_id: 11 },
  { id: 326, recipe_id: 50, category_id: 1 },
  { id: 327, recipe_id: 50, category_id: 29 },
  { id: 328, recipe_id: 50, category_id: 33 },
  { id: 329, recipe_id: 50, category_id: 35 },
  { id: 330, recipe_id: 50, category_id: 28 },
];

async function importRecipeCategoryMap() {
  try {
    console.log('🔗 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Validate dữ liệu
    console.log('🔍 Validating data...');
    const recipeIds = [...new Set(mappingData.map(m => m.recipe_id))];
    const categoryIds = [...new Set(mappingData.map(m => m.category_id))];

    // Kiểm tra recipes tồn tại
    const recipes = await sequelize.query(`
      SELECT id FROM recipes WHERE id IN (${recipeIds.join(',')})
    `, { type: sequelize.QueryTypes.SELECT });

    const existingRecipeIds = Array.isArray(recipes) ? recipes.map(r => r.id) : [];
    const missingRecipeIds = recipeIds.filter(id => !existingRecipeIds.includes(id));
    if (missingRecipeIds.length > 0) {
      console.warn(`⚠️  Warning: ${missingRecipeIds.length} recipe IDs không tồn tại: ${missingRecipeIds.join(', ')}`);
    }

    // Kiểm tra categories tồn tại
    const categories = await sequelize.query(`
      SELECT id FROM recipe_categories WHERE id IN (${categoryIds.join(',')})
    `, { type: sequelize.QueryTypes.SELECT });

    const existingCategoryIds = Array.isArray(categories) ? categories.map(c => c.id) : [];
    const missingCategoryIds = categoryIds.filter(id => !existingCategoryIds.includes(id));
    if (missingCategoryIds.length > 0) {
      console.warn(`⚠️  Warning: ${missingCategoryIds.length} category IDs không tồn tại: ${missingCategoryIds.join(', ')}`);
    }

    // Lọc dữ liệu hợp lệ
    const validData = mappingData.filter(m => 
      existingRecipeIds.includes(m.recipe_id) && 
      existingCategoryIds.includes(m.category_id)
    );

    console.log(`✅ Valid data: ${validData.length} / ${mappingData.length} mappings\n`);

    // Xóa dữ liệu cũ
    console.log('🗑️  Deleting old data...');
    await sequelize.query(`DELETE FROM recipe_category_map`, {
      type: sequelize.QueryTypes.DELETE
    });
    console.log('✅ Old data deleted\n');

    // Import dữ liệu mới
    console.log('📥 Importing new data...');
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Sử dụng transaction để đảm bảo tính nhất quán
    const transaction = await sequelize.transaction();

    try {
      for (const item of validData) {
        try {
          await sequelize.query(`
            INSERT INTO recipe_category_map (id, recipe_id, category_id, created_at, updated_at)
            VALUES (:id, :recipe_id, :category_id, NOW(), NOW())
            ON CONFLICT (id) DO UPDATE SET
              recipe_id = EXCLUDED.recipe_id,
              category_id = EXCLUDED.category_id,
              updated_at = NOW()
          `, {
            replacements: {
              id: item.id,
              recipe_id: item.recipe_id,
              category_id: item.category_id
            },
            type: sequelize.QueryTypes.INSERT,
            transaction
          });
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push({
            id: item.id,
            recipe_id: item.recipe_id,
            category_id: item.category_id,
            error: error.message
          });
        }
      }

      await transaction.commit();
      console.log(`✅ Import completed!\n`);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    // Báo cáo kết quả
    console.log('📊 Import Summary:');
    console.log(`   ✅ Success: ${successCount} mappings`);
    console.log(`   ❌ Errors: ${errorCount} mappings`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors details:');
      errors.forEach(err => {
        console.log(`   - ID ${err.id}: Recipe ${err.recipe_id} + Category ${err.category_id} - ${err.error}`);
      });
    }

    // Kiểm tra kết quả
    const result = await sequelize.query(`
      SELECT COUNT(*) as count FROM recipe_category_map
    `, { type: sequelize.QueryTypes.SELECT });

    const count = Array.isArray(result) && result.length > 0 ? result[0].count : 0;
    console.log(`\n📈 Total mappings in database: ${count}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

importRecipeCategoryMap();
