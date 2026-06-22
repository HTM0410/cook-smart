import React, { useState, useEffect } from 'react';
import { Check, RotateCcw } from 'lucide-react';

interface Ingredient {
  ingredientName?: string;
  name?: string;
  quantity?: string | number;
  unit?: string;
  RecipeIngredient?: {
    quantity: string | number;
    unit: string;
  };
  ingredient?: {
    ingredientName: string;
  };
}

interface IngredientChecklistProps {
  recipeId: number;
  ingredients: Ingredient[];
  searchedIngredients?: string[]; // Nguyên liệu đã tìm kiếm
}

const IngredientChecklist: React.FC<IngredientChecklistProps> = ({ 
  recipeId, 
  ingredients,
  searchedIngredients = []
}) => {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());

  // Load checked state from localStorage + auto-check searched ingredients
  useEffect(() => {
    const saved = localStorage.getItem(`recipe-${recipeId}-checklist`);
    let initialChecked = new Set<number>();
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        initialChecked = new Set(parsed);
      } catch (e) {
        console.error('Error loading checklist:', e);
      }
    }

    // Auto-check searched ingredients
    if (searchedIngredients.length > 0) {
      ingredients.forEach((item, index) => {
        const ingredientName = (
          item.ingredientName || 
          item.ingredient?.ingredientName || 
          item.name || 
          ''
        ).toLowerCase();
        
        const isSearched = searchedIngredients.some(searched => 
          ingredientName.includes(searched.toLowerCase()) || 
          searched.toLowerCase().includes(ingredientName)
        );
        
        if (isSearched) {
          initialChecked.add(index);
        }
      });
    }
    
    setCheckedItems(initialChecked);
  }, [recipeId, searchedIngredients, ingredients]);

  // Save checked state to localStorage
  useEffect(() => {
    localStorage.setItem(`recipe-${recipeId}-checklist`, JSON.stringify([...checkedItems]));
  }, [checkedItems, recipeId]);

  const toggleCheck = (index: number) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const checkAll = () => {
    setCheckedItems(new Set(ingredients.map((_, i) => i)));
  };

  const resetAll = () => {
    setCheckedItems(new Set());
  };

  const checkedCount = checkedItems.size;
  const totalCount = ingredients.length;
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Nguyên liệu
            </h3>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {checkedCount}/{totalCount}
            </span>
          </div>
          {/* Progress Bar */}
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={checkAll}
          disabled={checkedCount === totalCount}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-3 h-3" />
          <span>Tất cả</span>
        </button>
        <button
          onClick={resetAll}
          disabled={checkedCount === 0}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Đặt lại</span>
        </button>
      </div>

      {/* Ingredient List */}
      <div className="space-y-2">
        {ingredients.map((ingredient, index) => {
          const name = ingredient.ingredientName || ingredient.ingredient?.ingredientName || ingredient.name || 'Unknown';
          
          let quantity: string | number = '1';
          let unit: string = '';
          
          if (ingredient.RecipeIngredient) {
            quantity = String(ingredient.RecipeIngredient.quantity || '1');
            unit = String(ingredient.RecipeIngredient.unit || '');
          } else if (ingredient.quantity) {
            quantity = String(ingredient.quantity);
            unit = String(ingredient.unit || '');
          }
          
          // Format quantity: bỏ .00 nếu là số nguyên
          const formatQuantity = (q: string | number): string => {
            const num = parseFloat(String(q));
            if (isNaN(num)) return String(q);
            // Nếu là số nguyên, bỏ phần thập phân
            if (num % 1 === 0) return num.toFixed(0);
            // Nếu có 1 chữ số thập phân và là .0, bỏ đi
            const fixed1 = num.toFixed(1);
            if (fixed1.endsWith('.0')) return num.toFixed(0);
            // Nếu có 2 chữ số thập phân và là .00, bỏ đi
            const fixed2 = num.toFixed(2);
            if (fixed2.endsWith('.00')) return num.toFixed(0);
            if (fixed2.endsWith('0')) return num.toFixed(1);
            return fixed2;
          };
          
          quantity = formatQuantity(quantity);

          const isChecked = checkedItems.has(index);

          return (
            <label
              key={index}
              className={`
                flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all duration-200
                ${isChecked
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : 'bg-white border-gray-200 dark:bg-gray-800 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600'
                }
              `}
            >
              {/* Custom Checkbox */}
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCheck(index)}
                  className="sr-only"
                />
                <div
                  className={`
                    w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                    ${isChecked
                      ? 'bg-green-500 border-green-500'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                    }
                  `}
                >
                  {isChecked && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </div>
              </div>

              {/* Ingredient Info */}
              <div className="flex-1 flex justify-between items-center">
                <span
                  className={`
                    font-medium transition-all duration-200
                    ${isChecked
                      ? 'text-gray-500 dark:text-gray-500 line-through'
                      : 'text-gray-800 dark:text-gray-200'
                    }
                  `}
                >
                  {name}
                </span>
                <span
                  className={`
                    text-sm transition-all duration-200
                    ${isChecked
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-600 dark:text-gray-400'
                    }
                  `}
                >
                  {quantity} {unit}
                </span>
              </div>
            </label>
          );
        })}
      </div>

      {/* Completion Message */}
      {checkedCount === totalCount && totalCount > 0 && (
        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-center">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            ✨ Đã chuẩn bị đủ nguyên liệu! Bắt đầu nấu thôi!
          </p>
        </div>
      )}
    </div>
  );
};

export default IngredientChecklist;

