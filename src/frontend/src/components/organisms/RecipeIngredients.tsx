import React, { useState, useEffect } from 'react';
import { RecipeIngredient } from '../../types/recipe';
import { Check, ShoppingCart, Package } from 'lucide-react';

interface RecipeIngredientsProps {
  ingredients: RecipeIngredient[];
  servings: number;
  onServingsChange?: (newServings: number) => void;
  searchedIngredients?: string[]; // Nguyên liệu đã tìm kiếm
}

const RecipeIngredients: React.FC<RecipeIngredientsProps> = ({
  ingredients,
  servings,
  onServingsChange,
  searchedIngredients = [],
}) => {
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [servingMultiplier, setServingMultiplier] = useState(1);

  // Auto-check searched ingredients on mount
  useEffect(() => {
    if (searchedIngredients.length > 0) {
      const initialChecked = new Set<number>();
      ingredients.forEach((ingredient) => {
        const ingredientName = (
          ingredient.ingredient?.ingredientName || 
          ingredient.ingredientName || 
          ''
        ).toLowerCase();
        const isSearched = searchedIngredients.some(searched => 
          ingredientName.includes(searched.toLowerCase()) || 
          searched.toLowerCase().includes(ingredientName)
        );
        if (isSearched) {
          initialChecked.add(ingredient.id);
        }
      });
      setCheckedIngredients(initialChecked);
    }
  }, [searchedIngredients, ingredients]);

  const handleIngredientCheck = (ingredientId: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(ingredientId)) {
      newChecked.delete(ingredientId);
    } else {
      newChecked.add(ingredientId);
    }
    setCheckedIngredients(newChecked);
  };

  const handleServingsChange = (newServings: number) => {
    if (newServings < 1) return;
    setServingMultiplier(newServings / servings);
    onServingsChange?.(newServings);
  };

  const parseQuantity = (quantity: string): { value: number; unit?: string } => {
    // Try to parse quantity like "2 cups", "1/2 tsp", "250g"
    const match = quantity.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(.*)$/);
    if (match) {
      const [, valueStr, unit] = match;
      let value = parseFloat(valueStr);
      
      // Handle fractions like "1/2"
      if (valueStr.includes('/')) {
        const [numerator, denominator] = valueStr.split('/').map(Number);
        value = numerator / denominator;
      }
      
      return { value, unit: unit || undefined };
    }
    
    // If no match, try to parse as number
    const numValue = parseFloat(quantity);
    return { value: isNaN(numValue) ? 0 : numValue };
  };

  const formatQuantity = (quantity: string, multiplier: number = 1): string => {
    const { value, unit } = parseQuantity(quantity);
    const adjustedValue = value * multiplier;
    
    // Format the adjusted value - bỏ .00 nếu là số nguyên
    let formattedValue: string;
    if (adjustedValue % 1 === 0) {
      // Số nguyên: không có phần thập phân
      formattedValue = adjustedValue.toFixed(0);
    } else if (adjustedValue < 1) {
      // Convert to fraction for small values
      const fraction = Math.round(adjustedValue * 4) / 4;
      if (fraction === 0.25) formattedValue = '1/4';
      else if (fraction === 0.5) formattedValue = '1/2';
      else if (fraction === 0.75) formattedValue = '3/4';
      else {
        // Bỏ trailing zeros
        formattedValue = adjustedValue.toFixed(2).replace(/\.?0+$/, '');
      }
    } else {
      // Bỏ trailing zeros (.0, .00)
      const fixed2 = adjustedValue.toFixed(2);
      if (fixed2.endsWith('.00')) {
        formattedValue = adjustedValue.toFixed(0);
      } else if (fixed2.endsWith('0')) {
        formattedValue = adjustedValue.toFixed(1);
      } else {
        formattedValue = fixed2;
      }
    }
    
    return unit ? `${formattedValue} ${unit}` : formattedValue;
  };

  const checkedCount = checkedIngredients.size;
  const totalCount = ingredients.length;
  const progressPercentage = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
            <ShoppingCart className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Nguyên liệu
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {checkedCount}/{totalCount} đã chuẩn bị
            </p>
          </div>
        </div>

        {/* Servings Adjuster */}
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">Khẩu phần:</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleServingsChange(servings - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
              disabled={servings <= 1}
            >
              -
            </button>
            <span className="min-w-[2rem] text-center font-medium">{servings}</span>
            <button
              onClick={() => handleServingsChange(servings + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Tiến độ chuẩn bị</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {Math.round(progressPercentage)}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Ingredients List */}
      <div className="space-y-3">
        {ingredients.map((ingredient) => {
          const isChecked = checkedIngredients.has(ingredient.id);
          const adjustedQuantity = formatQuantity(String(ingredient.quantity || '1'), servingMultiplier);
          // Lấy unit từ ingredient.unit, RecipeIngredient.unit hoặc parse từ quantity string
          const parsed = parseQuantity(String(ingredient.quantity || '1'));
          const unit = ingredient.unit || ingredient.RecipeIngredient?.unit || parsed.unit || '';

          return (
            <div
              key={ingredient.id}
              className={`group flex items-center space-x-3 rounded-lg border p-4 transition-all duration-200 ${
                isChecked
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() => handleIngredientCheck(ingredient.id)}
                className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all duration-200 ${
                  isChecked
                    ? 'border-green-500 bg-green-500 text-white'
                    : 'border-gray-300 hover:border-green-400 dark:border-gray-600 dark:hover:border-green-500'
                }`}
              >
                {isChecked && <Check className="h-4 w-4" />}
              </button>

              {/* Ingredient Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span
                    className={`font-medium transition-all duration-200 ${
                      isChecked
                        ? 'text-green-700 line-through dark:text-green-300'
                        : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {ingredient.ingredient?.ingredientName || ingredient.ingredientName || 'Unknown'}
                  </span>
                  {(ingredient.ingredient as any)?.category && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      <Package className="mr-1 h-3 w-3" />
                      {(ingredient.ingredient as any).category.categoryName}
                    </span>
                  )}
                </div>
                {ingredient.ingredient?.description && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {ingredient.ingredient.description}
                  </p>
                )}
              </div>

              {/* Quantity with Unit */}
              <div className="text-right whitespace-nowrap">
                <span
                  className={`font-semibold transition-all duration-200 ${
                    isChecked
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {adjustedQuantity}{unit ? ` ${unit}` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-4">
        <button
          onClick={() => setCheckedIngredients(new Set())}
          className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          Bỏ chọn tất cả
        </button>
        <button
          onClick={() => setCheckedIngredients(new Set(ingredients.map((ing) => ing.id)))}
          className="flex-1 rounded-lg bg-green-100 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30"
        >
          Chọn tất cả
        </button>
      </div>
    </div>
  );
};

export default RecipeIngredients;
