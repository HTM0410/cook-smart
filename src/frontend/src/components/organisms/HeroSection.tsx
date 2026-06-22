import React, { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Button from '../atoms/Button'
import { Search, Sparkles, ArrowRight, Camera, Upload, X } from 'lucide-react'
import IngredientDetectionModal from './IngredientDetectionModal'

const HeroSection: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [keyword, setKeyword] = useState('')
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
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

  useEffect(() => {
    setTrendingKeywords(['ức gà', 'thịt ba chỉ', 'cá hồi', 'đậu hũ', 'mì xào', 'phở bò', 'bánh mì'])
    setTimeout(() => setIsLoaded(true), 100)
  }, [])

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
      // Reset input to allow selecting same file again
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
    <section id="search-section" className="relative min-h-[680px] flex items-center justify-center overflow-hidden py-16 lg:py-20">
      {/* Animated mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 z-0" />

      {/* Animated blob shapes */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob z-0" />
      <div className="absolute top-1/4 right-1/4 w-[450px] h-[450px] bg-amber-300/20 rounded-full mix-blend-multiply filter blur-3xl opacity-60 animate-blob z-0" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] bg-teal-300/15 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob z-0" style={{ animationDelay: '4s' }} />

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 text-4xl opacity-20 animate-float-slow pointer-events-none hidden lg:block">🍜</div>
      <div className="absolute top-32 right-16 text-3xl opacity-15 animate-float pointer-events-none hidden lg:block">🥗</div>
      <div className="absolute bottom-24 left-20 text-3xl opacity-15 animate-float-slow pointer-events-none hidden lg:block">🍰</div>
      <div className="absolute bottom-36 right-10 text-4xl opacity-20 animate-float pointer-events-none hidden lg:block">🥤</div>
      <div className="absolute top-1/2 left-6 text-2xl opacity-10 animate-wiggle pointer-events-none hidden xl:block">⚡</div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 pattern-dots opacity-[0.03] z-0" />

      <div className="container relative z-10">
        <div className={`max-w-4xl mx-auto text-center space-y-10 transition-all duration-1000 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 shadow-sm animate-slide-down">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
              AI-powered recipe discovery
            </span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white text-balance leading-[1.1]">
              Khám phá
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-500 via-orange-500 to-amber-500"> công thức nấu ăn</span>
              <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-500 to-cyan-500"> tuyệt vời nhất</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-balance font-medium leading-relaxed">
              CookSmart giúp bạn tìm kiếm món ăn tức thì theo tên gọi hoặc nguyên liệu. Mở ra thế giới ẩm thực phong phú ngay trong căn bếp của bạn.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative mt-8">
            <form
              onSubmit={handleSubmit}
              className="relative max-w-2xl mx-auto group"
            >
              <div className="relative flex items-center bg-white dark:bg-gray-800 rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-gray-950/50 border border-gray-100/80 dark:border-gray-700/50 transition-all duration-300 focus-within:shadow-2xl focus-within:shadow-primary-500/15 focus-within:border-primary-200 dark:focus-within:border-primary-700/50 group-hover:shadow-2xl group-hover:shadow-gray-300/30 dark:group-hover:shadow-gray-950/30">
                {/* Search Icon */}
                <div className="pl-6 flex items-center pointer-events-none">
                  <Search className="w-6 h-6 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                </div>

                {/* Input */}
                <input
                  id="hero-search-input"
                  name="search"
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Tìm công thức, nguyên liệu, hoặc món ăn..."
                  className="flex-1 h-16 px-5 bg-transparent text-lg text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
                />

                {/* Voice & Camera buttons */}
                <div className="flex items-center gap-1 pr-2">
                  {/* Hidden file input for upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  {/* Upload button - replaces Mic */}
                  <button
                    type="button"
                    onClick={handleUploadClick}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                    title="Tải ảnh nguyên liệu"
                  >
                    <Upload className="w-5 h-5" />
                  </button>
                  {/* Camera button - opens detection modal */}
                  <button
                    type="button"
                    onClick={handleCameraClick}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                    title="Chụp ảnh nguyên liệu"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                  <Button size="md" type="submit" className="ml-1 h-12 px-6 rounded-xl shadow-md hover:shadow-lg">
                    Tìm kiếm
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* Trending Keywords */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider mr-1">Hot:</span>
            {trendingKeywords.map((kw, i) => (
              <button
                key={kw}
                onClick={() => triggerSearch(kw)}
                className="chip text-xs"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                {kw}
              </button>
            ))}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/search')}
              className="w-full sm:w-auto shadow-sm"
            >
              <Search className="w-5 h-5" />
              Bộ lọc nâng cao
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate('/recipes')}
              className="w-full sm:w-auto text-gray-600 dark:text-gray-300"
            >
              Xem tất cả công thức
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Stats Row */}
          <div className="flex items-center justify-center gap-8 pt-6 animate-fade-in" style={{ animationDelay: '0.7s' }}>
            {[
              { value: '1,000+', label: 'Công thức' },
              { value: '50+', label: 'Danh mục' },
              { value: '10K+', label: 'Người dùng' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-amber-500">
                  {stat.value}
                </div>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ingredient Detection Modal */}
      <IngredientDetectionModal
        isOpen={isDetectionModalOpen}
        onClose={() => setIsDetectionModalOpen(false)}
        onConfirm={handleDetectionConfirm}
      />
    </section>
  )
}

export default HeroSection
