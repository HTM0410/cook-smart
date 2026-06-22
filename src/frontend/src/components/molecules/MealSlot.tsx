import React from 'react'
import { Link } from 'react-router-dom'
import { MealPlanItem, MealType } from '../../types/mealPlan'
import { Plus } from 'lucide-react'

interface MealSlotProps {
  date: string
  mealType: MealType
  items: MealPlanItem[]
  onAddClick: () => void
}

const MealSlot: React.FC<MealSlotProps> = ({ mealType, items, onAddClick }) => {
  return (
    <div className="min-h-[100px] rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 p-2 transition-all hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/10">
      {items.length === 0 ? (
        <button
          onClick={onAddClick}
          className="w-full h-full min-h-[80px] flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50"
        >
          <Plus className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-semibold">Thêm</span>
        </button>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="group relative">
              <Link
                to={`/recipes/${item.recipeId}`}
                className="block p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm hover:shadow-md hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800 transition-all"
              >
                {item.recipe?.imageUrl && (
                  <img
                    src={item.recipe.imageUrl}
                    alt={item.recipe?.recipeName}
                    className="w-full h-10 object-cover rounded-md mb-1.5"
                  />
                )}
                <p className="text-[11px] font-bold text-gray-800 dark:text-gray-200 line-clamp-2 leading-tight">
                  {item.recipe?.recipeName}
                </p>
                <span className="text-[10px] text-gray-400">{item.servings} người</span>
              </Link>
            </div>
          ))}
          <button
            onClick={onAddClick}
            className="w-full py-1 text-[11px] font-semibold text-primary-500 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Thêm
          </button>
        </div>
      )}
    </div>
  )
}

export default MealSlot
