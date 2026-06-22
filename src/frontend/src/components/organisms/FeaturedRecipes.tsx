import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import recipeService from '../../services/recipeService'
import FavoriteButton from '../atoms/FavoriteButton'
import { useAuth } from '../../contexts/AuthContext'
import { Recipe } from '../../types/recipe'
import { SkeletonCard } from '../molecules/SkeletonCard'
import { Clock, Star, ChefHat, ArrowRight } from 'lucide-react'

const FeaturedRecipes: React.FC = () => {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  useEffect(() => {
    const fetchFeaturedRecipes = async () => {
      try {
        setLoading(true)
        const response = await recipeService.getRecipes({ page: 1, limit: 100 })
        const responseData = response.data as any
        let recipes: Recipe[] = responseData?.recipes || responseData?.data?.recipes || []

        recipes.sort((a, b) => {
          const aRating = (a as any).averageRating || 0
          const bRating = (b as any).averageRating || 0
          const aCount = (a as any).reviewCount || 0
          const bCount = (b as any).reviewCount || 0
          if (Math.abs(bRating - aRating) > 0.1) return bRating - aRating
          return bCount - aCount
        })

        setRecipes(recipes.slice(0, 6))
      } catch (err) {
        console.error('Error fetching featured recipes:', err)
        setRecipes([])
      } finally {
        setLoading(false)
      }
    }

    fetchFeaturedRecipes()
  }, [])

  const handleImageError = (recipeId: number) => {
    setImageErrors(prev => new Set(prev).add(recipeId))
  }

  const getDifficultyConfig = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return { label: 'Dễ', bg: 'bg-green-100/90 dark:bg-green-900/50', text: 'text-green-700 dark:text-green-400', ring: 'ring-green-200 dark:ring-green-800' }
      case 'medium': return { label: 'Vừa', bg: 'bg-amber-100/90 dark:bg-amber-900/50', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-800' }
      case 'hard': return { label: 'Khó', bg: 'bg-red-100/90 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-400', ring: 'ring-red-200 dark:ring-red-800' }
      default: return { label: difficulty, bg: 'bg-gray-100/90 dark:bg-gray-800/50', text: 'text-gray-700 dark:text-gray-400', ring: 'ring-gray-200 dark:ring-gray-700' }
    }
  }

  if (loading) {
    return (
      <section className="py-16 lg:py-20 bg-gray-50/50 dark:bg-gray-900/50">
        <div className="container">
          <div className="mb-12 text-center">
            <div className="skeleton-title w-64 mx-auto mb-3" />
            <div className="skeleton-text w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <SkeletonCard variant="recipe" className="lg:row-span-2" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <SkeletonCard variant="recipe" />
              <SkeletonCard variant="recipe" />
              <SkeletonCard variant="recipe" />
              <SkeletonCard variant="recipe" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (recipes.length === 0) return null

  const [heroRecipe, ...sideRecipes] = recipes
  const heroDifficulty = getDifficultyConfig(heroRecipe.difficulty)

  return (
    <section className="py-16 lg:py-20 bg-gray-50/50 dark:bg-gray-900/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-secondary-500/5 rounded-full blur-3xl" />

      <div className="container relative z-10">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-12">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Star className="w-3.5 h-3.5" />
              Nổi bật
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">
              Công thức được{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-amber-500">
                yêu thích nhất
              </span>
            </h2>
            <p className="text-muted-foreground text-base max-w-xl">
              Những công thức được đánh giá cao và yêu thích nhất từ cộng đồng CookSmart
            </p>
          </div>
          <Link
            to="/recipes"
            className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors group"
          >
            Xem tất cả
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Magazine Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hero Card - Large Featured */}
          <Link to={`/recipes/${heroRecipe.id}`} className="group lg:row-span-2 block h-full">
            <div className="card overflow-hidden h-full flex flex-col hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-500 relative">
              {/* Image */}
              <div className="relative aspect-[4/3] lg:aspect-auto lg:flex-1 overflow-hidden">
                {heroRecipe.imageUrl && !imageErrors.has(heroRecipe.id) ? (
                  <img
                    src={heroRecipe.imageUrl}
                    alt={heroRecipe.recipeName}
                    loading="lazy"
                    className="h-full w-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                    onError={() => handleImageError(heroRecipe.id)}
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center">
                    <ChefHat className="w-20 h-20 text-gray-300 dark:text-gray-600" />
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${heroDifficulty.bg} ${heroDifficulty.text}`}>
                    <ChefHat className="w-3 h-3" />
                    {heroDifficulty.label}
                  </span>
                  {heroRecipe.categories?.slice(0, 1).map((cat) => (
                    <span key={cat.id} className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-white/90 text-gray-800 backdrop-blur-sm">
                      {cat.categoryName}
                    </span>
                  ))}
                </div>

                {/* Favorite */}
                <div
                  className="absolute top-4 right-4 z-10"
                  onClick={(e) => e.preventDefault()}
                >
                  <FavoriteButton
                    recipeId={heroRecipe.id}
                    initialFavoriteCount={0}
                    initialIsFavorited={false}
                    userId={user?.id}
                    size="md"
                    showCount={false}
                    showTooltip={true}
                  />
                </div>

                {/* Rating Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-bold text-sm">
                      {((heroRecipe as any).averageRating ?? 0).toFixed(1)}
                    </span>
                    <span className="text-white/60 text-xs">
                      ({(heroRecipe as any).reviewCount ?? 0})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-xl px-3 py-1.5">
                    <Clock className="w-4 h-4 text-white/80" />
                    <span className="text-white font-semibold text-sm">
                      {heroRecipe.prepTime + heroRecipe.cookTime}p
                    </span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                  {heroRecipe.recipeName}
                </h3>
                <p className="text-muted-foreground text-sm mb-6 line-clamp-3 flex-1">
                  {heroRecipe.description || 'Một công thức tuyệt vời dành cho bạn và gia đình.'}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Chuẩn bị {heroRecipe.prepTime}p
                  </div>
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                    </svg>
                    {heroRecipe.servings} người
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Side Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {sideRecipes.slice(0, 4).map((recipe, index) => {
              const diff = getDifficultyConfig(recipe.difficulty)
              return (
                <Link key={recipe.id} to={`/recipes/${recipe.id}`} className="group block">
                  <div className="card overflow-hidden h-full hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-500">
                    {/* Image */}
                    <div className="relative aspect-[16/10] overflow-hidden">
                      {recipe.imageUrl && !imageErrors.has(recipe.id) ? (
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.recipeName}
                          loading="lazy"
                          className="h-full w-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                          onError={() => handleImageError(recipe.id)}
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center">
                          <ChefHat className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                      {/* Difficulty Badge */}
                      <div className="absolute top-3 right-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${diff.bg} ${diff.text}`}>
                          {diff.label}
                        </span>
                      </div>

                      {/* Favorite */}
                      <div
                        className="absolute top-3 left-3 z-10"
                        onClick={(e) => e.preventDefault()}
                      >
                        <FavoriteButton
                          recipeId={recipe.id}
                          initialFavoriteCount={0}
                          initialIsFavorited={false}
                          userId={user?.id}
                          size="sm"
                          showCount={false}
                          showTooltip={false}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                        {recipe.recipeName}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                        {recipe.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                            {((recipe as any).averageRating ?? 0).toFixed(1)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {recipe.prepTime + recipe.cookTime}p
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Mobile: View all */}
        <div className="mt-8 text-center md:hidden">
          <Link
            to="/recipes"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          >
            Xem tất cả công thức
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default FeaturedRecipes
