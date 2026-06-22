import { Link, useLocation } from 'react-router-dom'
import { Home, Search, Calendar, Heart, ChefHat } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const BottomNav: React.FC = () => {
  const location = useLocation()
  const { user } = useAuth()

  const navItems = [
    { label: 'Trang chủ', path: '/', icon: Home },
    { label: 'Tìm kiếm', path: '/search', icon: Search },
    { label: 'Thực đơn', path: '/meal-plans', icon: Calendar },
    { label: 'Yêu thích', path: '/favorites', icon: Heart },
  ]

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-all duration-200 ${
                active
                  ? 'text-primary-500'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <div className={`relative ${active ? 'scale-110' : ''} transition-transform duration-200`}>
                <item.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                {active && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary-500 rounded-full" />
                )}
              </div>
              <span className={`text-[10px] font-semibold transition-colors ${
                active ? 'text-primary-500' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
