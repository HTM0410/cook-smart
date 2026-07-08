import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import recipeService from '../../services/recipeService'
import FavoriteButton from '../atoms/FavoriteButton'
import { useAuth } from '../../contexts/AuthContext'
import { Recipe } from '../../types/recipe'
import { SkeletonCard } from '../molecules/SkeletonCard'
import { Clock, Star, ChefHat, ArrowUpRight } from 'lucide-react'
import { EyebrowTag } from '../atoms/EyebrowTag'
import { ButtonEditorial } from '../atoms/ButtonEditorial'
import {
  easeFluid,
  splitRevealLeft,
  splitRevealRight,
  staggerGrid,
  cardReveal,
  viewportOnce,
} from '../../lib/motion'

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

        setRecipes(recipes.slice(0, 5))
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
      case 'easy':
        return {
          label: 'Dễ',
          // Solid pill — high contrast, readable on any backdrop
          bg: 'bg-emerald-500 text-white border border-emerald-300/40 shadow-[0_2px_8px_rgba(16,185,129,0.35)]',
          dot: 'bg-white/90',
        }
      case 'medium':
        return {
          label: 'Vừa',
          bg: 'bg-amber-500 text-white border border-amber-300/40 shadow-[0_2px_8px_rgba(245,158,11,0.35)]',
          dot: 'bg-white/90',
        }
      case 'hard':
        return {
          label: 'Khó',
          bg: 'bg-rose-500 text-white border border-rose-300/40 shadow-[0_2px_8px_rgba(244,63,94,0.35)]',
          dot: 'bg-white/90',
        }
      default:
        return {
          label: difficulty,
          bg: 'bg-white text-[#1A1814] border border-white/40 shadow-[0_2px_8px_rgba(0,0,0,0.12)]',
          dot: 'bg-[#ff4f00]',
        }
    }
  }

  if (loading) {
    return (
      <section className="section-lg bg-paper-light dark:bg-ink-800">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-12">
            <div className="lg:col-span-5 space-y-3">
              <div className="skeleton h-6 w-32 rounded-full" />
              <div className="skeleton-title w-80" />
              <div className="skeleton-text w-96" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    <section className="section-lg bg-paper-light dark:bg-ink-800 relative overflow-hidden">
      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end mb-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={splitRevealLeft}
            className="lg:col-span-7"
          >
            <EyebrowTag>Tuyển chọn tuần này</EyebrowTag>
            <h2 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
              Công thức
              <br />
              <span className="text-ink-muted">nổi bật.</span>
            </h2>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={splitRevealRight}
            className="lg:col-span-5 lg:pb-3"
          >
            <p className="text-ink-secondary text-lg leading-relaxed max-w-md text-pretty mb-6">
              Những công thức được đánh giá cao nhất, được yêu thích bởi cộng đồng CookSmart.
            </p>
            <ButtonEditorial variant="ghost" size="sm" trailingIcon={<ArrowUpRight className="w-3.5 h-3.5" />}>
              <Link to="/recipes">Xem tất cả</Link>
            </ButtonEditorial>
          </motion.div>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerGrid}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Hero Card with Double-Bezel */}
          <motion.div variants={cardReveal} className="lg:row-span-2">
            <Link to={`/recipes/${heroRecipe.id}`} className="group block h-full">
              <article className="card-bezel h-full">
                <div className="card-bezel-inner overflow-hidden p-0 h-full flex flex-col">
                  <div className="relative aspect-[4/3] lg:aspect-auto lg:flex-1 overflow-hidden">
                    {heroRecipe.imageUrl && !imageErrors.has(heroRecipe.id) ? (
                      <img
                        src={heroRecipe.imageUrl}
                        alt={heroRecipe.recipeName}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105"
                        onError={() => handleImageError(heroRecipe.id)}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                        <ChefHat className="w-20 h-20 text-ink-200" strokeWidth={1} />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-ink-700/60 via-ink-700/10 to-transparent" />

                    <div className="absolute top-5 left-5 flex flex-wrap gap-2 z-10">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${heroDifficulty.bg}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${heroDifficulty.dot}`} aria-hidden />
                        {heroDifficulty.label}
                      </span>
                      {heroRecipe.categories?.slice(0, 1).map((cat) => (
                        <span
                          key={cat.id}
                          className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider bg-white/95 text-[#1A1814] border border-white/40 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                        >
                          {cat.categoryName}
                        </span>
                      ))}
                    </div>

                    <div
                      className="absolute top-5 right-5 z-10"
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

                    <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between">
                      <h3 className="text-display text-3xl md:text-4xl text-white text-balance max-w-md">
                        {heroRecipe.recipeName}
                      </h3>
                    </div>
                  </div>

                  <div className="p-6 md:p-7 flex flex-col flex-1">
                    <p className="text-ink-secondary leading-relaxed mb-6 flex-1 line-clamp-2">
                      {heroRecipe.description || 'Một công thức tuyệt vời dành cho bạn và gia đình.'}
                    </p>

                    <div className="flex items-center justify-between pt-5 border-t border-ink-200/40 dark:border-ink-700/40">
                      <div className="flex items-center gap-5 text-sm text-ink-secondary">
                        <div className="flex items-center gap-1.5">
                          <Star className="w-4 h-4 text-[#ff4f00] fill-[#ff4f00]" />
                          <span className="font-semibold text-ink-primary dark:text-paper-light">
                            {((heroRecipe as any).averageRating ?? 0).toFixed(1)}
                          </span>
                          <span>({((heroRecipe as any).reviewCount ?? 0)})</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" strokeWidth={1.5} />
                          <span>{heroRecipe.prepTime + heroRecipe.cookTime}p</span>
                        </div>
                      </div>
                      <span className="w-9 h-9 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center text-paper-light dark:text-ink-700 transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:scale-110">
                        <ArrowUpRight className="w-4 h-4" strokeWidth={1.5} />
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          </motion.div>

          {/* Side Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {sideRecipes.slice(0, 4).map((recipe) => {
              const diff = getDifficultyConfig(recipe.difficulty)
              return (
                <motion.div key={recipe.id} variants={cardReveal}>
                  <Link to={`/recipes/${recipe.id}`} className="group block h-full">
                    <article className="card-bezel h-full">
                      <div className="card-bezel-inner p-0 overflow-hidden h-full flex flex-col">
                        <div className="relative aspect-[4/3] overflow-hidden">
                          {recipe.imageUrl && !imageErrors.has(recipe.id) ? (
                            <img
                              src={recipe.imageUrl}
                              alt={recipe.recipeName}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105"
                              onError={() => handleImageError(recipe.id)}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                              <ChefHat className="w-10 h-10 text-ink-200" strokeWidth={1} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-ink-700/30 to-transparent" />

                          <div className="absolute top-3 right-3 z-10">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${diff.bg}`}
                            >
                              {diff.label}
                            </span>
                          </div>

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

                        <div className="p-4 flex-1 flex flex-col">
                          <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light mb-2 line-clamp-2 group-hover:text-[#ff4f00] transition-colors">
                            {recipe.recipeName}
                          </h3>
                          <div className="flex items-center justify-between mt-auto pt-3">
                            <div className="flex items-center gap-1 text-sm">
                              <Star className="w-3.5 h-3.5 text-[#ff4f00] fill-[#ff4f00]" />
                              <span className="font-semibold text-ink-primary dark:text-paper-light">
                                {((recipe as any).averageRating ?? 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-ink-secondary">
                              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                              {recipe.prepTime + recipe.cookTime}p
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default FeaturedRecipes
