import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import recipeService from '../services/recipeService'
import FavoriteButton from '../components/atoms/FavoriteButton'
import { SkeletonCard } from '../components/molecules/SkeletonCard'
import { useAuth } from '../contexts/AuthContext'
import { Recipe } from '../types/recipe'
import { Search, Grid3X3, LayoutList, SlidersHorizontal, X, Star, Clock, Users, ChevronDown } from 'lucide-react'

const RECIPES_PER_PAGE = 18

const RecipesPage: React.FC = () => {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState('popular')
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setLoading(true)
        const response = await recipeService.getRecipes({ page: 1, limit: 1000 })
        const responseData = response.data as any
        const recipesList = responseData?.recipes || responseData?.data?.recipes || []
        setRecipes(recipesList)
      } catch (err) {
        setError('Không thể tải danh sách công thức')
        console.error('Error fetching recipes:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRecipes()
  }, [])

  const sortedRecipes = React.useMemo(() => {
    const sorted = [...recipes]
    switch (sortBy) {
      case 'rating':
        return sorted.sort((a, b) => ((b as any).averageRating || 0) - ((a as any).averageRating || 0))
      case 'newest':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      case 'time-low':
        return sorted.sort((a, b) => (a.prepTime + a.cookTime) - (b.prepTime + b.cookTime))
      case 'time-high':
        return sorted.sort((a, b) => (b.prepTime + b.cookTime) - (a.prepTime + a.cookTime))
      case 'popular':
      default:
        return sorted.sort((a, b) => ((b as any).reviewCount || 0) - ((a as any).reviewCount || 0))
    }
  }, [recipes, sortBy])

  const totalPages = Math.ceil(sortedRecipes.length / RECIPES_PER_PAGE)
  const startIndex = (currentPage - 1) * RECIPES_PER_PAGE
  const endIndex = startIndex + RECIPES_PER_PAGE
  const currentRecipes = sortedRecipes.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleImageError = (recipeId: number) => {
    setImageErrors(prev => new Set(prev).add(recipeId))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container py-10">
          <div className="mb-8">
            <div className="skeleton-title w-48 mb-2" />
            <div className="skeleton-text w-64" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <SkeletonCard count={9} variant="recipe" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4 text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Đã xảy ra lỗi</h2>
          <p className="text-gray-500 mb-4">{error}</p>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container py-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div className="animate-fade-in-up">
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-2 tracking-tight">
              Tất cả <span className="text-gradient">công thức</span>
            </h1>
            <p className="text-muted-foreground">
              {recipes.length > 0 ? `${recipes.length} công thức có sẵn` : 'Chưa có công thức nào'}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 animate-fade-in-up">
            {/* Sort */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1) }}
                className="h-10 pl-4 pr-10 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                <option value="popular">Phổ biến nhất</option>
                <option value="rating">Đánh giá cao</option>
                <option value="newest">Mới nhất</option>
                <option value="time-low">Thời gian ngắn</option>
                <option value="time-high">Thời gian dài</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-4 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-all ${
                showFilters
                  ? 'bg-primary-50 border-primary-500 text-primary-600 dark:bg-primary-900/20 dark:border-primary-400 dark:text-primary-400'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Bộ lọc</span>
            </button>

            {/* View Toggle */}
            <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2.5 transition-all ${viewMode === 'grid' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2.5 transition-all ${viewMode === 'list' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'}`}
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active Filters */}
        {searchParams.toString() && (
          <div className="mb-6 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-500">Kết quả cho:</span>
            {Array.from(searchParams.entries()).map(([key, value]) => (
              <button
                key={key}
                onClick={() => {
                  const params = new URLSearchParams(searchParams)
                  params.delete(key)
                  window.location.href = `/recipes${params.toString() ? '?' + params.toString() : ''}`
                }}
                className="chip chip-active text-xs"
              >
                {key}: {value}
                <X className="w-3 h-3" />
              </button>
            ))}
          </div>
        )}

        {recipes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 rounded-3xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4 text-5xl animate-float">📖</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Chưa có công thức nào</h2>
            <p className="text-gray-500 mb-6">Hãy quay lại sau để khám phá thêm.</p>
            <Link to="/recipes" className="btn btn-primary">
              Khám phá công thức
            </Link>
          </div>
        ) : (
          <>
            {/* Recipe Grid/List */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentRecipes.map((recipe, index) => {
                  const totalTime = recipe.prepTime + recipe.cookTime
                  return (
                    <Link
                      key={recipe.id}
                      to={`/recipes/${recipe.id}`}
                      className="group block animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                    >
                      <div className="card overflow-hidden hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-500 hover:-translate-y-1">
                        {/* Image */}
                        <div className="relative aspect-[4/3] overflow-hidden">
                          {recipe.imageUrl && !imageErrors.has(recipe.id) ? (
                            <img
                              src={recipe.imageUrl}
                              alt={recipe.recipeName}
                              loading="lazy"
                              className="h-full w-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                              onError={() => handleImageError(recipe.id)}
                            />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center text-5xl">
                              🍳
                            </div>
                          )}

                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                          {/* Favorite */}
                          <div className="absolute top-3 right-3 z-10" onClick={(e) => e.preventDefault()}>
                            <FavoriteButton
                              recipeId={recipe.id}
                              initialFavoriteCount={0}
                              initialIsFavorited={false}
                              userId={user?.id}
                              size="md"
                              showCount={false}
                              showTooltip={true}
                            />
                          </div>

                          {/* Difficulty badge */}
                          <div className="absolute top-3 left-3 z-10">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${
                              recipe.difficulty === 'easy' ? 'bg-green-500/80 text-white' :
                              recipe.difficulty === 'medium' ? 'bg-amber-500/80 text-white' :
                              'bg-red-500/80 text-white'
                            }`}>
                              {recipe.difficulty === 'easy' ? 'Dễ' : recipe.difficulty === 'medium' ? 'Vừa' : 'Khó'}
                            </span>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2">
                            {recipe.recipeName}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                            {recipe.description || 'Một công thức tuyệt vời dành cho bạn.'}
                          </p>

                          {/* Categories */}
                          {recipe.categories && recipe.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {recipe.categories.slice(0, 2).map((cat) => (
                                <span key={cat.id} className="badge badge-subtle text-[10px]">
                                  {cat.categoryName}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Meta */}
                          <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                            <div className="flex items-center gap-1.5">
                              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                                {((recipe as any).averageRating ?? 0).toFixed(1)}
                              </span>
                              <span className="text-xs text-gray-400">
                                ({(recipe as any).reviewCount ?? 0})
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {totalTime}p
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {recipe.servings}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              /* List View */
              <div className="space-y-4">
                {currentRecipes.map((recipe, index) => (
                  <Link
                    key={recipe.id}
                    to={`/recipes/${recipe.id}`}
                    className="group block animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(index, 8) * 0.05}s` }}
                  >
                    <div className="card overflow-hidden flex hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-500 hover:-translate-y-1">
                      {/* Image */}
                      <div className="relative w-48 flex-shrink-0">
                        {recipe.imageUrl && !imageErrors.has(recipe.id) ? (
                          <img
                            src={recipe.imageUrl}
                            alt={recipe.recipeName}
                            loading="lazy"
                            className="h-full w-full object-cover transform transition-transform duration-700 group-hover:scale-105"
                            onError={() => handleImageError(recipe.id)}
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center text-4xl">
                            🍳
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-5 flex flex-col">
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-4 mb-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                              {recipe.recipeName}
                            </h3>
                            <div onClick={(e) => e.preventDefault()}>
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
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {recipe.description || 'Một công thức tuyệt vời dành cho bạn.'}
                          </p>

                          {recipe.categories && recipe.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {recipe.categories.slice(0, 3).map((cat) => (
                                <span key={cat.id} className="badge badge-subtle text-[10px]">
                                  {cat.categoryName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-6 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                              {((recipe as any).averageRating ?? 0).toFixed(1)}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({(recipe as any).reviewCount ?? 0})
                            </span>
                          </div>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-4 h-4" />
                            {recipe.prepTime + recipe.cookTime}p
                          </span>
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="w-4 h-4" />
                            {recipe.servings} người
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            recipe.difficulty === 'easy' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                            recipe.difficulty === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                            'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                          }`}>
                            {recipe.difficulty === 'easy' ? 'Dễ' : recipe.difficulty === 'medium' ? 'Vừa' : 'Khó'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-12 space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Hiển thị {startIndex + 1} - {Math.min(endIndex, sortedRecipes.length)} trong {sortedRecipes.length} công thức</span>
                  <span>Trang {currentPage} / {totalPages}</span>
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="h-10 px-4 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    ← Trước
                  </button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const page = i + 1
                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`h-10 w-10 rounded-xl font-semibold transition-all ${
                          currentPage === page
                            ? 'bg-primary-500 text-white shadow-md'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                  {totalPages > 7 && (
                    <>
                      <span className="px-2 text-gray-400">...</span>
                      <button
                        onClick={() => goToPage(totalPages)}
                        className="h-10 w-10 rounded-xl font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="h-10 px-4 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Sau →
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default RecipesPage
