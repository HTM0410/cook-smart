import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import mealPlanService from '../services/mealPlanService'
import { GroceryList, GroceryItem } from '../types/mealPlan'
import Button from '../components/atoms/Button'
import EmptyState from '../components/molecules/EmptyState'
import { toast } from 'react-toastify'
import {
  ArrowLeft, Printer, Calendar, Check, ShoppingCart, Package,
  X, ChevronDown
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

  const categoryColors: Record<string, string> = {
    'Rau củ': 'from-green-400 to-emerald-500',
    'Thịt': 'from-red-400 to-rose-500',
    'Cá': 'from-blue-400 to-cyan-500',
    'Gia vị': 'from-amber-400 to-orange-500',
    'Khác': 'from-gray-400 to-gray-500',
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-3xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-6 text-5xl animate-float">🔐</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Vui lòng đăng nhập</h2>
          <Link to="/login" className="btn btn-primary btn-lg mt-4">Đăng nhập</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-in-up">
          <div>
            <Link to={`/meal-plans/${id}`} className="inline-flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 mb-3 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Quay lại thực đơn
            </Link>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
              Danh sách <span className="text-gradient">đi chợ</span>
            </h1>
            {groceryList && (
              <p className="text-muted-foreground text-sm mt-1">{groceryList.mealPlanName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4" />
              In danh sách
            </Button>
          </div>
        </div>

        {/* Date Filter */}
        <div className="card p-4 mb-6 animate-fade-in-up">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Từ ngày</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
            </div>
            <div>
              <label className="label">Đến ngày</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input" />
            </div>
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate('') }} className="w-full justify-center">
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </div>

        {/* Progress */}
        {groceryList && groceryList.items.length > 0 && (
          <div className="card p-5 mb-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-md">
                  <ShoppingCart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {checkedCount} / {totalCount} mục
                  </h3>
                  <p className="text-xs text-gray-400">Đã hoàn thành</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-500">
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
            <div className="progress-bar h-3">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && groceryList && groceryList.items.length === 0 && (
          <div className="card">
            <EmptyState variant="grocery" />
          </div>
        )}

        {/* Grocery List */}
        {!loading && groceryList && groceryList.items.length > 0 && (
          <div className="space-y-6 animate-fade-in-up">
            {Object.entries(groupedItems || {}).map(([category, items], index) => {
              const colorClass = categoryColors[category] || categoryColors['Khác']
              const categoryChecked = items.filter(item => checkedItems.has(item.ingredientId)).length
              return (
                <div key={category} className="card overflow-hidden" style={{ animationDelay: `${index * 0.1}s` }}>
                  {/* Category Header */}
                  <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorClass} flex items-center justify-center shadow-sm`}>
                        <Package className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">{category}</h2>
                        <p className="text-xs text-gray-400">{items.length} nguyên liệu</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-400">{categoryChecked}/{items.length}</span>
                      <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${items.length > 0 ? (categoryChecked / items.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="p-3 space-y-2">
                    {items.map((item) => {
                      const isChecked = checkedItems.has(item.ingredientId)
                      return (
                        <button
                          key={item.ingredientId}
                          onClick={() => toggleItem(item.ingredientId)}
                          className={`w-full flex items-center gap-4 p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                            isChecked
                              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                              : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                            isChecked
                              ? 'bg-gradient-to-br from-green-400 to-emerald-500 border-green-500 text-white shadow-sm'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}>
                            {isChecked && <Check className="w-4 h-4" strokeWidth={3} />}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-sm transition-all ${
                              isChecked ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'
                            }`}>
                              {item.ingredientName}
                            </p>
                            <p className={`text-xs mt-0.5 transition-all ${
                              isChecked ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400'
                            }`}>
                              {item.totalQuantity} {item.unit}
                              {item.recipes.length > 0 && (
                                <span className="ml-1 text-gray-300 dark:text-gray-600">— cho: {item.recipes.slice(0, 2).join(', ')}{item.recipes.length > 2 ? ` +${item.recipes.length - 2}` : ''}</span>
                              )}
                            </p>
                          </div>

                          {/* Toggle */}
                          <div className="flex-shrink-0">
                            {isChecked ? (
                              <span className="text-xs font-bold text-green-500">Đã mua</span>
                            ) : (
                              <span className="text-xs font-bold text-gray-300">Chưa mua</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Summary */}
            <div className="card p-5 bg-gradient-to-r from-primary-50 to-amber-50 dark:from-primary-900/10 dark:to-amber-900/10 border-primary-100 dark:border-primary-800/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Tổng kết</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {totalCount - checkedCount} nguyên liệu còn lại
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-500 to-amber-500">
                    {Math.round(progress)}%
                  </div>
                  <p className="text-xs text-gray-400">hoàn thành</p>
                </div>
              </div>
              {progress === 100 && (
                <div className="mt-4 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-center">
                  <span className="text-sm font-bold text-green-700 dark:text-green-400">Hoàn thành! Bạn đã mua hết các nguyên liệu 🎉</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GroceryListPage
