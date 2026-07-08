import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'react-toastify'
import { useAuth } from '../contexts/AuthContext'
import { MealType, MealPlan, MealPlanItem } from '../types/mealPlan'
import ConflictAlert from '../components/molecules/ConflictAlert'
import RecipeSelector from '../components/organisms/RecipeSelector'
import mealPlanService from '../services/mealPlanService'
import { EyebrowTag } from '../components/atoms/EyebrowTag'
import { ButtonEditorial } from '../components/atoms/ButtonEditorial'
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, easeFluid } from '../lib/motion'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  ShoppingCart,
  Trash2,
  Sparkles,
  ChefHat,
  ArrowRight,
  X,
  Clock,
  Users,
} from 'lucide-react'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']

const DAY_LABELS: Record<number, { full: string; shortVi: string }> = {
  1: { full: 'Thứ Hai', shortVi: 'T2' },
  2: { full: 'Thứ Ba', shortVi: 'T3' },
  3: { full: 'Thứ Tư', shortVi: 'T4' },
  4: { full: 'Thứ Năm', shortVi: 'T5' },
  5: { full: 'Thứ Sáu', shortVi: 'T6' },
  6: { full: 'Thứ Bảy', shortVi: 'T7' },
  0: { full: 'Chủ Nhật', shortVi: 'CN' },
}

const MEAL_META: Record<MealType, { icon: string; label: string; accent: string }> = {
  breakfast: { icon: '🌅', label: 'Sáng', accent: 'text-[#956400]' },
  lunch: { icon: '☀️', label: 'Trưa', accent: 'text-[#ff4f00]' },
  dinner: { icon: '🌙', label: 'Tối', accent: 'text-[#42513A]' },
  snack: { icon: '🍪', label: 'Phụ', accent: 'text-[#9F2F2D]' },
}

const MealPlanPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [plans, setPlans] = useState<MealPlan[]>([])
  const [currentPlan, setCurrentPlan] = useState<MealPlan | null>(null)
  const [conflicts, setConflicts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [pendingChanges, setPendingChanges] = useState(false)

  const [showRecipeSelector, setShowRecipeSelector] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; mealType: MealType } | null>(null)

  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => getStartOfWeek(new Date()))

  function getStartOfWeek(date: Date): Date {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    return d
  }

  function addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setHours(0, 0, 0, 0)
    result.setDate(result.getDate() + days)
    return result
  }

  function formatDate(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  }

  function getWeekNumber(d: Date): number {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = date.getUTCDay() || 7
    date.setUTCDate(date.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  }

  const today = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const currentWeekStart = useMemo(() => getStartOfWeek(new Date()), [])
  const weekEnd = useMemo(() => addDays(selectedWeekStart, 6), [selectedWeekStart])

  const isCurrentWeek = useMemo(
    () => isSameDay(selectedWeekStart, currentWeekStart),
    [selectedWeekStart, currentWeekStart]
  )

  const weekRangeLabel = useMemo(() => {
    const startStr = selectedWeekStart.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })
    const endStr = weekEnd.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })
    return `${startStr} — ${endStr}`
  }, [selectedWeekStart, weekEnd])

  const planForWeek = useMemo(() => {
    if (!plans.length) return null
    const wStart = formatDate(selectedWeekStart)
    const wEnd = formatDate(weekEnd)
    return plans.find((p) => p.startDate <= wEnd && p.endDate >= wStart) || null
  }, [plans, selectedWeekStart, weekEnd])

  const fetchPlans = useCallback(async () => {
    try {
      const res = await mealPlanService.getMealPlans()
      if (res.success && res.data) {
        setPlans(res.data)
      }
    } catch (e) {
      // silent
    }
  }, [])

  const loadCurrentPlan = useCallback(async (plan: MealPlan) => {
    try {
      setLoading(true)
      const res = await mealPlanService.getMealPlanById(plan.id)
      if (res.success && res.data) {
        setCurrentPlan(res.data)
        setConflicts(res.data.conflicts || [])
      }
    } catch (e) {
      toast.error('Không thể tải chi tiết thực đơn')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setSelectedWeekStart(getStartOfWeek(new Date()))
  }, [])

  useEffect(() => {
    if (!user) {
      setPageLoading(false)
      return
    }
    setPageLoading(true)
    fetchPlans().finally(() => setPageLoading(false))
  }, [user, fetchPlans])

  const planForWeekId = planForWeek?.id ?? null

  useEffect(() => {
    if (!user || !planForWeekId) {
      if (currentPlan && !planForWeekId) {
        setCurrentPlan(null)
        setConflicts([])
      }
      return
    }
    if (!currentPlan || currentPlan.id !== planForWeekId) {
      const target = plans.find((p) => p.id === planForWeekId)
      if (target) loadCurrentPlan(target)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planForWeekId, user])

  useEffect(() => {
    if (!user || pageLoading) return
    if (currentPlan && id !== String(currentPlan.id)) {
      navigate(`/meal-plans/${currentPlan.id}`, { replace: true })
    } else if (!currentPlan && id) {
      navigate('/meal-plans', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPlan?.id, user, pageLoading])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(selectedWeekStart, i)
      const dateStr = formatDate(date)
      const dayOfWeek = date.getDay()
      const labelInfo = DAY_LABELS[dayOfWeek]
      return {
        date: dateStr,
        dayName: labelInfo.shortVi,
        dayFullName: labelInfo.full,
        dayOfWeek,
        dateObj: date,
        isToday: isSameDay(date, today),
        isPast: date < today,
      }
    })
  }, [selectedWeekStart, today])

  const itemsByDayMeal = useMemo(() => {
    const map: Record<string, Record<MealType, MealPlanItem[]>> = {}
    weekDays.forEach((d) => {
      map[d.date] = { breakfast: [], lunch: [], dinner: [], snack: [] }
    })
    if (currentPlan?.items) {
      currentPlan.items.forEach((it) => {
        if (!it.plannedDate) return
        const key = (it.plannedDate + '').slice(0, 10)
        if (map[key] && map[key][it.mealType]) {
          map[key][it.mealType].push(it)
        }
      })
    }
    return map
  }, [weekDays, currentPlan])

  const weekStats = useMemo(() => {
    let totalMeals = 0
    let filledMeals = 0
    weekDays.forEach((d) => {
      MEAL_TYPES.forEach((m) => {
        totalMeals += 1
        if ((itemsByDayMeal[d.date]?.[m] || []).length > 0) filledMeals += 1
      })
    })
    return { totalMeals, filledMeals }
  }, [weekDays, itemsByDayMeal])

  const handlePrevWeek = () => setSelectedWeekStart(addDays(selectedWeekStart, -7))
  const handleNextWeek = () => setSelectedWeekStart(addDays(selectedWeekStart, 7))
  const handleToday = () => setSelectedWeekStart(getStartOfWeek(new Date()))

  const ensurePlanForWeek = async (): Promise<MealPlan | null> => {
    if (currentPlan && planForWeek && currentPlan.id === planForWeek.id) {
      return currentPlan
    }
    if (planForWeek) {
      await loadCurrentPlan(planForWeek)
      return planForWeek
    }
    const wStart = selectedWeekStart
    const wEnd = weekEnd
    const wNum = getWeekNumber(wStart)
    const monthName = wStart.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })
    const planName = `Tuần ${wNum} - ${monthName}`

    setPendingChanges(true)
    try {
      const res = await mealPlanService.createMealPlan({
        planName,
        startDate: formatDate(wStart),
        endDate: formatDate(wEnd),
      })
      if (res.success && res.data) {
        const newPlan = res.data
        setPlans((prev) => [newPlan, ...prev])
        setCurrentPlan(newPlan)
        setConflicts([])
        toast.success(`Đã tạo thực đơn ${planName}`)
        navigate(`/meal-plans/${newPlan.id}`, { replace: true })
        return newPlan
      }
      toast.error('Không thể tạo thực đơn')
      return null
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể tạo thực đơn')
      return null
    } finally {
      setPendingChanges(false)
    }
  }

  const handleSelectSlot = async (date: string, mealType: MealType) => {
    const plan = await ensurePlanForWeek()
    if (!plan) return
    setSelectedSlot({ date, mealType })
    setShowRecipeSelector(true)
  }

  const handleAddRecipe = async (recipeId: number) => {
    if (!selectedSlot || !currentPlan) return
    setPendingChanges(true)
    try {
      const res = await mealPlanService.addRecipeToMealPlan(currentPlan.id, {
        recipeId,
        plannedDate: selectedSlot.date,
        mealType: selectedSlot.mealType,
        servings: 2,
      })
      if (res.success && res.data) {
        await loadCurrentPlan(currentPlan)
        toast.success('Đã thêm món vào thực đơn!')
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể thêm món ăn')
    } finally {
      setPendingChanges(false)
    }
  }

  const handleRemoveItem = async (itemId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!currentPlan) return
    if (!window.confirm('Xóa món này khỏi thực đơn?')) return
    setPendingChanges(true)
    try {
      const res = await mealPlanService.removeRecipeFromMealPlan(currentPlan.id, itemId)
      if (res.success) {
        setCurrentPlan((p) =>
          p ? { ...p, items: p.items.filter((it) => it.id !== itemId) } : p
        )
        if (res.data?.conflicts) setConflicts(res.data.conflicts)
        toast.success('Đã xóa món khỏi thực đơn')
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Không thể xóa món ăn')
    } finally {
      setPendingChanges(false)
    }
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] bg-paper-light dark:bg-ink-800 flex items-center justify-center px-6">
        <div className="text-center max-w-md mx-auto space-y-6">
          <p className="text-display text-6xl text-ink-primary dark:text-paper-light">🔐</p>
          <h2 className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light text-balance">
            Vui lòng đăng nhập.
          </h2>
          <p className="text-ink-secondary text-pretty">
            Đăng nhập để sử dụng tính năng lập thực đơn thông minh.
          </p>
          <Link to="/login" className="btn-editorial-primary inline-flex">
            Đăng nhập
          </Link>
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
            className="lg:col-span-7 space-y-5"
          >
            <EyebrowTag>Thực đơn</EyebrowTag>
            <h1 className="text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
              Thực đơn <span className="text-[#ff4f00]">tuần.</span>
            </h1>
            <p className="text-ink-secondary text-pretty max-w-md">
              7 ngày · 3 bữa/ngày · Bấm vào ô bữa để thêm món.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={splitRevealRight}
            className="lg:col-span-5 flex items-center gap-3 flex-wrap lg:justify-end lg:pb-3"
          >
            {pendingChanges && (
              <span className="chip chip-active text-xs">
                <span className="w-1.5 h-1.5 bg-[#346538] rounded-full animate-pulse" />
                Đang lưu...
              </span>
            )}
            <span className="eyebrow-tag bg-[#EDF3EC] text-[#346538]">
              {weekStats.filledMeals}/{weekStats.totalMeals} bữa đã lên
            </span>
          </motion.div>
        </div>

        {/* Week Navigation */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={cardReveal}
          className="card-bezel mb-8"
        >
          <div className="card-bezel-inner p-5 md:p-6 flex items-center justify-between gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePrevWeek}
              className="w-12 h-12 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-primary dark:text-paper-light hover:ring-ink-primary/30 transition-all duration-700 ease-[var(--ease-fluid)] flex-shrink-0"
              aria-label="Tuần trước"
              title="Tuần trước"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
            </motion.button>

            <div className="flex-1 text-center min-w-0">
              <div className="flex items-center justify-center gap-2 text-base lg:text-lg font-semibold text-ink-primary dark:text-paper-light truncate">
                <Calendar className="w-4 h-4 text-[#ff4f00] flex-shrink-0" strokeWidth={1.5} />
                <span className="truncate">{weekRangeLabel}</span>
              </div>
              <div className="flex items-center justify-center gap-3 mt-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                  {isCurrentWeek ? 'Tuần hiện tại' : 'Tuần khác'}
                </span>
                {!isCurrentWeek && (
                  <button
                    onClick={handleToday}
                    className="link-underline text-xs font-medium text-ink-primary dark:text-paper-light inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" strokeWidth={1.5} />
                    Về tuần này
                  </button>
                )}
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNextWeek}
              className="w-12 h-12 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-primary dark:text-paper-light hover:ring-ink-primary/30 transition-all duration-700 ease-[var(--ease-fluid)] flex-shrink-0"
              aria-label="Tuần sau"
              title="Tuần sau"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
            </motion.button>
          </div>
        </motion.div>

        {/* Plan header (when plan exists) */}
        {currentPlan && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeFluid }}
            className="card-bezel mb-6"
          >
            <div className="card-bezel-inner p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg lg:text-xl font-semibold text-ink-primary dark:text-paper-light truncate text-display">
                  {currentPlan.planName}
                </h2>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-muted mt-1">
                  {currentPlan.startDate} → {currentPlan.endDate} · {currentPlan.items.length} món
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to={`/meal-plans/${currentPlan.id}/grocery-list`}
                  className="btn-editorial-ghost"
                >
                  <ShoppingCart className="w-4 h-4" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Đi chợ</span>
                </Link>
                <button
                  onClick={async () => {
                    if (
                      window.confirm(
                        `Xóa thực đơn "${currentPlan.planName}"? Hành động này không thể hoàn tác.`
                      )
                    ) {
                      try {
                        const res = await mealPlanService.deleteMealPlan(currentPlan.id)
                        if (res.success) {
                          setPlans((prev) => prev.filter((p) => p.id !== currentPlan.id))
                          setCurrentPlan(null)
                          toast.success('Đã xóa thực đơn')
                          navigate('/meal-plans', { replace: true })
                        }
                      } catch (e: any) {
                        toast.error(e?.response?.data?.message || 'Không thể xóa thực đơn')
                      }
                    }
                  }}
                  className="w-10 h-10 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-secondary hover:text-[#9F2F2D] hover:ring-[#9F2F2D]/40 transition-all duration-700 ease-[var(--ease-fluid)]"
                  title="Xóa thực đơn"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {conflicts.length > 0 && currentPlan && <ConflictAlert conflicts={conflicts} />}

        {/* Loading skeleton */}
        {pageLoading ? (
          <div className="card-bezel">
            <div className="card-bezel-inner p-12 text-center">
              <div className="inline-block w-10 h-10 border-2 border-[#ff4f00] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm uppercase tracking-[0.2em] text-ink-muted mt-4">Đang tải thực đơn...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Week Grid */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerGrid}
              className="card-bezel mb-6"
            >
              <div className="card-bezel-inner p-4 sm:p-5 lg:p-6">
                {/* Day Headers */}
                <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] sm:grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-1.5 sm:gap-2 mb-3">
                  <div />
                  {weekDays.map((day) => (
                    <div
                      key={`hdr-${day.date}`}
                      className={`flex flex-col items-center justify-center py-2 rounded-xl transition-all duration-500 ease-[var(--ease-fluid)] ${
                        day.isToday
                          ? 'bg-[#ff4f00] text-white'
                          : day.isPast
                          ? 'bg-paper-light dark:bg-ink-700/40 text-ink-muted'
                          : 'bg-paper-light dark:bg-ink-700/40 text-ink-primary dark:text-paper-light'
                      }`}
                    >
                      <div className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em]">
                        {day.dayName}
                      </div>
                      <div className="text-lg sm:text-xl lg:text-2xl font-bold leading-tight">
                        {day.dateObj.getDate()}
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-medium opacity-70 mt-0.5 hidden sm:block">
                        {day.dateObj.toLocaleDateString('vi-VN', { month: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Body */}
                <div className="space-y-2">
                  {MEAL_TYPES.map((mealType, idx) => {
                    const meta = MEAL_META[mealType]
                    return (
                      <motion.div
                        key={`row-${mealType}`}
                        custom={idx}
                        variants={cardReveal}
                        className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] sm:grid-cols-[80px_repeat(7,minmax(0,1fr))] gap-1.5 sm:gap-2"
                      >
                        {/* Label bữa ăn */}
                        <div
                          className={`flex flex-col items-center justify-center rounded-2xl bg-paper-light dark:bg-ink-700/40 py-3 px-1 sm:px-2 ring-1 ring-ink-200/40 dark:ring-ink-700/40`}
                        >
                          <span className="text-2xl sm:text-3xl">{meta.icon}</span>
                          <span className={`text-[10px] sm:text-xs font-bold uppercase tracking-[0.15em] mt-1 text-center ${meta.accent}`}>
                            {meta.label}
                          </span>
                        </div>

                        {/* 7 ô ngày */}
                        {weekDays.map((day) => {
                          const items = itemsByDayMeal[day.date]?.[mealType] || []
                          return (
                            <div
                              key={`${day.date}-${mealType}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => handleSelectSlot(day.date, mealType)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  handleSelectSlot(day.date, mealType)
                                }
                              }}
                              aria-disabled={loading}
                              className={`group relative min-h-[110px] rounded-2xl text-left transition-all duration-500 ease-[var(--ease-fluid)] p-1.5 sm:p-2 flex flex-col gap-1.5 cursor-pointer ${
                                items.length > 0
                                  ? 'bg-paper-light dark:bg-ink-700/60 ring-1 ring-ink-200/40 dark:ring-ink-700/40 hover:ring-[#ff4f00]/40'
                                  : 'border border-dashed border-ink-200/60 dark:border-ink-700/60 bg-transparent hover:border-[#ff4f00] hover:bg-[#fff4ed]/40 dark:hover:bg-[#ff4f00]/10'
                              } ${loading ? 'opacity-60 pointer-events-none' : ''}`}
                            >
                              {items.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-ink-muted group-hover:text-[#ff4f00] transition-colors duration-500 ease-[var(--ease-fluid)]">
                                  <Plus className="w-5 h-5 sm:w-6 sm:h-6 mb-1" strokeWidth={1.5} />
                                  <span className="text-[10px] font-semibold uppercase tracking-wide">Thêm món</span>
                                </div>
                              ) : (
                                <>
                                  {items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="relative group/item rounded-lg overflow-hidden bg-white dark:bg-ink-800 ring-1 ring-ink-200/40 dark:ring-ink-700/40 hover:ring-[#ff4f00] transition-all duration-500 ease-[var(--ease-fluid)]"
                                    >
                                      <div className="flex gap-1.5 p-1.5 items-center">
                                        {item.recipe?.imageUrl ? (
                                          <img
                                            src={item.recipe.imageUrl}
                                            alt={item.recipe?.recipeName}
                                            className="w-10 h-10 sm:w-12 sm:h-12 rounded-md object-cover flex-shrink-0"
                                          />
                                        ) : (
                                          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-md flex-shrink-0 bg-paper-light dark:bg-ink-700 flex items-center justify-center text-base sm:text-lg">
                                            {meta.icon}
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <p
                                            className="text-[10px] sm:text-[11px] font-semibold text-ink-primary dark:text-paper-light line-clamp-2 leading-tight"
                                            title={item.recipe?.recipeName}
                                          >
                                            {item.recipe?.recipeName || 'Món ăn'}
                                          </p>
                                          <div className="flex items-center gap-1.5 mt-0.5 text-[9px] uppercase tracking-wide text-ink-muted">
                                            {item.servings > 0 && (
                                              <span className="flex items-center gap-0.5">
                                                <Users className="w-2.5 h-2.5" strokeWidth={1.5} />
                                                {item.servings}
                                              </span>
                                            )}
                                            {((item.recipe?.prepTime || 0) +
                                              (item.recipe?.cookTime || 0)) > 0 && (
                                              <span className="flex items-center gap-0.5">
                                                <Clock className="w-2.5 h-2.5" strokeWidth={1.5} />
                                                {(item.recipe?.prepTime || 0) +
                                                  (item.recipe?.cookTime || 0)}p
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <button
                                        onClick={(e) => handleRemoveItem(item.id, e)}
                                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white dark:bg-ink-800 ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-secondary hover:text-[#9F2F2D] hover:ring-[#9F2F2D] opacity-0 group-hover/item:opacity-100 transition-all duration-500 ease-[var(--ease-fluid)] flex items-center justify-center"
                                        title="Xóa món"
                                      >
                                        <X className="w-3 h-3" strokeWidth={1.5} />
                                      </button>
                                    </div>
                                  ))}
                                  <div className="mt-auto pt-1 border-t border-dashed border-ink-200/40 dark:border-ink-700/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                                    <div className="flex items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ff4f00]">
                                      <Plus className="w-3 h-3" strokeWidth={1.5} />
                                      Thêm món
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )
                        })}
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Nudge banner if no plan exists for this week */}
            {!planForWeek && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeFluid }}
                className="card-bezel"
              >
                <div className="card-bezel-inner p-6 bg-[#fff4ed]/40 dark:bg-[#ff4f00]/5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="w-12 h-12 rounded-full ring-1 ring-[#ff4f00]/30 bg-paper-light dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
                      <ChefHat className="w-6 h-6 text-[#ff4f00]" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light text-display">
                        Chưa có thực đơn cho tuần này
                      </h3>
                      <p className="text-sm text-ink-secondary mt-1 text-pretty">
                        Bấm vào ô bữa bất kỳ — hệ thống sẽ tự tạo thực đơn cho tuần này.
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const p = await ensurePlanForWeek()
                        if (p) toast.success('Đã tạo thực đơn!')
                      }}
                      disabled={pendingChanges}
                      className="btn-editorial-primary inline-flex disabled:opacity-50"
                    >
                      {pendingChanges ? 'Đang tạo...' : 'Tạo thực đơn'}
                      {!pendingChanges && <ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Recipe Selector */}
      {showRecipeSelector && selectedSlot && (
        <RecipeSelector
          onClose={() => {
            setShowRecipeSelector(false)
            setSelectedSlot(null)
          }}
          onSelect={(recipeId) => {
            setShowRecipeSelector(false)
            handleAddRecipe(recipeId)
            setSelectedSlot(null)
          }}
          date={selectedSlot.date}
          mealType={selectedSlot.mealType}
        />
      )}
    </div>
  )
}

export default MealPlanPage