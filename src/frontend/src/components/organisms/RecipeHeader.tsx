import React from 'react';
import { Recipe } from '../../types/recipe';
import { Clock, Users, ChefHat, Star } from 'lucide-react';

interface RecipeHeaderProps {
  recipe: Recipe;
}

const RecipeHeader: React.FC<RecipeHeaderProps> = ({ recipe }) => {
  const totalTime = recipe.prepTime + recipe.cookTime;

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20';
      case 'hard':
        return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
      default:
        return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'Dễ';
      case 'medium':
        return 'Trung bình';
      case 'hard':
        return 'Khó';
      default:
        return difficulty;
    }
  };

  return (
    <div className="space-y-6">
      {/* Recipe Image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.recipeName}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
            width={1280}
            height={720}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 100vw, 100vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ChefHat className="h-16 w-16 text-gray-400" />
          </div>
        )}
      </div>

      {/* Recipe Title and Description */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 lg:text-4xl">
            {recipe.recipeName}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getDifficultyColor(
              recipe.difficulty
            )}`}
          >
            {getDifficultyText(recipe.difficulty)}
          </span>
        </div>

        {recipe.description && (
          <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
            {recipe.description}
          </p>
        )}
      </div>

      {/* Recipe Metadata */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Prep Time */}
        <div className="flex items-center space-x-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
            <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Chuẩn bị</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {recipe.prepTime} phút
            </p>
          </div>
        </div>

        {/* Cook Time */}
        <div className="flex items-center space-x-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20">
            <ChefHat className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nấu</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {recipe.cookTime} phút
            </p>
          </div>
        </div>

        {/* Servings */}
        <div className="flex items-center space-x-3 rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
            <Users className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Khẩu phần</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {recipe.servings} người
            </p>
          </div>
        </div>
      </div>

      {/* Total Time */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:from-blue-900/10 dark:to-indigo-900/10">
        <div className="flex items-center space-x-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
            <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Tổng thời gian</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {totalTime} phút
            </p>
          </div>
        </div>
      </div>

      {/* Match Metadata (if from search) */}
      {recipe.matchMetadata && (
        <div className="rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 p-4 dark:from-purple-900/10 dark:to-pink-900/10">
          <div className="flex items-center space-x-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
              <Star className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400">
                Độ phù hợp: {recipe.matchMetadata.matchPercentage}%
              </p>
              <p className="text-sm text-purple-500 dark:text-purple-400">
                {recipe.matchMetadata.matchedIngredientsCount}/{recipe.matchMetadata.totalIngredientsCount} nguyên liệu khớp
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeHeader;
