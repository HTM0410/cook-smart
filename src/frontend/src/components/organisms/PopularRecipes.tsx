import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import recipeService from '../../services/recipeService'
import FavoriteButton from '../atoms/FavoriteButton'
import { useAuth } from '../../contexts/AuthContext'
import { Recipe } from '../../types/recipe'
import { ChevronLeft, ChevronRight, Star, Clock, ChefHat, ArrowUpRight } from 'lucide-react'
import { EyebrowTag } from '../atoms/EyebrowTag'
import { easeFluid, splitRevealLeft, cardReveal, staggerGrid, viewportOnce } from '../../lib/motion'

const PopularRecipes: React.FC = () => {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set())
  const scrollRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchPopular = async () => {
      try {
        setLoading(true)
        const response = await recipeService.getRecipes({ page: 1, limit: 20 })
        const responseData = response.data as any
        let recipes: Recipe[] = responseData?.recipes || responseData?.data?.recipes || []

        recipes.sort((a, b) => {
          const aCount = (a as any).reviewCount || 0
          const bCount = (b as any).reviewCount || 0
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

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -300 : 300,
        behavior: 'smooth',
      })
    }
  }

  const handleImageError = (recipeId: number) => {
    setImageErrors(prev => new Set(prev).add(recipeId))
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
            className="lg:col-span-5 flex items-center gap-3 lg:justify-end lg:pb-3"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scroll('left')}
              className="w-12 h-12 rounded-full bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-primary dark:text-paper-light"
              aria-label="Trước"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scroll('right')}
              className="w-12 h-12 rounded-full bg-ink-700 dark:bg-paper-light text-paper-light dark:text-ink-700 flex items-center justify-center"
              aria-label="Sau"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
            </motion.button>
          </motion.div>
        </div>

        {/* Horizontal Scroll */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerGrid}
          className="relative -mx-2"
        >
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-6 px-2 hide-scrollbar snap-x snap-mandatory"
          >
            {recipes.map((recipe, i) => (
              <motion.div
                key={recipe.id}
                custom={i}
                variants={cardReveal}
                className="flex-shrink-0 w-72 md:w-80 snap-start"
              >
                <Link to={`/recipes/${recipe.id}`} className="group block h-full">
                  <article className="card-bezel h-full">
                    <div className="card-bezel-inner p-0 overflow-hidden h-full flex flex-col">
                      <div className="relative aspect-[3/4] overflow-hidden">
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

                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                          <div className="eyebrow-tag bg-white/90 dark:bg-ink-700/90 backdrop-blur-md">
                            <Star className="w-3 h-3 text-[#ff4f00] fill-[#ff4f00]" />
                            <span className="font-semibold text-ink-primary dark:text-paper-light">
                              {((recipe as any).averageRating ?? 0).toFixed(1)}
                            </span>
                          </div>
                        </div>

                        <div className="absolute top-4 right-4" onClick={(e) => e.preventDefault()}>
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
                        <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light mb-3 line-clamp-2 group-hover:text-[#ff4f00] transition-colors flex-1">
                          {recipe.recipeName}
                        </h3>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-ink-secondary">
                            <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
                            <span>{recipe.prepTime + recipe.cookTime}p</span>
                          </div>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            recipe.difficulty === 'easy' ? 'bg-emerald-500 text-white border border-emerald-300/50 shadow-[0_2px_8px_rgba(16,185,129,0.4)]' :
                            recipe.difficulty === 'medium' ? 'bg-amber-500 text-white border border-amber-300/50 shadow-[0_2px_8px_rgba(245,158,11,0.4)]' :
                            'bg-rose-500 text-white border border-rose-300/50 shadow-[0_2px_8px_rgba(244,63,94,0.4)]'
                          }`}>
                            {recipe.difficulty === 'easy' ? 'Dễ' : recipe.difficulty === 'medium' ? 'Vừa' : 'Khó'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default PopularRecipes
