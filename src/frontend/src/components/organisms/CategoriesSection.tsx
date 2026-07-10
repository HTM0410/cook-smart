import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { EyebrowTag } from '../atoms/EyebrowTag'
import { ButtonEditorial } from '../atoms/ButtonEditorial'
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, viewportOnce } from '../../lib/motion'

// Curated Unsplash photos that actually match the category name.
// Each image was picked so the hero plate reads as the dish the label promises.
const CATEGORIES = [
  {
    id: 1,
    name: 'Món chính',
    description: 'Đầy đủ dinh dưỡng cho cả gia đình',
    count: 45,
    featured: true,
    // Bữa cơm gia đình đầy đặn — khay cơm nhiều món
    image: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=1200&h=900&fit=crop&q=80',
  },
  {
    id: 2,
    name: 'Món khai vị',
    description: 'Ngon miệng, hấp dẫn',
    count: 23,
    featured: false,
    // Đĩa salad / gỏi khai vị tươi
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=900&h=900&fit=crop&q=80',
  },
  {
    id: 3,
    name: 'Tráng miệng',
    description: 'Ngọt ngào, tinh tế',
    count: 18,
    featured: false,
    // Bánh ngọt / kem tráng miệng
    image: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=900&h=900&fit=crop&q=80',
  },
  {
    id: 4,
    name: 'Đồ uống',
    description: 'Giải khát, thơm ngon',
    count: 12,
    featured: false,
    // Ly cocktail / nước ép mát mẻ
    image: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=900&h=900&fit=crop&q=80',
  },
  {
    id: 5,
    name: 'Món chay',
    description: 'Bổ dưỡng, lành mạnh',
    count: 31,
    featured: false,
    // Bowl chay rau củ quinoa
    image: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6?w=900&h=900&fit=crop&q=80',
  },
  {
    id: 6,
    name: 'Món nhanh',
    description: 'Dễ làm, tiện lợi',
    count: 27,
    featured: false,
    // Sandwich / bữa nhanh gọn
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=900&h=900&fit=crop&q=80',
  },
]

const CategoriesSection: React.FC = () => {
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
            <EyebrowTag>Khám phá theo danh mục</EyebrowTag>
            <h2 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
              Nguồn cảm hứng
              <br />
              <span className="text-ink-muted">bất tận.</span>
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
              Từ món chính bổ dưỡng đến đồ uống giải khát — chọn danh mục phù hợp với tâm trạng của bạn hôm nay.
            </p>
            <ButtonEditorial variant="ghost" size="sm" trailingIcon={<ArrowUpRight className="w-3.5 h-3.5" />}>
              <Link to="/categories">Tất cả danh mục</Link>
            </ButtonEditorial>
          </motion.div>
        </div>

        {/* Bento Grid - 4 columns */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerGrid}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5"
        >
          {/* Featured large card */}
          <motion.div variants={cardReveal} className="col-span-2 row-span-2">
            <Link
              to={`/recipes?category=${CATEGORIES[0].id}`}
              className="group block h-full"
            >
              <article className="card-bezel h-full">
                <div className="card-bezel-inner p-0 overflow-hidden relative aspect-square md:aspect-auto md:min-h-[460px]">
                  <img
                    src={CATEGORIES[0].image}
                    alt={CATEGORIES[0].name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-700/80 via-ink-700/20 to-transparent" />

                  <div className="relative h-full flex flex-col justify-between p-7 md:p-9">
                    <span className="inline-flex items-center rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider bg-white/95 text-[#1A1814] border border-white/40 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.25)] self-start">
                      {CATEGORIES[0].count}+ công thức
                    </span>

                    <div>
                      <h3 className="text-display text-4xl md:text-5xl text-white mb-3 text-balance">
                        {CATEGORIES[0].name}
                      </h3>
                      <p className="text-sm text-white/70 mb-5 max-w-[28ch]">
                        {CATEGORIES[0].description}
                      </p>
                      <div className="inline-flex items-center gap-2 text-sm font-medium text-white">
                        <span>Khám phá</span>
                        <span className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-110">
                          <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          </motion.div>

          {CATEGORIES.slice(1).map((category) => (
            <motion.div key={category.id} variants={cardReveal}>
              <Link
                to={`/recipes?category=${category.id}`}
                className="group block h-full"
              >
                <article className="card-bezel h-full">
                  <div className="card-bezel-inner p-0 overflow-hidden relative aspect-square">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-700/70 to-transparent" />

                    <div className="relative h-full flex flex-col justify-end p-5">
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider bg-white/95 text-[#1A1814] border border-white/40 backdrop-blur-md shadow-[0_2px_8px_rgba(0,0,0,0.2)] self-start mb-2">
                        {category.count}+
                      </span>
                      <h3 className="text-display text-2xl text-white">
                        {category.name}
                      </h3>
                    </div>
                  </div>
                </article>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default CategoriesSection
