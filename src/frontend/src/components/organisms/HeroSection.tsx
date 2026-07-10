import React, { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Camera, Upload, ChefHat, Sparkles } from 'lucide-react'
import IngredientDetectionModal from './IngredientDetectionModal'
import { EyebrowTag } from '../atoms/EyebrowTag'
import {
  easeFluid,
  splitRevealLeft,
  splitRevealRight,
  staggerContainer,
  cardReveal,
  viewportOnce,
} from '../../lib/motion'

const HeroSection: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [keyword, setKeyword] = useState('')
  const [isDetectionModalOpen, setIsDetectionModalOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const safeDecode = (value: string | null): string => {
    if (!value) return ''
    try {
      let decoded = value
      for (let i = 0; i < 3; i++) {
        const prev = decoded
        decoded = decodeURIComponent(decoded)
        if (prev === decoded) break
      }
      return decoded
    } catch {
      return value
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const queryParam = params.get('query') || params.get('keyword')
    const firstIngredient = params.get('ingredients')?.split(',')[0]
    if (queryParam) setKeyword(safeDecode(queryParam))
    else if (firstIngredient) setKeyword(safeDecode(firstIngredient))
  }, [location.search])

  const triggerSearch = async (value: string) => {
    const cleanValue = value.trim()
    if (!cleanValue) return
    const params = new URLSearchParams()
    if (cleanValue.includes(',')) {
      params.set('ingredients', cleanValue.split(',').map((item) => item.trim()).filter(Boolean).join(','))
    } else {
      params.set('query', cleanValue)
    }
    navigate({ pathname: '/search', search: params.toString() })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    triggerSearch(keyword)
  }

  const handleCameraClick = () => {
    setIsDetectionModalOpen(true)
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setIsDetectionModalOpen(true)
      e.target.value = ''
    }
  }

  const handleDetectionConfirm = (ingredients: string[]) => {
    if (ingredients.length > 0) {
      const params = new URLSearchParams()
      params.set('ingredients', ingredients.join(','))
      navigate({ pathname: '/search', search: params.toString() })
    }
  }

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden bg-paper-light dark:bg-ink-800">
      {/* Subtle warm radial backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,79,0,0.06)_0%,transparent_70%)]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(122,139,111,0.05)_0%,transparent_70%)]" />
      </div>

      <div className="container relative z-10 pt-32 md:pt-40 pb-20 lg:py-32">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
        >
          {/* Left - Text */}
          <motion.div variants={splitRevealLeft} className="lg:col-span-7">
            <EyebrowTag dotColor="bg-[#ff4f00]">AI-powered cooking</EyebrowTag>

            <h1 className="mt-6 text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-display text-ink-primary dark:text-paper-light mb-8 text-balance">
              Tìm công thức.
              <br />
              <span className="text-ink-muted">Nấu ăn ngon.</span>
            </h1>

            <p className="text-lg md:text-xl text-ink-secondary leading-relaxed max-w-[52ch] mb-10 text-pretty">
              CookSmart giúp bạn tìm kiếm món ăn theo tên hoặc nguyên liệu.
              Chỉ cần một cuộc chăm là có ngay công thức phù hợp.
            </p>

            {/* Search bar - clean rectangle with icon + submit */}
            <form onSubmit={handleSubmit} className="max-w-xl mb-8">
              <div
                className="flex items-center gap-2 rounded-xl bg-white dark:bg-[#161310] px-4 h-14 transition-all"
                style={{
                  border: '1px solid var(--admin-border-strong, #E2E8F0)',
                  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                }}
              >
                <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#64748B' }} strokeWidth={2} />
                <input
                  id="hero-search-input"
                  name="search"
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm công thức, nguyên liệu..."
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm md:text-base placeholder:text-[#64748B] h-full"
                  style={{ color: '#0F172A' }}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-[#F1F5F9] transition-colors"
                    style={{ color: '#475569' }}
                    title="Tải ảnh nguyên liệu"
                  >
                    <Upload className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-[#F1F5F9] transition-colors"
                    style={{ color: '#475569' }}
                    title="Chụp ảnh nguyên liệu"
                  >
                    <Camera className="w-4 h-4" strokeWidth={2} />
                  </button>
                  <button
                    type="submit"
                    className="h-9 px-3 rounded-md text-sm font-semibold flex items-center gap-1.5 ml-1"
                    style={{ background: '#ff4f00', color: '#fff' }}
                    aria-label="Tìm kiếm"
                  >
                    <Search className="w-4 h-4" strokeWidth={2} />
                    Tìm
                  </button>
                </div>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-6 text-sm">
              <a
                href="/search"
                className="link-underline text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light font-medium"
              >
                Bộ lọc nâng cao
              </a>
              <span className="text-ink-200">/</span>
              <a
                href="/recipes"
                className="link-underline text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light font-medium"
              >
                Tất cả công thức
              </a>
            </div>
          </motion.div>

          {/* Right - Z-axis cascade of editorial images */}
          <motion.div
            variants={splitRevealRight}
            className="lg:col-span-5 relative h-[460px] md:h-[540px]"
          >
            <div className="relative w-full h-full">
              <motion.div
                custom={0}
                initial="hidden"
                animate="visible"
                variants={cardReveal}
                className="absolute top-0 right-0 w-64 md:w-80 aspect-[4/5] rounded-squircle overflow-hidden shadow-ambient-lg rotate-[3deg] z-30"
              >
                <img
                  src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=1000&fit=crop"
                  alt="Bát salad tươi"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-700/30 to-transparent" />
              </motion.div>

              <motion.div
                custom={1}
                initial="hidden"
                animate="visible"
                variants={cardReveal}
                className="absolute top-12 left-0 w-44 md:w-56 aspect-square rounded-squircle overflow-hidden shadow-ambient -rotate-[4deg] z-20"
              >
                <img
                  src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=600&fit=crop"
                  alt="Món pasta hấp dẫn"
                  className="w-full h-full object-cover"
                />
              </motion.div>

              <motion.div
                custom={2}
                initial="hidden"
                animate="visible"
                variants={cardReveal}
                className="absolute bottom-0 left-12 md:left-20 w-52 md:w-64 aspect-[4/3] rounded-squircle overflow-hidden shadow-ambient rotate-[2deg] z-10"
              >
                <img
                  src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&h=450&fit=crop"
                  alt="Pizza tươi"
                  className="w-full h-full object-cover"
                />
                {/* Editorial stat overlay */}
                <div className="absolute bottom-3 left-3 right-3 card-bezel">
                  <div className="card-bezel-inner px-3 py-2 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#ff4f00]" strokeWidth={1.5} />
                    <div>
                      <p className="text-xs font-semibold text-ink-primary dark:text-paper-light leading-tight">
                        1,000+ công thức
                      </p>
                      <p className="text-[10px] text-ink-secondary leading-tight">
                        Cập nhật hàng ngày
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, ease: easeFluid, delay: 0.6 }}
                className="absolute -top-4 right-8 z-40 w-16 h-16 rounded-full bg-paper-light dark:bg-ink-700 shadow-ambient flex items-center justify-center"
              >
                <ChefHat className="w-7 h-7 text-[#ff4f00]" strokeWidth={1.5} />
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="mt-20 lg:mt-28 pt-10 border-t border-ink-200/40 dark:border-ink-700/40"
        >
          <div className="grid grid-cols-3 gap-8 max-w-2xl">
            {[
              { value: '1,000+', label: 'Công thức' },
              { value: '50+', label: 'Danh mục' },
              { value: '10K+', label: 'Người dùng' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                custom={i}
                variants={cardReveal}
                className="text-center md:text-left"
              >
                <div className="text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light tracking-editorial">
                  {stat.value}
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-ink-secondary mt-2">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <IngredientDetectionModal
        isOpen={isDetectionModalOpen}
        onClose={() => setIsDetectionModalOpen(false)}
        onConfirm={handleDetectionConfirm}
      />
    </section>
  )
}

export default HeroSection
