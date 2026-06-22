import { Op, QueryTypes } from 'sequelize';
import { Ingredient, PendingIngredient, Recipe, RecipeIngredient, RecipeReview, RecipeCategory, RecipeCategoryMap, sequelize } from '../models';
import { normalizeText } from '../utils/stringUtils';

interface KeywordSearchParams {
  keyword?: string;
  difficulty?: string[];
  minTime?: number;
  maxTime?: number;
  servings?: number;
  cuisine?: string; // Single cuisine filter
  course?: string; // Single course filter
  tags?: string[]; // Multiple tags filter
  limit?: number;
  page?: number;
}

interface IngredientSearchParams {
  ingredients: string[];
  excludeIngredients?: string[];  // Nguyên liệu cần loại trừ
  difficulty?: string[];
  prepTimeMax?: number;
  cookTimeMax?: number;
  servingsMin?: number;
  servingsMax?: number;
  minMatchPercentage?: number;
  cuisine?: string; // Single cuisine filter
  course?: string; // Single course filter
  tags?: string[]; // Multiple tags filter
  page?: number;
  limit?: number;
}

class RecipeSearchService {
  private readonly DEFAULT_PAGE_SIZE = 12;

  async searchByKeyword(params: KeywordSearchParams): Promise<any> {
    const {
      keyword = '',
      difficulty,
      minTime,
      maxTime,
      servings,
      cuisine,
      course,
      tags,
      limit = this.DEFAULT_PAGE_SIZE,
      page = 1,
    } = params;

    const normalizedKeyword = normalizeText(keyword);
    const whereClause: any = {
      status: 'visible',
    };

    if (difficulty && difficulty.length > 0) {
      whereClause.difficulty = {
        [Op.in]: difficulty,
      };
    }

    if (servings) {
      whereClause.servings = servings;
    }

    if (minTime || maxTime) {
      whereClause.cookTime = {};
      if (minTime) {
        whereClause.cookTime[Op.gte] = minTime;
      }
      if (maxTime) {
        whereClause.cookTime[Op.lte] = maxTime;
      }
    }

    const keywordConditions: any[] = [];
    if (normalizedKeyword) {
      // Chỉ tìm trong recipeName khi search theo keyword (tên món)
      // Không tìm trong description để tránh match sai
      keywordConditions.push({
        recipeName: {
          [Op.iLike]: `%${keyword}%`, // iLike = case-insensitive LIKE
        },
      });
    }

    if (keywordConditions.length > 0) {
      whereClause[Op.or] = keywordConditions;
    }

    const offset = (page - 1) * limit;

    // Build category filter includes
    // Note: cuisine, course, and tags are mutually exclusive filters
    // Each recipe should match the specified cuisine OR course OR tags
    const categoryIncludes: any[] = [];
    
    if (cuisine) {
      // Filter by single cuisine
      categoryIncludes.push({
        model: RecipeCategory,
        as: 'categories',
        through: {
          attributes: [],
        },
        where: {
          categoryType: 'cuisine',
          categoryName: cuisine,
        },
        required: true,
      });
    } else if (course) {
      // Filter by single course
      categoryIncludes.push({
        model: RecipeCategory,
        as: 'categories',
        through: {
          attributes: [],
        },
        where: {
          categoryType: 'course',
          categoryName: course,
        },
        required: true,
      });
    } else if (tags && tags.length > 0) {
      // Filter by tags (can be multiple)
      categoryIncludes.push({
        model: RecipeCategory,
        as: 'categories',
        through: {
          attributes: [],
        },
        where: {
          categoryType: 'tag',
          categoryName: { [Op.in]: tags },
        },
        required: true,
      });
    }

    // Query recipes without aggregation để tránh PostgreSQL compatibility issues
    const { count, rows } = await Recipe.findAndCountAll({
      where: whereClause,
      limit,
      offset,
      include: [
        {
          model: RecipeReview,
          as: 'reviews',
          where: {
            isActive: true,
          },
          required: false,
        },
        {
          model: RecipeCategory,
          as: 'categories',
          attributes: ['id', 'categoryName', 'categoryType'],
          through: { attributes: [] },
          required: false,
        },
        ...categoryIncludes,
      ],
      order: [
        ['createdAt', 'DESC'],
      ],
      distinct: true,
    });

    // Tính toán rating stats cho mỗi recipe
    const recipesWithStats = await Promise.all(
      rows.map(async (recipe) => {
        const recipeData = recipe.toJSON ? recipe.toJSON() : recipe;
        const reviews = (recipeData as any).reviews || [];
        
        const avgRating = reviews.length > 0
          ? reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / reviews.length
          : 0;
        const reviewCount = reviews.length;

        const categories = (recipeData as any).categories || [];
        
        return {
          ...recipeData,
          averageRating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
          reviewCount,
          categories: categories.map((cat: any) => ({
            id: cat.id,
            categoryName: cat.categoryName,
            categoryType: cat.categoryType
          })),
          reviews: undefined, // Remove reviews from response
        };
      })
    );

    // Sort lại theo rating
    recipesWithStats.sort((a, b) => {
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });

    const totalItems = Array.isArray(count)
      ? count.length
      : typeof count === 'number'
      ? count
      : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return {
      recipes: recipesWithStats,
      pagination: {
        page,
        limit,
        total: totalItems,
        totalPages,
      },
      filtersApplied: {
        keyword,
        difficulty,
        minTime,
        maxTime,
        servings,
      },
    };
  }

