import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { easeFluid } from '../../lib/motion'
import {
  BookOpen,
  Bot,
  Carrot,
  FolderTree,
  Home,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Users,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const navigation = [
    { name: 'Tổng quan', href: '/admin', icon: LayoutDashboard },
    { name: 'Người dùng', href: '/admin/users', icon: Users },
    { name: 'Công thức', href: '/admin/recipes', icon: BookOpen },
    { name: 'Nguyên liệu', href: '/admin/ingredients', icon: Carrot },
    { name: 'Danh mục nguyên liệu', href: '/admin/ingredients/categories', icon: FolderTree },
    { name: 'Bình luận', href: '/admin/comments', icon: MessageSquare },
    { name: 'MLOps nhận diện', href: '/admin/mlops', icon: Bot },
  ]

  const handleLogout = () => {
    if (confirm('Bạn có chắc muốn đăng xuất?')) {
      logout()
      navigate('/')
    }
  }

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="flex h-screen bg-paper-light dark:bg-ink-800">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-paper-light dark:bg-ink-700 transform transition-transform duration-500 ease-[var(--ease-fluid)] lg:relative lg:translate-x-0 ring-1 ring-ink-200/40 dark:ring-ink-700/40 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-ink-200/40 dark:border-ink-700/40">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#ff4f00] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-ink-primary dark:text-paper-light text-display">
                Admin Panel
              </h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink-muted mt-0.5">
                CookSmart
              </p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-full hover:bg-paper-light dark:hover:bg-ink-700"
          >
            <X className="w-4 h-4 text-ink-secondary" strokeWidth={1.5} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto h-[calc(100vh-220px)]">
          <Link
            to="/"
            className="flex items-center px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-500 ease-[var(--ease-fluid)] text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700 ring-1 ring-transparent hover:ring-ink-200/40 dark:hover:ring-ink-700/40 mb-3"
          >
            <Home className="mr-3 w-4 h-4" strokeWidth={1.5} />
            Về trang chủ
          </Link>

          {navigation.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`relative flex items-center px-4 py-3 text-sm font-medium rounded-2xl transition-all duration-500 ease-[var(--ease-fluid)] ${
                  active
                    ? 'text-ink-primary dark:text-paper-light bg-paper-light dark:bg-ink-700/40 ring-1 ring-ink-200/40 dark:ring-ink-700/40'
                    : 'text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700/30 ring-1 ring-transparent'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="admin-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#ff4f00] rounded-r-full"
                    transition={{ duration: 0.4, ease: easeFluid }}
                  />
                )}
                <Icon className={`mr-3 h-4 w-4 flex-shrink-0 ${active ? 'text-[#ff4f00]' : ''}`} strokeWidth={1.5} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* User info + Logout */}
        <div className="absolute bottom-0 w-full border-t border-ink-200/40 dark:border-ink-700/40 bg-paper-light dark:bg-ink-700/30">
          <div className="p-4">
            <div className="flex items-center mb-3">
              <div className="w-9 h-9 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center text-paper-light dark:text-ink-700 font-semibold text-sm ring-1 ring-ink-700 dark:ring-paper-light">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-primary dark:text-paper-light truncate">
                  {user?.fullName || 'Admin'}
                </p>
                <p className="text-xs text-ink-muted truncate">
                  {user?.email || 'admin@example.com'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2.5 text-sm font-medium text-[#9F2F2D] hover:bg-[#FDEBEC] dark:hover:bg-[#9F2F2D]/15 rounded-2xl ring-1 ring-transparent hover:ring-[#9F2F2D]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
            >
              <LogOut className="w-4 h-4 mr-2" strokeWidth={1.5} />
              Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-40 bg-ink-700/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-paper-light dark:bg-ink-700/40 flex items-center px-4 lg:hidden border-b border-ink-200/40 dark:border-ink-700/40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-full text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700 transition-colors duration-500 ease-[var(--ease-fluid)]"
          >
            <Menu className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <h1 className="ml-4 text-base font-semibold text-ink-primary dark:text-paper-light text-display">
            {navigation.find(item => isActive(item.href))?.name || 'Dashboard'}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto bg-paper-light dark:bg-ink-800 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AdminLayout