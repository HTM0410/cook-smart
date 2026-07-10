import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import recipeService from '../../services/recipeService'
import FavoriteButton from '../atoms/FavoriteButton'
import { useAuth } from '../../contexts/AuthContext'
import { Recipe } from '../../types/recipe'
import { Clock, Star, ChefHat, ArrowUpRight } from 'lucide-react'
import { EyebrowTag } from '../atoms/EyebrowTag'
import { easeFluid, splitRevealLeft, cardReveal, staggerGrid, viewportOnce } from '../../lib/motion'

const PopularRecipes: React.FC = () => {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        setLoading(true)
        const response = await recipeService.getRecipes({ page: 1, limit: 20 })
        const responseData = response.data as any
        let recipes: Recipe[] = responseData?.recipes || responseData?.data?.recipes || []

        recipes.sort((a, b) => {
          const aCount = (a as any).favoriteCount || (a as any).reviewCount || 0
          const bCount = (b as any).favoriteCount || (b as any).reviewCount || 0
          return bCount - aCount
        })

        setRecipes(recipes.slice(0, 8))
      } catch (err) {
        console.error('Error fetching popular recipes:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchPopular()
  }, [])

  const handleImageError = (recipeId: number) => {
    setImageErrors(prev => new Set(prev).add(recipeId))
  }

  const getDifficultyConfig = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return {
          label: 'Dễ',
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
          bg: 'bg-white text-[#1A1814] border border-white/40',
          dot: 'bg-[#ff4f00]',
        }
    }
  }

  if (loading) return null
  if (recipes.length === 0) return null

  return (
    <section className="section-lg bg-[#FDFBF7] dark:bg-ink-900 relative overflow-hidden">
      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end mb-12">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={splitRevealLeft}
            className="lg:col-span-7"
          >
            <EyebrowTag>Đang được yêu thích</EyebrowTag>
            <h2 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
              Xu hướng
              <br />
              <span className="text-ink-muted">tuần này.</span>
            </h2>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.9, ease: easeFluid, delay: 0.2 }}
            className="lg:col-span-5 lg:pb-3"
          >
            <p className="text-ink-secondary text-lg leading-relaxed max-w-md text-pretty">
              Những công thức được cộng đồng CookSmart yêu thích nhất trong tuần qua.
            </p>
          </motion.div>
        </div>

        {/* Uniform grid — same size, same shape, every card has a description */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerGrid}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {recipes.map((recipe) => {
            const diff = getDifficultyConfig(recipe.difficulty)
            return (
              <motion.div key={recipe.id} variants={cardReveal} className="h-full">
                <Link to={`/recipes/${recipe.id}`} className="group block h-full">
                  <article className="card-bezel h-full">
                    <div className="card-bezel-inner p-0 overflow-hidden h-full flex flex-col">
                      <div className="relative aspect-[4/3] overflow-hidden">
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
                        <div className="absolute inset-0 bg-gradient-to-t from-ink-700/40 to-transparent" />

                        <div className="absolute top-3 left-3 z-10">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${diff.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`} aria-hidden />
                            {diff.label}
                          </span>
                        </div>

                        <div className="absolute top-3 right-3" onClick={(e) => e.preventDefault()}>
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

                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light mb-2 line-clamp-2 group-hover:text-[#ff4f00] transition-colors">
                          {recipe.recipeName}
                        </h3>
                        <p className="text-sm text-ink-secondary leading-relaxed line-clamp-3 mb-4 flex-1">
                          {recipe.description || 'Một công thức hấp dẫn đang chờ bạn khám phá cùng CookSmart.'}
                        </p>
                        <div className="flex items-center justify-between pt-3 border-t border-ink-200/40 dark:border-ink-700/40">
                          <div className="flex items-center gap-3 text-xs text-ink-secondary">
                            <div className="flex items-center gap-1.5">
                              <Star className="w-3.5 h-3.5 text-[#ff4f00] fill-[#ff4f00]" />
                              <span className="font-semibold text-ink-primary dark:text-paper-light">
                                {((recipe as any).averageRating ?? 0).toFixed(1)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                              <span>{recipe.prepTime + recipe.cookTime}p</span>
                            </div>
                          </div>
                          <span className="w-8 h-8 rounded-full bg-ink-700/90 dark:bg-paper-light flex items-center justify-center text-paper-light dark:text-ink-700 transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:scale-110">
                            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}

export default PopularRecipes
