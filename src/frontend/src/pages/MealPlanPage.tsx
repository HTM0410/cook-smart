import React, { useState, useEffect, useMemo } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useMealPlan } from '../contexts/MealPlanContext'
import { useAuth } from '../contexts/AuthContext'
import { WeekDay, MealType } from '../types/mealPlan'
import ConflictAlert from '../components/molecules/ConflictAlert'
import RecipeSelector from '../components/organisms/RecipeSelector'
import MealSlot from '../components/molecules/MealSlot'
import Button from '../components/atoms/Button'
import {
  Calendar, ChevronLeft, ChevronRight, Plus, ShoppingCart,
  Trash2, Clock, X
} from 'lucide-react'

const DAYS_OF_WEEK = [
  { id: 1, name: 'Thứ Hai', shortName: 'T2' },
  { id: 2, name: 'Thứ Ba', shortName: 'T3' },
  { id: 3, name: 'Thứ Tư', shortName: 'T4' },
  { id: 4, name: 'Thứ Năm', shortName: 'T5' },
  { id: 5, name: 'Thứ Sáu', shortName: 'T6' },
  { id: 6, name: 'Thứ Bảy', shortName: 'T7' },
  { id: 0, name: 'Chủ Nhật', shortName: 'CN' },
]

const MEAL_ICONS: Record<MealType, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍪',
}

const MealPlanPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { state, fetchPlans, fetchMealPlan, createMealPlan, deleteMealPlan } = useMealPlan()
  const { currentPlan, plans, loading, conflicts, pendingChanges, isOnline } = state

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showRecipeSelector, setShowRecipeSelector] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; mealType: MealType } | null>(null)
  const [newPlanName, setNewPlanName] = useState('')
  const [newStartDate, setNewStartDate] = useState('')
  const [newEndDate, setNewEndDate] = useState('')
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(getStartOfWeek(new Date()))

  useEffect(() => { fetchPlans() }, [fetchPlans])
  useEffect(() => { if (id && !isNaN(parseInt(id))) fetchMealPlan(parseInt(id)) }, [id, fetchMealPlan])

  function getStartOfWeek(date: Date): Date {
    const d = new Date(date); const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(d.setDate(diff))
  }

  function addDays(date: Date, days: number): Date {
    const result = new Date(date); result.setDate(result.getDate() + days); return result
  }

  function formatDate(date: Date): string { return date.toISOString().split('T')[0] }

  const weekDays: WeekDay[] = useMemo(() => {
    const today = formatDate(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(selectedWeekStart, i)
      const dateStr = formatDate(date)
      const dayOfWeek = date.getDay()
      return {
        date: dateStr,
        dayName: DAYS_OF_WEEK.find((d) => d.id === dayOfWeek)?.shortName || '',
        dayOfWeek,
        isToday: dateStr === today,
        items: {
          breakfast: currentPlan?.items.filter((item) => item.plannedDate === dateStr && item.mealType === 'breakfast') || [],
          lunch: currentPlan?.items.filter((item) => item.plannedDate === dateStr && item.mealType === 'lunch') || [],
          dinner: currentPlan?.items.filter((item) => item.plannedDate === dateStr && item.mealType === 'dinner') || [],
          snack: currentPlan?.items.filter((item) => item.plannedDate === dateStr && item.mealType === 'snack') || [],
        },
      }
    })
  }, [selectedWeekStart, currentPlan])

  const handleCreatePlan = async () => {
    if (!newPlanName || !newStartDate || !newEndDate) return
    const plan = await createMealPlan({ planName: newPlanName, startDate: newStartDate, endDate: newEndDate })
    if (plan) {
      setShowCreateModal(false)
      navigate(`/meal-plans/${plan.id}`)
    }
  }

  const handleDeletePlan = async (planId: number) => {
    if (window.confirm('Bạn có chắc muốn xóa thực đơn này?')) {
      await deleteMealPlan(planId)
      navigate('/meal-plans')
    }
  }

  const handleSelectSlot = (date: string, mealType: MealType) => {
    setSelectedSlot({ date, mealType })
    setShowRecipeSelector(true)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-3xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-6 text-5xl animate-float">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Vui lòng đăng nhập</h2>
          <p className="text-gray-500 mb-6">Đăng nhập để sử dụng tính năng lập thực đơn thông minh.</p>
          <Link to="/login" className="btn btn-primary btn-lg">Đăng nhập ngay</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-fade-in-up">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-500 to-amber-500 flex items-center justify-center shadow-md">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Thực đơn <span className="text-gradient">tuần</span>
              </h1>
            </div>
            <p className="text-muted-foreground text-sm ml-13">Lên kế hoạch bữa ăn lành mạnh cho cả tuần</p>
          </div>
          <div className="flex items-center gap-3">
            {!isOnline && (
              <span className="chip chip-active text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse-soft" />
                Offline
              </span>
            )}
            {pendingChanges && (
              <span className="chip chip-active text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <Clock className="w-3 h-3" />
                Đang lưu...
              </span>
            )}
            <Button variant="gradient" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4" />
              Tạo thực đơn mới
            </Button>
          </div>
        </div>

        {/* Plan List */}
        {plans.length > 0 && !currentPlan && (
          <div className="mb-8 animate-fade-in-up">
            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Chọn thực đơn</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => navigate(`/meal-plans/${plan.id}`)}
                  className="card p-5 cursor-pointer hover:shadow-lg hover:shadow-primary-500/10 hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{plan.planName}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                      plan.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      plan.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {plan.status === 'active' ? 'Hoạt động' : plan.status === 'completed' ? 'Hoàn thành' : 'Lưu trữ'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">{plan.startDate} — {plan.endDate}</p>
                  <div className="flex items-center gap-2 text-xs text-primary-600 dark:text-primary-400 font-semibold">
                    Xem chi tiết <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Plan */}
        {currentPlan && (
          <>
            <div className="card p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in-up">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{currentPlan.planName}</h2>
                <p className="text-sm text-gray-400">{currentPlan.startDate} — {currentPlan.endDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link to={`/meal-plans/${currentPlan.id}/grocery-list`} className="btn btn-secondary btn-sm">
                  <ShoppingCart className="w-4 h-4" />
                  Danh sách đi chợ
                </Link>
                <button onClick={() => handleDeletePlan(currentPlan.id)} className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {conflicts.length > 0 && <ConflictAlert conflicts={conflicts} />}

            {/* Week Navigation */}
            <div className="card p-4 mb-6">
              <div className="flex items-center justify-between">
                <button onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, -7))} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <div className="text-base font-bold text-gray-900 dark:text-white">
                    {selectedWeekStart.toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                  <button onClick={() => setSelectedWeekStart(getStartOfWeek(new Date()))} className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 mt-1">
                    Đến tuần này
                  </button>
                </div>
                <button onClick={() => setSelectedWeekStart(addDays(selectedWeekStart, 7))} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="card overflow-hidden animate-fade-in-up">
              {/* Desktop Day Headers */}
              <div className="hidden lg:grid grid-cols-8 gap-2 p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="p-2" />
                {weekDays.map((day) => (
                  <div key={day.date} className={"p-2 text-center rounded-xl transition-all " + (day.isToday ? 'bg-primary-50 dark:bg-primary-900/20' : '')}>
                    <div className={"text-xs font-bold " + (day.isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400')}>
                      {day.dayName}
                    </div>
                    <div className={"text-lg font-extrabold mt-0.5 " + (day.isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300')}>
                      {new Date(day.date).getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mobile: Horizontal scroll */}
              <div className="lg:hidden">
                <div className="flex overflow-x-auto hide-scrollbar">
                  {weekDays.map((day) => (
                    <div key={day.date} className={"flex-shrink-0 w-20 p-3 text-center border-r border-gray-100 dark:border-gray-800 " + (day.isToday ? 'bg-primary-50 dark:bg-primary-900/20' : '')}>
                      <div className={"text-xs font-bold " + (day.isToday ? 'text-primary-600' : 'text-gray-400')}>{day.dayName}</div>
                      <div className={"text-lg font-extrabold " + (day.isToday ? 'text-primary-600' : 'text-gray-700 dark:text-gray-300')}>
                        {new Date(day.date).getDate()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meal Rows */}
              {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mealType) => (
                <div key={mealType} className="grid grid-cols-1 lg:grid-cols-8 gap-2 p-4 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-2 py-2">
                    <span className="text-xl">{MEAL_ICONS[mealType]}</span>
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300 hidden lg:block">
                      {mealType === 'breakfast' ? 'Sáng' : mealType === 'lunch' ? 'Trưa' : mealType === 'dinner' ? 'Tối' : 'Phụ'}
                    </span>
                  </div>
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {weekDays.map((day) => (
                      <MealSlot
                        key={`${day.date}-${mealType}`}
                        date={day.date}
                        mealType={mealType}
                        items={day.items[mealType]}
                        onAddClick={() => handleSelectSlot(day.date, mealType)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Empty State */}
        {!currentPlan && plans.length === 0 && (
          <div className="card p-16 text-center animate-fade-in-up">
            <div className="w-24 h-24 rounded-3xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-6 text-5xl animate-float">📅</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Bắt đầu lập thực đơn</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">Tạo thực đơn cho tuần này để lên kế hoạch bữa ăn dễ dàng với AI gợi ý.</p>
            <Button variant="gradient" size="lg" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-5 h-5" />
              Tạo thực đơn đầu tiên
            </Button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Tạo thực đơn mới</h2>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Tên thực đơn</label>
                <input type="text" value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} placeholder="VD: Tuần 1 tháng 6" className="input" />
              </div>
              <div>
                <label className="label">Ngày bắt đầu</label>
                <input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label">Ngày kết thúc</label>
                <input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="input" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setShowCreateModal(false)}>Hủy</Button>
              <Button variant="gradient" className="flex-1" loading={loading} onClick={handleCreatePlan} disabled={!newPlanName || !newStartDate || !newEndDate}>
                Tạo thực đơn
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Selector */}
      {showRecipeSelector && selectedSlot && (
        <RecipeSelector
          onClose={() => { setShowRecipeSelector(false); setSelectedSlot(null) }}
          onSelect={() => { setShowRecipeSelector(false); setSelectedSlot(null) }}
          date={selectedSlot.date}
          mealType={selectedSlot.mealType}
        />
      )}
    </div>
  )
}

export default MealPlanPage