  async searchByIngredients(params: IngredientSearchParams) {
    const {
      ingredients,
      excludeIngredients = [],
      difficulty,
      prepTimeMax,
      cookTimeMax,
      servingsMin,
      servingsMax,
      minMatchPercentage = 50,
      cuisine,
      course,
      tags,
      limit = this.DEFAULT_PAGE_SIZE,
      page = 1,
    } = params;
    
    console.log('🚫 [SEARCH] Exclude ingredients input:', excludeIngredients);

    if (!ingredients || ingredients.length === 0) {
      return {
        recipes: [],
        missingIngredients: [],
        matchedIngredients: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
        searchTerms: [],
      };
    }

    // Step 1: Normalize và tìm ingredients
    const normalizedSearchTerms = Array.from(
      new Set(
        ingredients
          .map((ing) => normalizeText(ing))
          .filter((item) => item.length > 0),
      ),
    );

    const allIngredients = await Ingredient.findAll({
      attributes: ['id', 'ingredientName', 'categoryId'],
    });

    const ingredientLookup = new Map<string, { id: number; name: string; categoryId: number | null }>();
    allIngredients.forEach((ingredient) => {
      ingredientLookup.set(normalizeText(ingredient.ingredientName), {
        id: ingredient.id,
        name: ingredient.ingredientName,
        categoryId: ingredient.getDataValue('categoryId') || null,
      });
    });

    // ===== MỞ RỘNG EXCLUDE INGREDIENTS THÀNH IDS BẰNG CÙNG LOGIC GOM NHÓM =====
    // VD: "gừng" → ["Gừng", "Gừng tươi", "Gừng băm"] → [id1, id2, id3]
    const excludeIngredientIds = new Set<number>();
    const excludeIngredientNames: string[] = []; // Để log ra
    
    for (const excludeTerm of excludeIngredients) {
      const termLower = excludeTerm.toLowerCase().trim();
      const termNormalized = normalizeText(excludeTerm);
      
      if (!termLower) continue;
      
      // Tìm tất cả nguyên liệu match với từ khóa exclude (dùng cùng logic với include)
      for (const [normalizedName, ingredient] of ingredientLookup) {
        const originalName = ingredient.name;
        const originalLower = originalName.toLowerCase();
        
        // === QUAN TRỌNG: Giữ nguyên cụm từ, không tách ===
        let hasMatch = false;
        
        // Check 1: Tên bắt đầu bằng từ khóa
        if (originalLower.startsWith(termLower + ' ') || originalLower.startsWith(termLower)) {
          hasMatch = true;
        }
        
        // Check 2: Tên chứa từ khóa như một cụm từ riêng biệt
        if (!hasMatch && (originalLower.includes(' ' + termLower + ' ') || 
            originalLower.includes(' ' + termLower) ||
            originalLower.endsWith(' ' + termLower))) {
          hasMatch = true;
        }
        
        // Check 3: Exact match
        if (!hasMatch && originalLower === termLower) {
          hasMatch = true;
        }
        
        // Check 4: Nếu từ khóa chỉ có 1 từ, kiểm tra word match
        if (!hasMatch) {
          const termWords = termLower.split(/\s+/).filter(w => w.length > 0);
          if (termWords.length === 1) {
            const singleTerm = termWords[0];
            const nameWords = originalLower.split(/[\s,\-\/]+/).filter(w => w.length > 0);
            hasMatch = nameWords.some(nameWord => nameWord === singleTerm);
          }
        }
        
        // Check 5: Normalized version (cho từ khóa 1 từ)
        if (!hasMatch) {
          const normalizedTermWords = termNormalized.split(/\s+/).filter(w => w.length > 0);
          if (normalizedTermWords.length === 1) {
            const singleNormTerm = normalizedTermWords[0];
            const normalizedNameWords = normalizedName.split(/[\s,\-\/]+/).filter(w => w.length > 0);
            hasMatch = normalizedNameWords.some(nnWord => nnWord === singleNormTerm);
          }
        }
        
        if (hasMatch) {
          excludeIngredientIds.add(ingredient.id);
          excludeIngredientNames.push(ingredient.name);
        }
      }
    }
    
    console.log(`🚫 [SEARCH] Expanded exclude IDs: [${Array.from(excludeIngredientIds).join(', ')}]`);
    console.log(`🚫 [SEARCH] Exclude ingredients names: ${excludeIngredientNames.join(', ')}`);
    // ==========================================================================

    // Gom các nguyên liệu match thành các nhóm theo từ khóa
    // VD: "bún" → nhóm chứa [Bún, Bún bò Huế, Bún tươi]
    // Công thức thỏa mãn nếu có ÍT NHẤT 1 nguyên liệu từ mỗi nhóm
    const ingredientGroups: Array<{
      searchTerm: string;
      ingredientIds: number[];
      ingredientNames: string[];
      categoryId: number | null;  // Category chính của nhóm
    }> = [];
    
    const matchedIngredients: Array<{ id: number; name: string }> = [];
    const matchedIngredientIds = new Set<number>();
    const missingIngredients: string[] = [];
    
    // Helper: Xác định category chính dựa trên nguyên liệu PREFIX MATCH
    // VD: "gạo" → "Gạo", "Gạo nếp" bắt đầu bằng "gạo" → lấy category của chúng
    // Không lấy "Giấm gạo" vì không bắt đầu bằng "gạo"
    const determinePrimaryCategory = (
      searchTerm: string,
      matchedItems: Array<{ id: number; name: string; categoryId: number | null }>
    ): number | null => {
      const termLower = searchTerm.toLowerCase().trim();
      
      // Bước 1: Tìm nguyên liệu BẮT ĐẦU bằng từ khóa (prefix match)
      const prefixMatches = matchedItems.filter(item => 
        item.name.toLowerCase().startsWith(termLower)
      );
      
      if (prefixMatches.length > 0) {
        // Đếm số lượng nguyên liệu theo category
        const categoryCount = new Map<number, number>();
        prefixMatches.forEach(item => {
          if (item.categoryId) {
            categoryCount.set(item.categoryId, (categoryCount.get(item.categoryId) || 0) + 1);
          }
        });
        
        // Trả về category có nhiều nguyên liệu prefix match nhất
        let maxCount = 0;
        let primaryCategory: number | null = null;
        categoryCount.forEach((count, catId) => {
          if (count > maxCount) {
            maxCount = count;
            primaryCategory = catId;
          }
        });
        
        return primaryCategory;
      }
      
      // Bước 2: Nếu không có prefix match, tìm nguyên liệu có tên ngắn nhất
      if (matchedItems.length > 0) {
        const shortestItem = matchedItems.reduce((a, b) => 
          a.name.length < b.name.length ? a : b
        );
        return shortestItem.categoryId;
      }
      
      return null;
    };

    // Helper function: kiểm tra từ khóa có match với tên nguyên liệu
    // VD: "bánh mì" match "Bánh mì", "Bánh mì baguette" nhưng KHÔNG match "Bánh tráng" hay "Mì Quảng"
    // VD: "gà" match "Thịt gà", "Đùi gà" nhưng KHÔNG match "gạo", "gan"
    const isWordMatch = (ingredientName: string, searchTerm: string, useOriginal: boolean): boolean => {
      const nameLower = ingredientName.toLowerCase().trim();
      const termLower = searchTerm.toLowerCase().trim();
      
      // Exact match toàn bộ tên
      if (nameLower === termLower) return true;
      
      // Tách tên nguyên liệu thành các từ
      const nameWords = nameLower.split(/[\s,\-\/]+/).filter(w => w.length > 0);
      
      // Tách từ khóa thành các từ
      const termWords = termLower.split(/\s+/).filter(w => w.length > 0);
      
      if (termWords.length === 1) {
        // === TỪ KHÓA ĐƠN: phải khớp chính xác với một từ trong tên ===
        // "gà" match với "gà" trong "Thịt gà", "Đùi gà", "Gà nguyên con"
        // "gà" KHÔNG match với "gan" trong "Gan heo", "Pate gan"
        const singleTerm = termWords[0];
        const hasExactWordMatch = nameWords.some(nameWord => nameWord === singleTerm);
        return hasExactWordMatch;
      } else {
        // === CỤM TỪ: tên phải CHỨA toàn bộ cụm từ ===
        // "bánh mì" match "Bánh mì", "Bánh mì baguette"
        // "bánh mì" KHÔNG match "Bánh tráng", "Mì Quảng"
        
        // Check 1: Tên bắt đầu bằng cụm từ (có khoảng trắng sau hoặc hết tên)
        if (nameLower.startsWith(termLower + ' ') || nameLower === termLower) {
          return true;
        }
        
        // Check 2: Tên chứa cụm từ như một phần riêng biệt (có khoảng trắng trước/sau)
        if (nameLower.includes(' ' + termLower + ' ') || 
            nameLower.endsWith(' ' + termLower)) {
          return true;
        }
        
        return false;
      }
    };

    console.log('🔍 [SEARCH] Starting ingredient search with terms:', ingredients);
    
    for (const originalTerm of ingredients) {
      const normalizedTerm = normalizeText(originalTerm);
      
      console.log(`🔍 [SEARCH] Processing term: "${originalTerm}" (normalized: "${normalizedTerm}")`);
      
      // Bước 1: Tìm TẤT CẢ nguyên liệu match theo từ hoàn chỉnh (kèm categoryId)
      const allMatchedItems: Array<{ id: number; name: string; categoryId: number | null }> = [];
      
      for (const [normalizedName, ingredient] of ingredientLookup) {
        const originalName = ingredient.name;
        
        // Kiểm tra match theo từ hoàn chỉnh
        const hasWordMatch = isWordMatch(originalName, originalTerm, true);
        const normalizedIngredientName = normalizeText(originalName);
        const hasNormalizedWordMatch = isWordMatch(normalizedIngredientName, normalizedTerm, false);
        
        if (hasWordMatch || hasNormalizedWordMatch) {
          allMatchedItems.push({
            id: ingredient.id,
            name: ingredient.name,
            categoryId: ingredient.categoryId,
          });
        }
      }
      
      if (allMatchedItems.length === 0) {
        // Không tìm thấy nguyên liệu nào match với từ khóa này
        missingIngredients.push(originalTerm);
        await this.queuePendingIngredient(originalTerm);
        continue;
      }
      
      // Bước 2: Xác định Category chính (dựa trên prefix match)
      const primaryCategoryId = determinePrimaryCategory(originalTerm, allMatchedItems);
      console.log(`  📁 Primary category for "${originalTerm}": ${primaryCategoryId}`);
      
      // Bước 3: Lọc chỉ giữ nguyên liệu cùng category (nếu có category chính)
      let filteredItems = allMatchedItems;
      if (primaryCategoryId !== null) {
        filteredItems = allMatchedItems.filter(item => item.categoryId === primaryCategoryId);
        console.log(`  🔍 Filtered from ${allMatchedItems.length} to ${filteredItems.length} items (category ${primaryCategoryId})`);
        
        // Log các nguyên liệu bị loại
        const excludedItems = allMatchedItems.filter(item => item.categoryId !== primaryCategoryId);
        if (excludedItems.length > 0) {
          console.log(`  ❌ Excluded (wrong category): ${excludedItems.map(i => `${i.name}(cat:${i.categoryId})`).join(', ')}`);
        }
      }
      
      // Bước 4: Lọc bỏ các nguyên liệu user đã exclude (so sánh bằng ID)
      const finalItems = filteredItems.filter(item => 
        !excludeIngredientIds.has(item.id)
      );
      
      if (finalItems.length < filteredItems.length) {
        const excludedByUser = filteredItems.filter(item => 
          excludeIngredientIds.has(item.id)
        );
        console.log(`  🚫 Excluded by user (ID match): ${excludedByUser.map(i => `${i.name}(${i.id})`).join(', ')}`);
      }
      
      // Bước 5: Thêm vào kết quả
      const groupIngredientIds = finalItems.map(item => item.id);
      const groupIngredientNames = finalItems.map(item => item.name);
      
      finalItems.forEach(item => {
        console.log(`  ✅ MATCH: "${item.name}" (category: ${item.categoryId})`);
        if (!matchedIngredientIds.has(item.id)) {
          matchedIngredientIds.add(item.id);
          matchedIngredients.push({ id: item.id, name: item.name });
        }
      });
      
      if (groupIngredientIds.length > 0) {
        ingredientGroups.push({
          searchTerm: originalTerm,
          ingredientIds: groupIngredientIds,
          ingredientNames: groupIngredientNames,
          categoryId: primaryCategoryId,
        });
      }
    }

    if (ingredientGroups.length === 0) {
      return {
        recipes: [],
        missingIngredients,
        matchedIngredients: [],
        pagination: {
          page: 1,
          limit,
          total: 0,
          totalPages: 0,
        },
        searchTerms: normalizedSearchTerms,
      };
    }

    // Số nhóm từ khóa cần thỏa mãn (mỗi nhóm cần có ít nhất 1 nguyên liệu match)
    const totalGroups = ingredientGroups.length;
    const minGroupsToMatch = Math.max(1, Math.ceil((totalGroups * minMatchPercentage) / 100));
    const ingredientIdsArray = Array.from(matchedIngredientIds);
    const offset = (page - 1) * limit;

    // Step 2: Build where clause sử dụng Sequelize
    const whereClause: any = {
      status: 'visible',
    };

    if (difficulty && difficulty.length > 0) {
      whereClause.difficulty = {
        [Op.in]: difficulty,
      };
    }

    if (prepTimeMax !== undefined) {
      whereClause.prepTime = {
        [Op.lte]: prepTimeMax,
      };
    }

    if (cookTimeMax !== undefined) {
      whereClause.cookTime = {
        [Op.lte]: cookTimeMax,
      };
    }

    if (servingsMin !== undefined) {
      whereClause.servings = {
        ...whereClause.servings,
        [Op.gte]: servingsMin,
      };
    }

    if (servingsMax !== undefined) {
      whereClause.servings = {
        ...whereClause.servings,
        [Op.lte]: servingsMax,
      };
    }

    // Step 3: Build includes cho categories
    const categoryIncludes: any[] = [];
    if (cuisine) {
      categoryIncludes.push({
        model: RecipeCategory,
        as: 'categories',
        where: {
          categoryType: 'cuisine',
          categoryName: cuisine,
        },
        through: {
          attributes: [],
        },
        required: true,
      });
    }

    if (course) {
      categoryIncludes.push({
        model: RecipeCategory,
        as: 'categories',
        where: {
          categoryType: 'course',
          categoryName: course,
        },
        through: {
          attributes: [],
        },
        required: true,
      });
    }

    if (tags && tags.length > 0) {
      categoryIncludes.push({
        model: RecipeCategory,
        as: 'categories',
        where: {
          categoryType: 'tag',
          categoryName: {
            [Op.in]: tags,
          },
        },
        through: {
          attributes: [],
        },
        required: true,
      });
    }

    // Step 4: Tìm tất cả recipes có chứa ingredients sử dụng Sequelize ORM thuần túy
    const allRecipes = await Recipe.findAll({
      where: whereClause,
      include: [
        {
          model: Ingredient,
          as: 'ingredients',
          where: {
            id: {
              [Op.in]: ingredientIdsArray,
            },
          },
          through: {
            attributes: [],
          },
          required: true,
        },
        {
          model: RecipeCategory,
          as: 'categories',
          attributes: ['id', 'categoryName', 'categoryType'],
          through: { attributes: [] },
          required: false,
        },
        ...categoryIncludes,
      ],
      attributes: ['id', 'recipeName', 'description', 'imageUrl', 'prepTime', 'cookTime', 'servings', 'difficulty', 'createdAt'],
    });

    // Step 5: Tính toán số nhóm thỏa mãn và stats cho mỗi recipe
    // Một nhóm thỏa mãn nếu recipe có ÍT NHẤT 1 nguyên liệu từ nhóm đó
    // VD: Nhóm "bún" = [Bún, Bún bò Huế, Bún tươi] 
    //     → Recipe có "Bún bò Huế" thì nhóm này thỏa mãn
    const recipesWithStats = await Promise.all(
      allRecipes.map(async (recipe) => {
        // Lấy tất cả ingredients của recipe (từ query - chỉ chứa những ingredient đã match)
        const recipeData = recipe.toJSON ? recipe.toJSON() : recipe;
        const matchedRecipeIngredients = (recipeData as any).ingredients || [];
        const matchedRecipeIngredientIds = new Set(matchedRecipeIngredients.map((ing: any) => ing.id));
        
        // === QUERY TẤT CẢ INGREDIENTS CỦA RECIPE ĐỂ CHECK EXCLUDE ===
        // Vì query ở trên chỉ join với ingredients đã match, cần query riêng để lấy TẤT CẢ
        const allRecipeIngredients = await RecipeIngredient.findAll({
          where: { recipeId: recipe.id },
          attributes: ['ingredientId'],
          raw: true,
        });
        const allRecipeIngredientIds = new Set(allRecipeIngredients.map((ri: any) => ri.ingredientId));
        
        // === KIỂM TRA EXCLUDE: Nếu recipe có bất kỳ nguyên liệu nào trong excludeIngredientIds thì skip ===
        const hasExcludedIngredient = Array.from(allRecipeIngredientIds).some(id => excludeIngredientIds.has(id as number));
        if (hasExcludedIngredient) {
          console.log(`  🚫 EXCLUDED RECIPE: "${recipeData.recipeName}" (has excluded ingredient)`);
          return null; // Mark để loại bỏ sau
        }
        
        // Đếm số nhóm từ khóa được thỏa mãn
        let matchedGroupCount = 0;
        const matchedGroups: string[] = [];
        
        for (const group of ingredientGroups) {
          // Kiểm tra xem recipe có ít nhất 1 nguyên liệu từ nhóm này không
          const hasAnyFromGroup = group.ingredientIds.some(id => matchedRecipeIngredientIds.has(id));
          if (hasAnyFromGroup) {
            matchedGroupCount++;
            matchedGroups.push(group.searchTerm);
          }
        }
        
        // Đếm số nguyên liệu cụ thể match (để hiển thị)
        const matchedIngredientCount = Array.from(matchedRecipeIngredientIds).filter((id) =>
          ingredientIdsArray.includes(id as number)
        ).length;
        
        const totalIngredients = allRecipeIngredientIds.size;

        // Lấy rating stats sử dụng Sequelize
        const reviewStats = await RecipeReview.findAll({
          where: {
            recipeId: recipe.id,
            isActive: true,
          },
          attributes: [
            [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount'],
          ],
          raw: true,
        }) as any[];

        const avgRating = reviewStats[0]?.avgRating ? Number(reviewStats[0].avgRating) : 0;
        const reviewCount = reviewStats[0]?.reviewCount ? Number(reviewStats[0].reviewCount) : 0;

        return {
          recipe,
          matchedGroupCount,        // Số nhóm từ khóa thỏa mãn
          matchedGroups,            // Tên các nhóm từ khóa đã match
          matchedIngredientCount,   // Số nguyên liệu cụ thể match (để hiển thị)
          totalIngredients,
          averageRating: avgRating,
          reviewCount,
        };
      })
    );

    // Step 6: Filter theo số nhóm thỏa mãn (minGroupsToMatch) và loại bỏ recipe có exclude ingredients
    // Recipe phải thỏa mãn ít nhất minGroupsToMatch nhóm từ khóa
    const filteredRecipes = recipesWithStats.filter(
      (item) => item !== null && item.matchedGroupCount >= minGroupsToMatch
    ) as NonNullable<typeof recipesWithStats[0]>[];

    // Step 7: Sort - ưu tiên theo số nhóm match, rồi đến số nguyên liệu, rồi rating
    filteredRecipes.sort((a, b) => {
      // Ưu tiên recipe thỏa mãn nhiều nhóm từ khóa hơn
      if (b.matchedGroupCount !== a.matchedGroupCount) {
        return b.matchedGroupCount - a.matchedGroupCount;
      }
      // Sau đó ưu tiên recipe có nhiều nguyên liệu match hơn
      if (b.matchedIngredientCount !== a.matchedIngredientCount) {
        return b.matchedIngredientCount - a.matchedIngredientCount;
      }
      // Sau đó ưu tiên rating cao hơn
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }
      return a.recipe.cookTime - b.recipe.cookTime;
    });

    // Step 8: Paginate
    const total = filteredRecipes.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedRecipes = filteredRecipes.slice(offset, offset + limit);

    // Step 9: Format results
    const formattedRecipes = paginatedRecipes.map((item) => {
      const recipeData = item.recipe.toJSON ? item.recipe.toJSON() : item.recipe;
      const categories = (recipeData as any).categories || [];
      
      return {
        id: recipeData.id,
        recipeName: recipeData.recipeName,
        description: recipeData.description,
        imageUrl: recipeData.imageUrl,
        prepTime: recipeData.prepTime,
        cookTime: recipeData.cookTime,
        servings: recipeData.servings,
        difficulty: recipeData.difficulty,
        createdAt: recipeData.createdAt instanceof Date 
          ? recipeData.createdAt.toISOString() 
          : recipeData.createdAt,
        categories: categories.map((cat: any) => ({
          id: cat.id,
          categoryName: cat.categoryName,
          categoryType: cat.categoryType
        })),
        matchedCount: item.matchedIngredientCount,   // Số nguyên liệu cụ thể match (backward compat)
        matchedGroupCount: item.matchedGroupCount,   // Số nhóm từ khóa thỏa mãn
        matchedGroups: item.matchedGroups,           // Tên các nhóm từ khóa đã match
        totalGroups: ingredientGroups.length,        // Tổng số nhóm từ khóa tìm kiếm
        totalIngredients: item.totalIngredients,
        averageRating: item.averageRating,
        reviewCount: item.reviewCount,
        // Tính độ phù hợp dựa trên số nhóm từ khóa match / tổng số nhóm từ khóa nhập vào
        matchPercent: ingredientGroups.length > 0 
          ? Math.round((item.matchedGroupCount / ingredientGroups.length) * 100) 
          : 0,
      };
    });

    // Step 7: Nếu không có kết quả, trả về suggestions
    if (formattedRecipes.length === 0) {
      const suggestions = await Recipe.findAll({
        where: { status: 'visible' },
        limit: 5,
        order: [
          ['difficulty', 'ASC'],
          ['prepTime', 'ASC'],
        ],
      });

      return {
        recipes: [],
        suggestions,
        missingIngredients,
        matchedIngredients,
        searchTerms: normalizedSearchTerms,
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    return {
      recipes: formattedRecipes,
      missingIngredients,
      matchedIngredients,
      searchTerms: normalizedSearchTerms,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  private async queuePendingIngredient(name: string) {
    const normalizedName = normalizeText(name);
    if (!normalizedName) {
      return;
    }

    const existing = await PendingIngredient.findOne({
      where: {
        ingredientName: name,
        status: 'pending',
      },
    });

    if (existing) {
      return;
    }

    await PendingIngredient.create({
      ingredientName: name,
      categoryId: 1,
      submittedBy: 1,
      status: 'pending',
    });
  }
}

export default new RecipeSearchService();

