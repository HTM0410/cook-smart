import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import recipeService from '../../services/recipeService'
import FavoriteButton from '../atoms/FavoriteButton'
import { useAuth } from '../../contexts/AuthContext'
import { Recipe } from '../../types/recipe'
import { ChevronLeft, ChevronRight, Star, Clock } from 'lucide-react'

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

        // Sort by popularity: most reviews/favorites
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
    <section className="py-16 lg:py-20 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="container">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary-50 dark:bg-secondary-900/20 text-secondary-600 dark:text-secondary-400 text-xs font-bold uppercase tracking-wider mb-3">
              🔥 Xu hướng
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white">
              Công thức <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary-500 to-teal-500">phổ biến</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:shadow-md transition-all active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:shadow-md transition-all active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll */}
        <div className="relative group">
          <div
            ref={scrollRef}
            className="flex gap-5 overflow-x-auto pb-4 -mx-2 px-2 hide-scrollbar snap-x snap-mandatory"
          >
            {recipes.map((recipe) => (
              <Link
                key={recipe.id}
                to={`/recipes/${recipe.id}`}
                className="flex-shrink-0 w-64 snap-start group/card"
              >
                <div className="card overflow-hidden hover:shadow-xl hover:shadow-primary-500/10 transition-all duration-500 hover:-translate-y-1">
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden">
                    {recipe.imageUrl && !imageErrors.has(recipe.id) ? (
                      <img
                        src={recipe.imageUrl}
                        alt={recipe.recipeName}
                        loading="lazy"
                        className="h-full w-full object-cover transform transition-transform duration-700 group-hover/card:scale-110"
                        onError={() => handleImageError(recipe.id)}
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center text-5xl">
                        🍳
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Rating */}
                    <div className="absolute bottom-3 left-3">
                      <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-lg px-2.5 py-1">
                        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-white text-xs font-bold">
                          {((recipe as any).averageRating ?? 0).toFixed(1)}
                        </span>
                      </div>
                    </div>

                    {/* Favorite */}
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

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1 line-clamp-2 group-hover/card:text-primary-600 dark:group-hover/card:text-primary-400 transition-colors">
                      {recipe.recipeName}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {recipe.prepTime + recipe.cookTime}p
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
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
        </div>
      </div>
    </section>
  )
}

export default PopularRecipes
