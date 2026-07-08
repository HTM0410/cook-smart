import { Link, useLocation } from 'react-router-dom'
import { Home, Search, Calendar, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { easeFluid } from '../../lib/motion'

const BottomNav: React.FC = () => {
  const location = useLocation()

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
    <nav className="bottom-nav-pill lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => {
          const active = isActive(item.path)
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full"
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-active"
                  className="absolute inset-1 rounded-full bg-paper-light dark:bg-ink-700"
                  transition={{ duration: 0.7, ease: easeFluid }}
                />
              )}
              <span
                className={`relative z-10 flex flex-col items-center justify-center gap-0.5 transition-colors duration-700 ease-[var(--ease-fluid)] ${
                  active
                    ? 'text-ink-primary dark:text-paper-light'
                    : 'text-ink-secondary'
                }`}
              >
                <item.icon
                  className="w-[18px] h-[18px]"
                  strokeWidth={active ? 1.75 : 1.5}
                />
                <span
                  className={`text-[10px] font-medium tracking-wide ${
                    active ? 'opacity-100' : 'opacity-90'
                  }`}
                >
                  {item.label}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
