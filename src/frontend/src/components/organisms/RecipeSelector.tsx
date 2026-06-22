import React, { useState, useEffect } from 'react';
import { useMealPlan } from '../../contexts/MealPlanContext';
import { MealType } from '../../types/mealPlan';
import recipeService from '../../services/recipeService';
import { Recipe } from '../../types/recipe';
import { toast } from 'react-toastify';

interface RecipeSelectorProps {
  onClose: () => void;
  onSelect: (recipeId: number) => void;
  date: string;
  mealType: MealType;
}

const RecipeSelector: React.FC<RecipeSelectorProps> = ({ onClose, onSelect, date, mealType }) => {
  const { addRecipeToMealPlan } = useMealPlan();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [servings, setServings] = useState(2);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoading(true);
        const response = await recipeService.getRecipes({ page: 1, limit: 50 });
        const recipesData = (response as any).data?.recipes || (response as any).recipes || [];
        setRecipes(recipesData);
      } catch (error) {
        console.error('Error fetching recipes:', error);
        toast.error('Không thể tải danh sách công thức');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipes();
  }, []);

  const filteredRecipes = recipes.filter((recipe) =>
    recipe.recipeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddRecipe = async () => {
    if (!selectedRecipe) return;

    try {
      setAdding(true);
      await addRecipeToMealPlan({
        recipeId: selectedRecipe.id,
        plannedDate: date,
        mealType,
        servings,
      });
      toast.success(`Đã thêm "${selectedRecipe.recipeName}" vào thực đơn!`);
      onSelect(selectedRecipe.id);
    } catch (error) {
      console.error('Error adding recipe:', error);
      toast.error('Không thể thêm công thức vào thực đơn');
    } finally {
      setAdding(false);
    }
  };

  const mealTypeLabels: Record<MealType, string> = {
    breakfast: 'Sáng',
    lunch: 'Trưa',
    dinner: 'Tối',
    snack: 'Phụ',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Chọn công thức</h2>
            <p className="text-sm text-gray-500">
              {new Date(date).toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}{' '}
              - {mealTypeLabels[mealType]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm công thức..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-12 text-gray-500">Không tìm thấy công thức nào</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                    selectedRecipe?.id === recipe.id
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600'
                  }`}
                >
                  {recipe.imageUrl && (
                    <img
                      src={recipe.imageUrl}
                      alt={recipe.recipeName}
                      className="w-full h-32 object-cover rounded-lg mb-2"
                    />
                  )}
                  <h3 className="font-semibold line-clamp-1">{recipe.recipeName}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>{recipe.prepTime + recipe.cookTime} phút</span>
                    <span>•</span>
                    <span>{recipe.servings} người</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {selectedRecipe && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">{selectedRecipe.recipeName}</p>
                <p className="text-sm text-gray-500">
                  Khẩu phần: {selectedRecipe.servings} người
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm">Số người:</label>
                <select
                  value={servings}
                  onChange={(e) => setServings(parseInt(e.target.value))}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                >
                  {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleAddRecipe}
                disabled={adding}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                {adding ? 'Đang thêm...' : 'Thêm vào thực đơn'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeSelector;
