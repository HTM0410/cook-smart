import React, { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const CATEGORIES = [
  {
    id: 1,
    name: 'Món chính',
    description: 'Đầy đủ dinh dưỡng',
    icon: '🍽️',
    gradient: 'from-orange-400 to-amber-500',
    bgLight: 'bg-orange-50',
    bgDark: 'dark:bg-orange-900/20',
    count: 45,
  },
  {
    id: 2,
    name: 'Món khai vị',
    description: 'Ngon miệng, hấp dẫn',
    icon: '🥗',
    gradient: 'from-emerald-400 to-teal-500',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-900/20',
    count: 23,
  },
  {
    id: 3,
    name: 'Tráng miệng',
    description: 'Ngọt ngào, tinh tế',
    icon: '🍰',
    gradient: 'from-pink-400 to-rose-500',
    bgLight: 'bg-pink-50',
    bgDark: 'dark:bg-pink-900/20',
    count: 18,
  },
  {
    id: 4,
    name: 'Đồ uống',
    description: 'Giải khát, thơm ngon',
    icon: '🥤',
    gradient: 'from-blue-400 to-cyan-500',
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-blue-900/20',
    count: 12,
  },
  {
    id: 5,
    name: 'Món chay',
    description: 'Bổ dưỡng, lành mạnh',
    icon: '🥬',
    gradient: 'from-green-400 to-emerald-500',
    bgLight: 'bg-green-50',
    bgDark: 'dark:bg-green-900/20',
    count: 31,
  },
  {
    id: 6,
    name: 'Món nhanh',
    description: 'Dễ làm, tiện lợi',
    icon: '⚡',
    gradient: 'from-yellow-400 to-orange-500',
    bgLight: 'bg-yellow-50',
    bgDark: 'dark:bg-yellow-900/20',
    count: 27,
  },
  {
    id: 7,
    name: 'Salad',
    description: 'Tươi mát, thanh đạm',
    icon: '🥙',
    gradient: 'from-lime-400 to-green-500',
    bgLight: 'bg-lime-50',
    bgDark: 'dark:bg-lime-900/20',
    count: 15,
  },
  {
    id: 8,
    name: 'Canh & Soup',
    description: 'Ấm bụng, bổ dưỡng',
    icon: '🍲',
    gradient: 'from-amber-400 to-yellow-500',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/20',
    count: 20,
  },
  {
    id: 9,
    name: 'Bánh & Kem',
    description: 'Thơm ngon, đa dạng',
    icon: '🧁',
    gradient: 'from-fuchsia-400 to-pink-500',
    bgLight: 'bg-fuchsia-50',
    bgDark: 'dark:bg-fuchsia-900/20',
    count: 22,
  },
]

const CategoriesSection: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 320
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  return (
    <section className="py-16 lg:py-20 bg-white dark:bg-gray-900 relative overflow-hidden">
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-orange-50/30 via-transparent to-transparent pointer-events-none" />

      <div className="container relative z-10">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-10">
          <div className="animate-slide-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white mb-3 tracking-tight">
              Khám phá theo{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-amber-500">
                Danh mục
              </span>
            </h2>
            <p className="text-muted-foreground text-base max-w-xl">
              Tìm kiếm nguồn cảm hứng bất tận từ các danh mục đa dạng, phù hợp với mọi sở thích.
            </p>
          </div>

          {/* Navigation Arrows */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:shadow-md transition-all active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:shadow-md transition-all active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Horizontal Scroll Carousel */}
        <div className="relative group/carousel">
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 hide-scrollbar"
          >
            {CATEGORIES.map((category, index) => (
              <Link
                key={category.id}
                to={`/recipes?category=${category.id}`}
                className="flex-shrink-0 w-[260px] snap-start group/card"
                style={{ animationDelay: `${index * 0.08}s` }}
              >
                <div className="relative h-full rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-xl hover:shadow-gray-300/30 dark:hover:shadow-gray-950/50 hover:-translate-y-1 group-hover/card:shadow-xl group-hover/card:shadow-primary-500/10">
                  {/* Gradient Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-[0.08] dark:opacity-[0.15] group-hover/card:opacity-[0.12] dark:group-hover/card:opacity-[0.2] transition-opacity duration-300`} />
                  <div className="absolute inset-0 bg-white dark:bg-gray-800" />

                  <div className="relative p-6 h-full flex flex-col">
                    {/* Icon */}
                    <div className="flex items-center justify-between mb-5">
                      <div className={`w-14 h-14 rounded-2xl ${category.bgLight} ${category.bgDark} flex items-center justify-center text-3xl shadow-sm group-hover/card:scale-110 group-hover/card:rotate-3 transition-all duration-300`}>
                        {category.icon}
                      </div>
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        {category.count}+
                      </span>
                    </div>

                    {/* Text */}
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1.5 group-hover/card:text-primary-600 dark:group-hover/card:text-primary-400 transition-colors duration-200">
                        {category.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {category.description}
                      </p>
                    </div>

                    {/* Arrow indicator */}
                    <div className="mt-4 flex items-center gap-1 text-primary-500 opacity-0 group-hover/card:opacity-100 transition-all duration-300 transform translate-y-2 group-hover/card:translate-y-0">
                      <span className="text-xs font-semibold">Xem ngay</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  {/* Bottom accent line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${category.gradient} opacity-0 group-hover/card:opacity-100 transition-opacity duration-300`} />
                </div>
              </Link>
            ))}
          </div>

          {/* Gradient fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white dark:from-gray-900 to-transparent pointer-events-none opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white dark:from-gray-900 to-transparent pointer-events-none opacity-0 group-hover/carousel:opacity-100 transition-opacity z-10" />
        </div>

        {/* Mobile: View all link */}
        <div className="sm:hidden mt-4 text-center">
          <Link
            to="/categories"
            className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors inline-flex items-center gap-1"
          >
            Xem tất cả danh mục
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

export default CategoriesSection
