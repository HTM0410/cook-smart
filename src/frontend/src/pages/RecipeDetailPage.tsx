import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import recipeService from '../services/recipeService'
import {
  ArrowLeft, Clock, Users, ChefHat, Star,
  Printer, BookOpen, Tag, ListChecks, MessageSquare
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import CommentSection from '../components/organisms/CommentSection'
import RatingSection from '../components/organisms/RatingSection'
import IngredientChecklist from '../components/organisms/IngredientChecklist'
import FavoriteButton from '../components/atoms/FavoriteButton'
import RecipeShareButton from '../components/molecules/RecipeShareButton'
import RecipeSteps from '../components/organisms/RecipeSteps'
import { viewportOnce, cardReveal } from '../lib/motion'

interface RecipeIngredientItem {
  id: number
  quantity: string
  unit?: string
  ingredient?: { id: number; ingredientName: string; description?: string }
}

interface RecipeStepItem {
  id: number
  stepNumber: number
  instruction: string
  imageUrl?: string
}

interface Recipe {
  id: number
  recipeName: string
  description?: string
  prepTime: number
  cookTime: number
  servings: number
  difficulty: string
  imageUrl?: string
  ingredients?: RecipeIngredientItem[]
  steps?: RecipeStepItem[]
  categories?: { id: number; categoryName: string; categoryType: string }[]
  createdAt: string
  averageRating?: number
  reviewCount?: number
}

type Tab = 'steps' | 'ingredients' | 'reviews'

const difficultyConfig = {
  easy: { label: 'Dễ' },
  medium: { label: 'Vừa' },
  hard: { label: 'Khó' },
}

const RecipeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('steps')

  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) return
      try {
        setLoading(true)
        setError(null)
        const response = await recipeService.getRecipeById(Number(id))
        const data = (response.data as any)
        const payload = data?.data?.recipe || data?.data || data?.recipe || data
        if (!payload) { setError('Không tìm thấy công thức'); setRecipe(null); return }
        setRecipe(payload as Recipe)
      } catch (err: any) {
        setError(err?.response?.data?.message || err?.message || 'Không thể tải công thức')
      } finally {
        setLoading(false)
      }
    }
    fetchRecipe()
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#161310]">
        <div className="w-full h-[40vh] bg-[#F5F1EA] dark:bg-[#1F1B16] animate-pulse" />
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="h-10 w-2/3 bg-[#F5F1EA] dark:bg-[#1F1B16] rounded-lg animate-pulse mb-4" />
          <div className="h-5 w-full bg-[#F5F1EA] dark:bg-[#1F1B16] rounded animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#161310] flex items-center justify-center px-4">
        <div className="text-center max-w-md space-y-6">
          <p className="text-6xl font-semibold text-[#1A1814] dark:text-[#F5F1EA]">404</p>
          <p className="text-[#5C4A38] dark:text-[#8B7A66]">{error || 'Công thức không tồn tại.'}</p>
          <button
            onClick={() => navigate('/recipes')}
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[#1A1814] dark:bg-[#F5F1EA] text-white dark:text-[#1A1814] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Quay lại danh sách
          </button>
        </div>
      </div>
    )
  }

  const totalTime = recipe.prepTime + recipe.cookTime
  const diff = difficultyConfig[recipe.difficulty as keyof typeof difficultyConfig] || difficultyConfig.medium
  const avg = (recipe as any).averageRating ?? 0
  const reviews = recipe.reviewCount ?? 0

  const meta: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: Clock, label: 'Tổng', value: `${totalTime}p` },
    { icon: Users, label: 'Khẩu phần', value: `${recipe.servings}` },
    { icon: ChefHat, label: 'Độ khó', value: diff.label },
    { icon: Star, label: 'Đánh giá', value: avg > 0 ? `${avg.toFixed(1)} (${reviews})` : '—' },
  ]

  const tabs: { id: Tab; label: string; icon: React.ElementType; show: boolean; count?: number }[] = [
    { id: 'steps', label: 'Các bước', icon: BookOpen, show: !!(recipe.steps && recipe.steps.length > 0), count: recipe.steps?.length },
    { id: 'ingredients', label: 'Nguyên liệu', icon: ListChecks, show: !!(recipe.ingredients && recipe.ingredients.length > 0), count: recipe.ingredients?.length },
    { id: 'reviews', label: 'Đánh giá', icon: MessageSquare, show: true, count: reviews },
  ].filter(t => t.show) as any

  return (
    <div className="min-h-screen bg-white dark:bg-[#161310] text-[#1A1814] dark:text-[#F5F1EA]">
      {/* Top bar */}
      <div className="border-b border-[#E8DFD0]/60 dark:border-[#2A2520]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-[#5C4A38] dark:text-[#8B7A66] hover:text-[#1A1814] dark:hover:text-[#F5F1EA] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Quay lại
          </button>
          <div className="flex items-center gap-2">
            <FavoriteButton recipeId={recipe.id} initialFavoriteCount={0} initialIsFavorited={false} userId={user?.id} size="md" showCount={false} showTooltip={true} />
            <RecipeShareButton recipeId={recipe.id} recipeName={recipe.recipeName} recipeImage={recipe.imageUrl} recipeDescription={recipe.description} />
            <button
              onClick={() => window.print()}
              className="w-10 h-10 rounded-full border border-[#E8DFD0] dark:border-[#2A2520] flex items-center justify-center text-[#5C4A38] dark:text-[#8B7A66] hover:bg-[#F5F1EA] dark:hover:bg-[#1F1B16] hover:text-[#1A1814] dark:hover:text-[#F5F1EA] transition-colors"
              aria-label="In"
            >
              <Printer className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="border-b border-[#E8DFD0]/60 dark:border-[#2A2520]">
        <div className="max-w-6xl mx-auto px-6 py-10 md:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            {/* Image */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="lg:col-span-6 order-1"
            >
              {recipe.imageUrl ? (
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-[#F5F1EA] dark:bg-[#1F1B16]">
                  <img src={recipe.imageUrl} alt={recipe.recipeName} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="aspect-[4/3] rounded-2xl bg-[#F5F1EA] dark:bg-[#1F1B16] flex items-center justify-center">
                  <ChefHat className="w-14 h-14 text-[#C9B89C] dark:text-[#5C4A38]" strokeWidth={1} />
                </div>
              )}
            </motion.div>

            {/* Content */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="lg:col-span-6 order-2"
            >
              {/* categories mini */}
              {recipe.categories && recipe.categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-5">
                  {recipe.categories.map(cat => (
                    <span
                      key={cat.id}
                      className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#F5F1EA] dark:bg-[#1F1B16] text-[#5C4A38] dark:text-[#8B7A66]"
                    >
                      {cat.categoryName}
                    </span>
                  ))}
                </div>
              )}

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.1] tracking-tight text-balance">
                {recipe.recipeName}
              </h1>

              {recipe.description && (
                <p className="mt-5 text-[15px] leading-relaxed text-[#5C4A38] dark:text-[#8B7A66] text-pretty max-w-prose">
                  {recipe.description}
                </p>
              )}

              {/* meta row */}
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#E8DFD0]/60 dark:bg-[#2A2520] rounded-xl overflow-hidden border border-[#E8DFD0]/60 dark:border-[#2A2520]">
                {meta.map((m, i) => (
                  <div key={i} className="bg-white dark:bg-[#161310] px-4 py-4">
                    <div className="flex items-center gap-2 text-[#8B7A66] dark:text-[#5C4A38]">
                      <m.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span className="text-[10px] uppercase tracking-wider">{m.label}</span>
                    </div>
                    <p className="mt-2 text-lg font-semibold tabular-nums text-[#1A1814] dark:text-[#F5F1EA]">
                      {m.value}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="sticky top-0 z-20 bg-white/80 dark:bg-[#161310]/80 backdrop-blur-md border-b border-[#E8DFD0]/60 dark:border-[#2A2520]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center gap-1 overflow-x-auto -mb-px">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    tab === t.id
                      ? 'text-[#1A1814] dark:text-[#F5F1EA]'
                      : 'text-[#8B7A66] dark:text-[#5C4A38] hover:text-[#5C4A38] dark:hover:text-[#8B7A66]'
                  }`}
                >
                  <t.icon className="w-4 h-4" strokeWidth={1.5} />
                  {t.label}
                  {typeof t.count === 'number' && (
                    <span className="text-[11px] text-[#8B7A66] dark:text-[#5C4A38] tabular-nums">
                      ({t.count})
                    </span>
                  )}
                  {tab === t.id && (
                    <motion.span
                      layoutId="recipe-tab-underline"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#ff4f00] rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        {tab === 'steps' && recipe.steps && recipe.steps.length > 0 && (
          <motion.div
            key="steps"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <RecipeSteps steps={recipe.steps} />
          </motion.div>
        )}

        {tab === 'ingredients' && recipe.ingredients && recipe.ingredients.length > 0 && (
          <motion.div
            key="ingredients"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-10"
          >
            <div>
              <h3 className="text-lg font-semibold mb-4">Nguyên liệu</h3>
              <IngredientChecklist recipeId={recipe.id} ingredients={recipe.ingredients} />
            </div>
            <div className="md:pl-10 md:border-l border-[#E8DFD0]/60 dark:border-[#2A2520]">
              <h3 className="text-lg font-semibold mb-4">Ghi chú</h3>
              <p className="text-sm text-[#5C4A38] dark:text-[#8B7A66] leading-relaxed">
                Điều chỉnh khẩu phần tỷ lệ thuận với số người ăn. Nguyên liệu tươi sẽ cho hương vị tốt nhất.
              </p>
            </div>
          </motion.div>
        )}

        {tab === 'reviews' && (
          <motion.div
            key="reviews"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-10"
          >
            <div className="lg:col-span-7 space-y-10">
              <RatingSection recipeId={recipe.id} />
              <div className="border-t border-[#E8DFD0]/60 dark:border-[#2A2520] pt-10">
                <CommentSection recipeId={recipe.id} currentUserId={user?.id} initialCommentsCount={0} />
              </div>
            </div>
            <aside className="lg:col-span-5">
              <div className="lg:sticky lg:top-24 rounded-xl border border-[#E8DFD0]/60 dark:border-[#2A2520] p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= Math.round(avg) ? 'fill-[#ff4f00] text-[#ff4f00]' : 'text-[#E8DFD0] dark:text-[#2A2520]'}`}
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                  <span className="text-sm tabular-nums text-[#5C4A38] dark:text-[#8B7A66]">
                    {avg > 0 ? `${avg.toFixed(1)} / 5` : '—'}
                  </span>
                </div>
                <p className="text-sm text-[#5C4A38] dark:text-[#8B7A66]">
                  {reviews > 0 ? `${reviews} đánh giá từ cộng đồng.` : 'Chưa có đánh giá — hãy là người đầu tiên.'}
                </p>
              </div>
            </aside>
          </motion.div>
        )}
      </section>
    </div>
  )
}

export default RecipeDetailPage
