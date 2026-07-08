import React from 'react'
import { Link } from 'react-router-dom'
import { MealPlanItem, MealType } from '../../types/mealPlan'
import { Plus, X, Clock } from 'lucide-react'
import { motion } from 'framer-motion'
import { easeFluid } from '../../lib/motion'

const MEAL_LABELS: Record<MealType, { icon: string; label: string; color: string }> = {
  breakfast: { icon: '🌅', label: 'Sáng', color: 'text-[#956400]' },
  lunch: { icon: '☀️', label: 'Trưa', color: 'text-[#ff4f00]' },
  dinner: { icon: '🌙', label: 'Tối', color: 'text-[#42513A]' },
  snack: { icon: '🍪', label: 'Phụ', color: 'text-[#9F2F2D]' },
}

interface MealSlotProps {
  date: string
  mealType: MealType
  items: MealPlanItem[]
  onAddClick: () => void
  onRemoveItem?: (itemId: number) => void
}

const MealSlot: React.FC<MealSlotProps> = ({ mealType, items, onAddClick, onRemoveItem }) => {
  const { icon, label, color } = MEAL_LABELS[mealType]

  const totalTime = items.reduce(
    (sum, it) => sum + ((it.recipe?.prepTime || 0) + (it.recipe?.cookTime || 0)),
    0
  )

  return (
    <div className="rounded-2xl bg-paper-light dark:bg-ink-700/40 ring-1 ring-ink-200/40 dark:ring-ink-700/40 p-1.5 transition-all duration-700 ease-[var(--ease-fluid)] hover:ring-[#ff4f00]/40">
      {/* Meal Type Header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-ink-200/40 dark:border-ink-700/40">
        <div className="flex items-center gap-1.5">
          <span className="text-xs leading-none">{icon}</span>
          <span className={`text-[11px] font-bold uppercase tracking-[0.15em] ${color}`}>{label}</span>
        </div>
        {items.length > 0 && (
          <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wide">
            {items.length} món
          </span>
        )}
      </div>

      {/* Slot Content */}
      <div className="p-2 min-h-[88px] flex flex-col gap-1.5">
        {items.length === 0 ? (
          <button
            onClick={onAddClick}
            className="flex-1 flex flex-col items-center justify-center py-3 text-ink-muted hover:text-[#ff4f00] transition-colors duration-500 ease-[var(--ease-fluid)] rounded-xl border border-dashed border-ink-200 dark:border-ink-700 hover:border-[#ff4f00] hover:bg-[#fff4ed]/40 dark:hover:bg-[#ff4f00]/10"
          >
            <Plus className="w-4 h-4 mb-0.5" strokeWidth={1.5} />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Thêm món</span>
          </button>
        ) : (
          <>
            <div className="space-y-1.5">
              {items.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: easeFluid, delay: idx * 0.04 }}
                  className="group relative"
                >
                  <Link
                    to={`/recipes/${item.recipeId}`}
                    className="block p-1.5 bg-white dark:bg-ink-800 rounded-xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 hover:ring-[#ff4f00] transition-all duration-500 ease-[var(--ease-fluid)]"
                  >
                    {item.recipe?.imageUrl ? (
                      <img
                        src={item.recipe.imageUrl}
                        alt={item.recipe?.recipeName}
                        className="w-full h-9 object-cover rounded-lg mb-1"
                      />
                    ) : (
                      <div className="w-full h-9 rounded-lg mb-1 bg-paper-light dark:bg-ink-700 flex items-center justify-center text-base">
                        {icon}
                      </div>
                    )}
                    <p className="text-[11px] font-semibold text-ink-primary dark:text-paper-light line-clamp-2 leading-tight">
                      {item.recipe?.recipeName || 'Món ăn'}
                    </p>
                    <div className="flex items-center justify-between mt-0.5 text-[10px] text-ink-muted">
                      <span>{item.servings} người</span>
                      {((item.recipe?.prepTime || 0) + (item.recipe?.cookTime || 0)) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                          {(item.recipe?.prepTime || 0) + (item.recipe?.cookTime || 0)}p
                        </span>
                      )}
                    </div>
                  </Link>
                  {onRemoveItem && (
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onRemoveItem(item.id)
                      }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white dark:bg-ink-800 ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-secondary hover:text-[#9F2F2D] hover:ring-[#9F2F2D] opacity-0 group-hover:opacity-100 transition-all duration-500 ease-[var(--ease-fluid)] flex items-center justify-center"
                      title="Xóa món"
                    >
                      <X className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
            {totalTime > 0 && (
              <div className="text-[10px] text-center text-ink-muted font-medium uppercase tracking-wide">
                ~{totalTime} phút nấu
              </div>
            )}
            <button
              onClick={onAddClick}
              className="w-full py-1 text-[10px] font-semibold uppercase tracking-wide text-[#ff4f00] hover:bg-[#fff4ed] dark:hover:bg-[#ff4f00]/10 rounded-lg transition-colors duration-500 ease-[var(--ease-fluid)] flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" strokeWidth={1.5} />
              Thêm món
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default MealSlot