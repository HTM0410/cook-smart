import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import recipeService from '../services/recipeService'
import FavoriteButton from '../components/atoms/FavoriteButton'
import { SkeletonCard } from '../components/molecules/SkeletonCard'
import { useAuth } from '../contexts/AuthContext'
import { Recipe } from '../types/recipe'
import { Grid3X3, LayoutList, SlidersHorizontal, X, Star, Clock, Users, ChevronDown, ChefHat, ArrowUpRight } from 'lucide-react'
import { EyebrowTag } from '../components/atoms/EyebrowTag'
import { ButtonEditorial } from '../components/atoms/ButtonEditorial'
import { fadeUp, splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, viewportOnce } from '../lib/motion'

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
        return sorted.sort((a, b) => (b.prepTime + b.cookTime) - (a.prepTime + b.cookTime))
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
      <div className="min-h-screen bg-paper-light dark:bg-ink-800 section pt-32">
        <div className="container">
          <div className="space-y-3 mb-12">
            <div className="skeleton h-6 w-32 rounded-full" />
            <div className="skeleton-title w-80" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <SkeletonCard count={9} variant="recipe" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-paper-light dark:bg-ink-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-display text-6xl text-ink-primary dark:text-paper-light">⚠️</div>
          <p className="text-ink-secondary">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-editorial-primary">
            Thử lại
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper-light dark:bg-ink-800">
      {/* Editorial Header */}
      <section className="pt-32 md:pt-40 pb-12 md:pb-16">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={splitRevealLeft}
              className="lg:col-span-7"
            >
              <EyebrowTag>Tất cả công thức</EyebrowTag>
              <h1 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-ink-primary dark:text-paper-light text-balance">
                Mọi công thức.
                <br />
                <span className="text-ink-muted">Một nơi.</span>
              </h1>
            </motion.div>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={splitRevealRight}
              className="lg:col-span-5 lg:pb-3"
            >
              <p className="text-ink-secondary text-lg leading-relaxed max-w-md text-pretty mb-6">
                {recipes.length > 0 ? `${recipes.length} công thức có sẵn,` : 'Chưa có công thức nào,'} được tuyển chọn và cập nhật mỗi ngày.
              </p>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1) }}
                    className="h-11 pl-5 pr-10 text-sm rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-700 ease-[var(--ease-fluid)] font-medium"
                  >
                    <option value="popular">Phổ biến nhất</option>
                    <option value="rating">Đánh giá cao</option>
                    <option value="newest">Mới nhất</option>
                    <option value="time-low">Thời gian ngắn</option>
                    <option value="time-high">Thời gian dài</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" strokeWidth={1.5} />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-11 px-5 rounded-full text-sm font-medium inline-flex items-center gap-2 transition-colors duration-700 ease-[var(--ease-fluid)] ${
                    showFilters
                      ? 'bg-ink-700 dark:bg-paper-light text-paper-light dark:text-ink-700'
                      : 'ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light hover:ring-ink-primary/30'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" strokeWidth={1.5} />
                  Bộ lọc
                </motion.button>

                <div className="inline-flex p-1 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700">
                  {[
                    { id: 'grid', icon: Grid3X3 },
                    { id: 'list', icon: LayoutList },
                  ].map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setViewMode(v.id as any)}
                      className={`relative p-2.5 rounded-full transition-colors duration-700 ease-[var(--ease-fluid)] ${
                        viewMode === v.id
                          ? 'bg-white dark:bg-ink-800 text-ink-primary dark:text-paper-light shadow-sm'
                          : 'text-ink-secondary hover:text-ink-primary'
                      }`}
                      aria-label={v.id}
                    >
                      <v.icon className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Active Filters */}
      {searchParams.toString() && (
        <div className="container mb-8">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-secondary">Kết quả cho:</span>
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
        </div>
      )}

      {/* Recipes Grid/List */}
      <section className="pb-24">
        <div className="container">
          {recipes.length === 0 ? (
            <div className="empty-state">
              <p className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light mb-4">
                Chưa có công thức nào.
              </p>
              <p className="text-ink-secondary mb-8">Hãy quay lại sau để khám phá thêm.</p>
              <Link to="/recipes">
                <ButtonEditorial variant="primary" size="md">Khám phá</ButtonEditorial>
              </Link>
            </div>
          ) : (
            <>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerGrid}
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
                    : 'space-y-4'
                }
              >
                {currentRecipes.map((recipe, index) => {
                  const totalTime = recipe.prepTime + recipe.cookTime
                  return (
                    <motion.div key={recipe.id} custom={index} variants={cardReveal}>
                      <Link to={`/recipes/${recipe.id}`} className="group block h-full">
                        <article className="card-bezel h-full">
                          <div className={`card-bezel-inner p-0 overflow-hidden h-full ${viewMode === 'list' ? 'flex' : 'flex flex-col'}`}>
                            <div className={`relative overflow-hidden ${viewMode === 'list' ? 'w-48 sm:w-56 flex-shrink-0' : 'aspect-[4/3]'}`}>
                              {recipe.imageUrl && !imageErrors.has(recipe.id) ? (
                                <img
                                  src={recipe.imageUrl}
                                  alt={recipe.recipeName}
                                  loading="lazy"
                                  className="h-full w-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105"
                                  onError={() => handleImageError(recipe.id)}
                                />
                              ) : (
                                <div className="h-full w-full bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                                  <ChefHat className="w-12 h-12 text-ink-200" strokeWidth={1} />
                                </div>
                              )}

                              <div className="absolute inset-0 bg-gradient-to-t from-ink-700/30 to-transparent" />

                              <div className="absolute top-3 right-3 z-10" onClick={(e) => e.preventDefault()}>
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

                              <div className="absolute top-3 left-3 z-10">
                                {(() => {
                                  const diffMap = {
                                    easy:   { l: 'Dễ',  c: 'bg-emerald-500 text-white border border-emerald-300/50 shadow-[0_2px_8px_rgba(16,185,129,0.4)]' },
                                    medium: { l: 'Vừa', c: 'bg-amber-500 text-white border border-amber-300/50 shadow-[0_2px_8px_rgba(245,158,11,0.4)]' },
                                    hard:   { l: 'Khó', c: 'bg-rose-500 text-white border border-rose-300/50 shadow-[0_2px_8px_rgba(244,63,94,0.4)]' },
                                  } as const
                                  const d = diffMap[recipe.difficulty as keyof typeof diffMap] || { l: recipe.difficulty, c: 'bg-white text-[#1A1814] border border-white/40 shadow-[0_2px_8px_rgba(0,0,0,0.18)]' }
                                  return (
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${d.c}`}>
                                      {d.l}
                                    </span>
                                  )
                                })()}
                              </div>
                            </div>

                            <div className="p-5 flex-1 flex flex-col">
                              <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light mb-2 line-clamp-2 group-hover:text-[#ff4f00] transition-colors">
                                {recipe.recipeName}
                              </h3>
                              {viewMode === 'list' ? (
                                <p className="text-sm text-ink-secondary mb-3 line-clamp-2 flex-1">
                                  {recipe.description || 'Một công thức tuyệt vời dành cho bạn.'}
                                </p>
                              ) : (
                                <p className="text-sm text-ink-secondary mb-4 line-clamp-2 flex-1">
                                  {recipe.description || 'Một công thức tuyệt vời dành cho bạn.'}
                                </p>
                              )}

                              {recipe.categories && recipe.categories.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                  {recipe.categories.slice(0, 2).map((cat) => (
                                    <span
                                      key={cat.id}
                                      className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-[#F5F1EA] dark:bg-[#1F1B16] text-[#5C4A38] dark:text-[#C9B89C] border border-[#E8DFD0] dark:border-[#2A2520]"
                                    >
                                      {cat.categoryName}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-4 border-t border-ink-200/40 dark:border-ink-700/40 mt-auto">
                                <div className="flex items-center gap-1.5 text-sm">
                                  <Star className="w-3.5 h-3.5 text-[#ff4f00] fill-[#ff4f00]" />
                                  <span className="font-semibold text-ink-primary dark:text-paper-light">
                                    {((recipe as any).averageRating ?? 0).toFixed(1)}
                                  </span>
                                  <span className="text-xs text-ink-secondary">
                                    ({((recipe as any).reviewCount ?? 0)})
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-ink-secondary">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" strokeWidth={1.5} />
                                    {totalTime}p
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3" strokeWidth={1.5} />
                                    {recipe.servings}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      </Link>
                    </motion.div>
                  )
                })}
              </motion.div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-16 space-y-4">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-ink-secondary">
                    <span>Trang {currentPage} / {totalPages}</span>
                    <span>{startIndex + 1}–{Math.min(endIndex, sortedRecipes.length)} trong {sortedRecipes.length}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-11 px-5 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light disabled:opacity-30 disabled:cursor-not-allowed hover:ring-ink-primary/30 transition-all duration-700 ease-[var(--ease-fluid)]"
                    >
                      Trước
                    </motion.button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const page = i + 1
                      return (
                        <motion.button
                          key={page}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => goToPage(page)}
                          className={`h-11 w-11 rounded-full text-sm font-medium transition-colors duration-700 ease-[var(--ease-fluid)] ${
                            currentPage === page
                              ? 'bg-ink-700 dark:bg-paper-light text-paper-light dark:text-ink-700'
                              : 'ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light hover:ring-ink-primary/30'
                          }`}
                        >
                          {page}
                        </motion.button>
                      )
                    })}
                    {totalPages > 7 && (
                      <>
                        <span className="px-2 text-ink-muted">…</span>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => goToPage(totalPages)}
                          className="h-11 w-11 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light"
                        >
                          {totalPages}
                        </motion.button>
                      </>
                    )}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-11 px-5 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light disabled:opacity-30 disabled:cursor-not-allowed hover:ring-ink-primary/30 transition-all duration-700 ease-[var(--ease-fluid)]"
                    >
                      Sau
                    </motion.button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default RecipesPage
