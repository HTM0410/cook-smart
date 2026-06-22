import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import recipeService from '../services/recipeService'
import {
  ArrowLeft, Clock, Users, ChefHat, Star,
  Timer, UtensilsCrossed, Tag, CheckCircle2, BookOpen, Printer
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import CommentSection from '../components/organisms/CommentSection'
import RatingSection from '../components/organisms/RatingSection'
import IngredientChecklist from '../components/organisms/IngredientChecklist'
import FavoriteButton from '../components/atoms/FavoriteButton'
import RecipeShareButton from '../components/molecules/RecipeShareButton'
import RecipeSteps from '../components/organisms/RecipeSteps'
import EmptyState from '../components/molecules/EmptyState'

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

const difficultyConfig = {
  easy: { label: 'Dễ', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', accent: 'text-green-500' },
  medium: { label: 'Vừa', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', accent: 'text-amber-500' },
  hard: { label: 'Khó', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', accent: 'text-red-500' },
}

const RecipeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isScrolled, setIsScrolled] = useState(false)
  const [activeTab, setActiveTab] = useState<'ingredients' | 'steps' | 'reviews'>('ingredients')

  const searchParams = new URLSearchParams(location.search)
  const searchedIngredients = searchParams.get('searched')
    ? searchParams.get('searched')!.split(',').map(s => s.trim()).filter(Boolean)
    : []

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 400)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full h-[50vh] skeleton" />
        <div className="container py-10">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="skeleton-title w-1/2" />
            <div className="skeleton-text w-full" />
            <div className="skeleton-text w-3/4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-6 text-5xl animate-float">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Không tìm thấy công thức</h2>
          <p className="text-gray-500 mb-6">{error || 'Công thức bạn đang tìm kiếm không tồn tại.'}</p>
          <button onClick={() => navigate('/recipes')} className="btn btn-primary btn-lg">
            <ArrowLeft className="w-5 h-5" />
            Quay lại danh sách
          </button>
        </div>
      </div>
    )
  }

  const totalTime = recipe.prepTime + recipe.cookTime
  const diff = difficultyConfig[recipe.difficulty as keyof typeof difficultyConfig] || difficultyConfig.medium

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero */}
      <div className="relative w-full h-[55vh] min-h-[420px] max-h-[600px] overflow-hidden">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.recipeName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary-100 to-amber-100 dark:from-primary-900/40 dark:to-amber-900/40 flex items-center justify-center">
            <ChefHat className="h-24 w-24 text-gray-300 dark:text-gray-600 animate-bounce-gentle" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/40 to-transparent" />

        {/* Back */}
        <div className="absolute top-5 left-5 z-20">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-2xl bg-white/10 backdrop-blur-md px-4 py-2.5 text-white hover:bg-white/20 transition-all border border-white/10 shadow-lg group"
          >
            <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
            <span className="font-semibold text-sm">Quay lại</span>
          </button>
        </div>

        {/* Actions */}
        <div className="absolute top-5 right-5 flex items-center gap-2 z-20">
          <button
            onClick={() => window.print()}
            className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
          >
            <Printer className="w-4.5 h-4.5" />
          </button>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
            <RecipeShareButton recipeId={recipe.id} recipeName={recipe.recipeName} recipeImage={recipe.imageUrl} recipeDescription={recipe.description} />
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/10">
            <FavoriteButton recipeId={recipe.id} initialFavoriteCount={0} initialIsFavorited={false} userId={user?.id} size="lg" showCount={false} showTooltip={true} />
          </div>
        </div>

        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-10">
          <div className="container">
            <div className="max-w-4xl">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-white mb-4 drop-shadow-xl tracking-tight text-balance animate-slide-up">
                {recipe.recipeName}
              </h1>
              {recipe.description && (
                <p className="text-base md:text-lg text-white/80 mb-6 max-w-2xl font-medium leading-relaxed line-clamp-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  {recipe.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 animate-slide-up" style={{ animationDelay: '0.2s' }}>
                {[
                  { icon: Clock, value: `${totalTime} phút`, color: 'text-orange-300', bg: 'bg-orange-500/20' },
                  { icon: Users, value: `${recipe.servings} người`, color: 'text-blue-300', bg: 'bg-blue-500/20' },
                  { icon: ChefHat, value: diff.label, color: 'text-white', bg: `${diff.bg}/40` },
                  { icon: Star, value: `${((recipe as any).averageRating ?? 0).toFixed(1)} ★`, color: 'text-yellow-300', bg: 'bg-yellow-500/20' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-center gap-2 rounded-xl px-4 py-2 backdrop-blur-sm border border-white/10 ${item.bg}`}>
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className={`font-bold text-sm ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Tab Bar */}
      <div className={`sticky top-16 z-30 transition-all duration-300 ${isScrolled ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-sm border-b border-gray-100 dark:border-gray-800' : 'bg-transparent'}`}>
        <div className="container">
          <div className="flex gap-1 py-2 overflow-x-auto hide-scrollbar">
            {(['ingredients', 'steps', 'reviews'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab)
                  document.getElementById(`section-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab
                    ? 'bg-primary-500 text-white shadow-md'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                {tab === 'ingredients' ? `Nguyên liệu (${recipe.ingredients?.length || 0})` :
                 tab === 'steps' ? `Các bước (${recipe.steps?.length || 0})` :
                 `Đánh giá (${(recipe as any).reviewCount || 0})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container py-10">
        <div className="max-w-5xl mx-auto">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {[
              { icon: Timer, label: 'Chuẩn bị', value: `${recipe.prepTime}p`, color: 'blue' },
              { icon: UtensilsCrossed, label: 'Nấu', value: `${recipe.cookTime}p`, color: 'orange' },
              { icon: Users, label: 'Khẩu phần', value: `${recipe.servings}`, color: 'green' },
              { icon: Clock, label: 'Tổng', value: `${totalTime}p`, color: 'purple' },
            ].map((stat, i) => (
              <div key={i} className="card p-5 text-center hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className={`w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center ${
                  stat.color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-500' :
                  stat.color === 'orange' ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-500' :
                  stat.color === 'green' ? 'bg-green-50 dark:bg-green-900/30 text-green-500' :
                  'bg-purple-50 dark:bg-purple-900/30 text-purple-500'
                }`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div className="text-2xl font-extrabold text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: Main content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Categories */}
              {recipe.categories && recipe.categories.length > 0 && (
                <div id="section-categories" className="card p-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary-500" />
                    Phân loại
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {recipe.categories.map((cat) => (
                      <span key={cat.id} className="badge badge-primary">
                        {cat.categoryName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Steps */}
              {recipe.steps && recipe.steps.length > 0 && (
                <div id="section-steps" className="card p-6">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary-500" />
                    Các bước thực hiện
                  </h2>
                  <RecipeSteps steps={recipe.steps} />
                </div>
              )}

              {/* Reviews */}
              <div id="section-reviews" className="card p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                  <Star className="w-5 h-5 text-primary-500" />
                  Đánh giá
                </h2>
                <RatingSection recipeId={recipe.id} />
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
                  <CommentSection recipeId={recipe.id} currentUserId={user?.id} initialCommentsCount={0} />
                </div>
              </div>
            </div>

            {/* Right: Sidebar */}
            <div className="space-y-6">
              {/* Ingredients */}
              <div id="section-ingredients" className="card p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary-500" />
                  Nguyên liệu
                  <span className="ml-auto text-sm font-normal text-gray-400">{recipe.ingredients?.length || 0} mục</span>
                </h2>
                {recipe.ingredients && recipe.ingredients.length > 0 ? (
                  <IngredientChecklist recipeId={recipe.id} ingredients={recipe.ingredients} searchedIngredients={searchedIngredients} />
                ) : (
                  <p className="text-gray-400 text-sm">Chưa có thông tin nguyên liệu.</p>
                )}
              </div>

              {/* Rating Summary */}
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-500 to-amber-500 flex items-center justify-center shadow-lg">
                    <span className="text-2xl font-extrabold text-white">{(recipe as any).averageRating?.toFixed(1) || '0.0'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < Math.round((recipe as any).averageRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{(recipe as any).reviewCount || 0} đánh giá</p>
                  </div>
                </div>
                <RatingSection recipeId={recipe.id} compact />
              </div>

              {/* Action buttons */}
              <div className="card p-5 space-y-3">
                <button
                  onClick={() => {
                    document.getElementById('section-ingredients')?.scrollIntoView({ behavior: 'smooth' })
                    setActiveTab('ingredients')
                  }}
                  className="w-full btn btn-primary justify-center"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Bắt đầu nấu
                </button>
                <button
                  onClick={() => navigate('/meal-plans')}
                  className="w-full btn btn-secondary justify-center"
                >
                  <ChefHat className="w-4 h-4" />
                  Thêm vào thực đơn
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RecipeDetailPage
