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

  const currentTitle = navigation.find(item => isActive(item.href))?.name || 'Dashboard'

  return (
    <div className="admin-scope flex h-screen" style={{ background: 'var(--admin-bg)', color: 'var(--admin-text)' }}>
      {/* Sidebar */}
      <aside
        className={`admin-sidebar fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-5 border-b" style={{ borderColor: 'var(--admin-border)' }}>
          <Link to="/admin" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--admin-accent)' }}>
              <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight" style={{ color: 'var(--admin-text)' }}>
                Admin Panel
              </h1>
              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--admin-text-muted)' }}>
                CookSmart
              </p>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-md hover:bg-[var(--admin-surface-alt)]"
            style={{ color: 'var(--admin-text-secondary)' }}
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
          <Link
            to="/"
            className="admin-nav-item"
            onClick={() => setSidebarOpen(false)}
          >
            <Home className="admin-nav-icon" strokeWidth={2} />
            Về trang chủ
          </Link>

          <div className="admin-sidebar-section-title">Quản lý</div>

          {navigation.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`admin-nav-item ${active ? 'active' : ''}`}
              >
                <Icon className="admin-nav-icon" strokeWidth={2} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </nav>

        {/* User info + Logout */}
        <div className="absolute bottom-0 w-full border-t" style={{ borderColor: 'var(--admin-border)', background: 'var(--admin-surface)' }}>
          <div className="p-3">
            <div className="flex items-center mb-3 px-2 py-2 rounded-md" style={{ background: 'var(--admin-surface-alt)' }}>
              <div className="admin-avatar admin-avatar-success" style={{ width: 32, height: 32, fontSize: 13 }}>
                {user?.fullName?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="ml-2.5 flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--admin-text)' }}>
                  {user?.fullName || 'Admin'}
                </p>
                <p className="text-[11px] truncate" style={{ color: 'var(--admin-text-muted)' }}>
                  {user?.email || 'admin@example.com'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold rounded-md transition-colors"
              style={{
                color: 'var(--admin-danger)',
                background: 'var(--admin-surface)',
                border: '1px solid var(--admin-border-strong)',
              }}
            >
              <LogOut className="w-4 h-4" strokeWidth={2} />
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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="h-14 flex items-center px-4 lg:hidden border-b"
          style={{ background: 'var(--admin-surface)', borderColor: 'var(--admin-border)' }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md"
            style={{ color: 'var(--admin-text-secondary)' }}
          >
            <Menu className="w-5 h-5" strokeWidth={2} />
          </button>
          <h1 className="ml-3 text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
            {currentTitle}
          </h1>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8" style={{ background: 'var(--admin-bg)' }}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default AdminLayout