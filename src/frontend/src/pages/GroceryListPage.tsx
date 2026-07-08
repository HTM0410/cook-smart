import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import mealPlanService from '../services/mealPlanService'
import { GroceryList, GroceryItem } from '../types/mealPlan'
import { toast } from 'react-toastify'
import { EyebrowTag } from '../components/atoms/EyebrowTag'
import { ButtonEditorial } from '../components/atoms/ButtonEditorial'
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, easeFluid } from '../lib/motion'
import {
  ArrowLeft, Printer, Calendar, Check, ShoppingCart, Package, Sparkles,
} from 'lucide-react'

const GroceryListPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (!id || isNaN(parseInt(id))) {
      toast.error('Không tìm thấy thực đơn')
      navigate('/meal-plans')
      return
    }
    fetchGroceryList()
  }, [id, startDate, endDate])

  const fetchGroceryList = async () => {
    try {
      setLoading(true)
      const response = await mealPlanService.getGroceryList(
        parseInt(id!),
        startDate || undefined,
        endDate || undefined
      )
      if (response.success && response.data) setGroceryList(response.data)
    } catch {
      toast.error('Không thể tải danh sách đi chợ')
    } finally {
      setLoading(false)
    }
  }

  const toggleItem = (ingredientId: number) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev)
      newSet.has(ingredientId) ? newSet.delete(ingredientId) : newSet.add(ingredientId)
      return newSet
    })
  }

  const groupedItems = groceryList?.items.reduce((acc, item) => {
    const category = item.categoryName || 'Khác'
    if (!acc[category]) acc[category] = []
    acc[category].push(item)
    return acc
  }, {} as Record<string, GroceryItem[]>)

  const checkedCount = checkedItems.size
  const totalCount = groceryList?.items.length || 0
  const progress = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0

  const categoryAccent: Record<string, string> = {
    'Rau củ': 'bg-[#EDF3EC] text-[#346538]',
    'Thịt': 'bg-[#FDEBEC] text-[#9F2F2D]',
    'Cá': 'bg-[#E5EDF6] text-[#3D5A80]',
    'Gia vị': 'bg-[#FBF3DB] text-[#956400]',
    'Khác': 'bg-paper-light text-ink-secondary',
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-paper-light dark:bg-ink-800 flex items-center justify-center px-6">
        <div className="text-center max-w-md mx-auto space-y-6">
          <p className="text-display text-6xl text-ink-primary dark:text-paper-light">🔐</p>
          <h2 className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light text-balance">
            Vui lòng đăng nhập
          </h2>
          <Link to="/login" className="btn-editorial-primary inline-flex">Đăng nhập</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper-light dark:bg-ink-800">
      <div className="container pt-32 md:pt-40 pb-16 lg:pb-24">
        {/* Editorial Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end mb-12">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={splitRevealLeft}
            className="lg:col-span-7"
          >
            <Link
              to={`/meal-plans/${id}`}
              className="link-underline text-sm font-medium text-ink-secondary inline-flex items-center gap-1.5 mb-5"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              Quay lại thực đơn
            </Link>
            <EyebrowTag>Danh sách đi chợ</EyebrowTag>
            <h1 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
              Đi chợ
              <br />
              <span className="text-[#ff4f00]">thông minh.</span>
            </h1>
            {groceryList && (
              <p className="mt-6 text-ink-secondary text-lg text-pretty">{groceryList.mealPlanName}</p>
            )}
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={splitRevealRight}
            className="lg:col-span-5 lg:pb-3"
          >
            <div className="flex flex-wrap items-center gap-3 justify-end">
              <button onClick={() => window.print()} className="btn-editorial-ghost">
                <Printer className="w-4 h-4" strokeWidth={1.5} />
                In danh sách
              </button>
            </div>
          </motion.div>
        </div>

        {/* Date Filter */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={cardReveal}
          className="card-bezel mb-6"
        >
          <div className="card-bezel-inner p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-semibold">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-bezel-inner h-11 px-4 text-sm w-full"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-semibold">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-bezel-inner h-11 px-4 text-sm w-full"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setStartDate(''); setEndDate('') }}
                  className="w-full h-11 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light hover:ring-[#ff4f00] transition-all duration-700 ease-[var(--ease-fluid)]"
                >
                  Xóa bộ lọc
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress */}
        <AnimatePresence>
          {groceryList && groceryList.items.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: easeFluid }}
              className="card-bezel mb-6"
            >
              <div className="card-bezel-inner p-5 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#ff4f00] flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="w-5 h-5 text-white" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h3 className="text-display text-xl md:text-2xl text-ink-primary dark:text-paper-light">
                        {checkedCount} <span className="text-ink-muted">/</span> {totalCount} <span className="text-base font-normal text-ink-secondary">mục</span>
                      </h3>
                      <p className="text-xs uppercase tracking-[0.2em] text-ink-muted mt-1">Đã hoàn thành</p>
                    </div>
                  </div>
                  <span className="text-display text-4xl md:text-5xl text-[#ff4f00]">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-2 bg-paper-light dark:bg-ink-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: easeFluid }}
                    className="h-full bg-[#ff4f00] rounded-full"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && (
          <div className="card-bezel">
            <div className="card-bezel-inner p-12 text-center">
              <div className="inline-block w-10 h-10 border-2 border-[#ff4f00] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm uppercase tracking-[0.2em] text-ink-muted mt-4">Đang tải danh sách...</p>
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && groceryList && groceryList.items.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeFluid }}
            className="card-bezel max-w-2xl mx-auto"
          >
            <div className="card-bezel-inner p-12 md:p-16 text-center">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-[#ff4f00]/15 blur-3xl rounded-full" />
                <Package className="relative w-20 h-20 text-ink-300 dark:text-ink-200 mx-auto" strokeWidth={1} />
              </div>
              <h2 className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light mb-3 text-balance">
                Chưa có nguyên liệu.
              </h2>
              <p className="text-ink-secondary text-lg text-pretty max-w-md mx-auto">
                Thêm món ăn vào thực đơn để hệ thống tự động gom nguyên liệu cần mua.
              </p>
            </div>
          </motion.div>
        )}

        {/* Grocery List */}
        {!loading && groceryList && groceryList.items.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerGrid}
            className="space-y-5"
          >
            {Object.entries(groupedItems || {}).map(([category, items], index) => {
              const accentClass = categoryAccent[category] || categoryAccent['Khác']
              const categoryChecked = items.filter(item => checkedItems.has(item.ingredientId)).length
              return (
                <motion.div
                  key={category}
                  custom={index}
                  variants={cardReveal}
                  className="card-bezel"
                >
                  <div className="card-bezel-inner p-0 overflow-hidden">
                    {/* Category Header */}
                    <div className="px-5 md:px-6 py-4 border-b border-ink-200/40 dark:border-ink-700/40 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${accentClass}`}>
                          <Package className="w-4 h-4" strokeWidth={1.5} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-ink-primary dark:text-paper-light truncate">
                            {category}
                          </h2>
                          <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                            {items.length} nguyên liệu
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-sm font-semibold text-ink-secondary tabular-nums">
                          {categoryChecked}/{items.length}
                        </span>
                        <div className="w-20 h-1.5 bg-paper-light dark:bg-ink-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${items.length > 0 ? (categoryChecked / items.length) * 100 : 0}%` }}
                            transition={{ duration: 0.6, ease: easeFluid }}
                            className="h-full bg-[#ff4f00] rounded-full"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="p-3 md:p-4 space-y-2">
                      {items.map((item) => {
                        const isChecked = checkedItems.has(item.ingredientId)
                        return (
                          <motion.button
                            key={item.ingredientId}
                            whileHover={{ scale: 1.005 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => toggleItem(item.ingredientId)}
                            className={`w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all duration-500 ease-[var(--ease-fluid)] text-left ${
                              isChecked
                                ? 'bg-[#EDF3EC]/60 dark:bg-[#346538]/10 ring-1 ring-[#346538]/20'
                                : 'bg-paper-light dark:bg-ink-700/40 ring-1 ring-ink-200/40 dark:ring-ink-700/40 hover:ring-[#ff4f00]/40'
                            }`}
                          >
                            {/* Checkbox */}
                            <div className={`w-7 h-7 rounded-full ring-1 flex items-center justify-center flex-shrink-0 transition-all duration-500 ease-[var(--ease-fluid)] ${
                              isChecked
                                ? 'bg-[#346538] ring-[#346538] text-white'
                                : 'ring-ink-200/60 dark:ring-ink-700/60'
                            }`}>
                              {isChecked && <Check className="w-3.5 h-3.5" strokeWidth={2.5} />}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <p className={`font-semibold text-sm transition-all duration-500 ease-[var(--ease-fluid)] ${
                                isChecked ? 'line-through text-ink-muted' : 'text-ink-primary dark:text-paper-light'
                              }`}>
                                {item.ingredientName}
                              </p>
                              <p className={`text-xs mt-1 transition-all duration-500 ease-[var(--ease-fluid)] ${
                                isChecked ? 'text-ink-muted' : 'text-ink-secondary'
                              }`}>
                                {item.totalQuantity} {item.unit}
                                {item.recipes.length > 0 && (
                                  <span className="ml-1 italic">— cho: {item.recipes.slice(0, 2).join(', ')}{item.recipes.length > 2 ? ` +${item.recipes.length - 2}` : ''}</span>
                                )}
                              </p>
                            </div>

                            {/* Toggle */}
                            <div className="flex-shrink-0">
                              <span className={`eyebrow-tag text-[10px] ${isChecked ? 'bg-[#EDF3EC] text-[#346538]' : 'bg-paper-light text-ink-muted'}`}>
                                {isChecked ? 'Đã mua' : 'Chưa mua'}
                              </span>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              )
            })}

            {/* Summary */}
            <motion.div
              variants={cardReveal}
              className="card-bezel"
            >
              <div className="card-bezel-inner p-6 bg-[#fff4ed]/50 dark:bg-[#ff4f00]/5">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-display text-2xl text-ink-primary dark:text-paper-light text-balance">
                      Tổng kết
                    </h3>
                    <p className="text-sm text-ink-secondary mt-1">
                      {totalCount - checkedCount} nguyên liệu còn lại
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-display text-4xl md:text-5xl text-[#ff4f00]">
                      {Math.round(progress)}%
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-ink-muted mt-1">hoàn thành</p>
                  </div>
                </div>
                <AnimatePresence>
                  {progress === 100 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5, ease: easeFluid }}
                      className="p-4 rounded-2xl bg-[#EDF3EC] dark:bg-[#346538]/20 ring-1 ring-[#346538]/30 text-center"
                    >
                      <Sparkles className="w-5 h-5 text-[#346538] mx-auto mb-1.5" strokeWidth={1.5} />
                      <span className="text-sm font-semibold text-[#346538]">
                        Hoàn thành! Bạn đã mua hết các nguyên liệu.
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default GroceryListPage