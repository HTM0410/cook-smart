import React from 'react'
import { Link } from 'react-router-dom'
import { Search, Heart, BookOpen, Calendar, ShoppingCart, ChefHat, Inbox } from 'lucide-react'
import Button from '../atoms/Button'

type EmptyStateVariant = 'recipes' | 'favorites' | 'search' | 'meal-plan' | 'grocery' | 'general'

interface EmptyStateProps {
  variant?: EmptyStateVariant
  title?: string
  description?: string
  actionLabel?: string
  actionPath?: string
  onAction?: () => void
  className?: string
}

const variantConfig: Record<EmptyStateVariant, {
  icon: React.ElementType
  emoji: string
  defaultTitle: string
  defaultDescription: string
  defaultActionLabel: string
  defaultActionPath: string
}> = {
  recipes: {
    icon: BookOpen,
    emoji: '📖',
    defaultTitle: 'Chưa có công thức nào',
    defaultDescription: 'Hãy bắt đầu khám phá những công thức tuyệt vời từ cộng đồng CookSmart.',
    defaultActionLabel: 'Khám phá công thức',
    defaultActionPath: '/recipes',
  },
  favorites: {
    icon: Heart,
    emoji: '❤️',
    defaultTitle: 'Chưa có công thức yêu thích',
    defaultDescription: 'Lưu lại những công thức bạn thích để xem lại sau.',
    defaultActionLabel: 'Khám phá công thức',
    defaultActionPath: '/recipes',
  },
  search: {
    icon: Search,
    emoji: '🔍',
    defaultTitle: 'Không tìm thấy kết quả',
    defaultDescription: 'Thử thay đổi từ khóa hoặc bộ lọc để tìm kiếm chính xác hơn.',
    defaultActionLabel: 'Xóa bộ lọc',
    defaultActionPath: '/search',
  },
  'meal-plan': {
    icon: Calendar,
    emoji: '📅',
    defaultTitle: 'Chưa có thực đơn nào',
    defaultDescription: 'Tạo thực đơn cho tuần này để lên kế hoạch bữa ăn dễ dàng hơn.',
    defaultActionLabel: 'Tạo thực đơn',
    defaultActionPath: '/meal-plans',
  },
  grocery: {
    icon: ShoppingCart,
    emoji: '🛒',
    defaultTitle: 'Danh sách đi chợ trống',
    defaultDescription: 'Thêm công thức vào thực đơn để tạo danh sách đi chợ tự động.',
    defaultActionLabel: 'Lên thực đơn',
    defaultActionPath: '/meal-plans',
  },
  general: {
    icon: Inbox,
    emoji: '📭',
    defaultTitle: 'Không có dữ liệu',
    defaultDescription: 'Không có gì để hiển thị ở đây.',
    defaultActionLabel: 'Quay lại',
    defaultActionPath: '/',
  },
}

const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'general',
  title,
  description,
  actionLabel,
  actionPath,
  onAction,
  className = '',
}) => {
  const config = variantConfig[variant]
  const IconComponent = config.icon

  const handleClick = () => {
    if (onAction) {
      onAction()
    }
  }

  return (
    <div className={`empty-state ${className}`}>
      {/* Illustration */}
      <div className="relative mb-8">
        <div className="w-28 h-28 mx-auto rounded-3xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center shadow-inner-soft">
          <span className="text-5xl animate-float">{config.emoji}</span>
        </div>
        {/* Decorative ring */}
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <div className="w-36 h-36 rounded-full border-2 border-dashed border-gray-200 dark:border-gray-700 animate-spin-slower opacity-30" />
        </div>
      </div>

      {/* Text */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3 animate-slide-up">
        {title || config.defaultTitle}
      </h3>
      <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {description || config.defaultDescription}
      </p>

      {/* Action */}
      <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {actionPath ? (
          <Link to={actionPath || config.defaultActionPath}>
            <Button variant="gradient" size="lg" onClick={onAction}>
              <IconComponent className="w-5 h-5" />
              {actionLabel || config.defaultActionLabel}
            </Button>
          </Link>
        ) : onAction ? (
          <Button variant="gradient" size="lg" onClick={handleClick}>
            <IconComponent className="w-5 h-5" />
            {actionLabel || config.defaultActionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export default EmptyState
