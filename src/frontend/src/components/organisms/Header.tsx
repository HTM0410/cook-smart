import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import Logo from '../atoms/Logo'
import { useAuth } from '../../contexts/AuthContext'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import categoryService, { RecipeCategory } from '../../services/categoryService'
import { useDebounce } from '../../utils/debounce'
import {
  Search, Moon, Sun, User, LogOut, Settings, ChefHat, X,
  Heart, Calendar, ShieldCheck
} from 'lucide-react'
import { easeFluid, drawerItem } from '../../lib/motion'

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [categories, setCategories] = useState<{
    cuisines: RecipeCategory[];
    courses: RecipeCategory[];
    tags: RecipeCategory[];
  }>({
    cuisines: [],
    courses: [],
    tags: []
  })
  const [loadingCategories, setLoadingCategories] = useState(false)
  const debouncedSearch = useDebounce(searchQuery, 300)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isActive = (path: string) => location.pathname === path
  const isCategoriesActive = location.pathname.startsWith('/categories')
  const canAccessAdmin = user?.isAdmin || user?.role === 'admin' || localStorage.getItem('isAdmin') === 'true'

  useEffect(() => {
    setShowMobileMenu(false)
    setShowCategoriesDropdown(false)
    setShowUserDropdown(false)
    setShowSearch(false)
  }, [location.pathname])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true)
        const [cuisinesRes, coursesRes, tagsRes] = await Promise.all([
          categoryService.getAllCategories('cuisine'),
          categoryService.getAllCategories('course'),
          categoryService.getAllCategories('tag')
        ])
        setCategories({
          cuisines: cuisinesRes.data.categories || [],
          courses: coursesRes.data.categories || [],
          tags: tagsRes.data.categories || []
        })
      } catch (error) {
        console.error('Error loading categories:', error)
      } finally {
        setLoadingCategories(false)
      }
    }
    loadCategories()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoriesDropdown(false)
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showSearch])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate({ pathname: '/search', search: `?query=${encodeURIComponent(searchQuery.trim())}` })
      setShowSearch(false)
      setSearchQuery('')
    }
  }

  const navItems = [
    { label: 'Trang chủ', path: '/' },
    { label: 'Công thức', path: '/recipes' },
    { label: 'Thực đơn', path: '/meal-plans' },
    { label: 'Yêu thích', path: '/favorites' },
  ]

  return (
    <>
      {/* Floating pill header — detached from top edge */}
      <div className="sticky top-0 z-50 w-full flex justify-center pt-4 md:pt-6 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easeFluid }}
          className="floating-nav-pill pointer-events-auto"
        >
          <div className="flex items-center gap-1 pl-3 pr-2 py-1.5">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 px-2 py-1.5 group">
              <div className="w-8 h-8 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:scale-110">
                <ChefHat className="w-4 h-4 text-paper-light dark:text-ink-700" strokeWidth={1.5} />
              </div>
              <span className="text-base font-semibold tracking-tight hidden sm:inline-flex">
                <span className="text-ink-primary dark:text-paper-light">Cook</span>
                <span className="text-ink-muted italic font-serif">Smart</span>
              </span>
            </Link>

            <div className="hidden lg:block w-px h-6 bg-ink-200/40 dark:bg-ink-700/40 mx-1" />

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {navItems.map((item) => {
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`relative px-3.5 py-2 text-sm font-medium rounded-full transition-colors duration-700 ease-[var(--ease-fluid)] ${
                      active
                        ? 'text-ink-primary dark:text-paper-light bg-paper-light dark:bg-ink-700'
                        : 'text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}

              {/* Categories Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
                  className={`px-3.5 py-2 text-sm font-medium rounded-full transition-colors duration-700 ease-[var(--ease-fluid)] ${
                    isCategoriesActive
                      ? 'text-ink-primary dark:text-paper-light bg-paper-light dark:bg-ink-700'
                      : 'text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light'
                  }`}
                >
                  Phân loại
                </button>

                <AnimatePresence>
                  {showCategoriesDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.5, ease: easeFluid }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[680px] max-w-[calc(100vw-2rem)] card-bezel z-50"
                    >
                      <div className="card-bezel-inner p-0">
                        {loadingCategories ? (
                          <div className="px-6 py-10 text-center">
                            <div className="w-6 h-6 border-2 border-ink-700 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="mt-3 text-sm text-ink-secondary">Đang tải...</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 divide-x divide-ink-200/40 dark:divide-ink-700/40">
                            <div className="p-5">
                              <p className="eyebrow-tag mb-4">Ẩm thực</p>
                              <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-2">
                                {categories.cuisines.map((cat) => (
                                  <Link
                                    key={cat.id}
                                    to={`/categories/cuisine/${encodeURIComponent(cat.categoryName)}`}
                                    className="block px-3 py-2 text-sm text-ink-primary dark:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700 rounded-lg transition-colors"
                                  >
                                    {cat.categoryName}
                                  </Link>
                                ))}
                              </div>
                            </div>

                            <div className="p-5">
                              <p className="eyebrow-tag mb-4">Món ăn</p>
                              <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-2">
                                {categories.courses.map((cat) => (
                                  <Link
                                    key={cat.id}
                                    to={`/categories/course/${encodeURIComponent(cat.categoryName)}`}
                                    className="block px-3 py-2 text-sm text-ink-primary dark:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700 rounded-lg transition-colors"
                                  >
                                    {cat.categoryName}
                                  </Link>
                                ))}
                              </div>
                            </div>

                            <div className="p-5">
                              <p className="eyebrow-tag mb-4">Thẻ</p>
                              <div className="space-y-0.5 max-h-[260px] overflow-y-auto pr-2">
                                {categories.tags.map((cat) => (
                                  <Link
                                    key={cat.id}
                                    to={`/categories/tag/${encodeURIComponent(cat.categoryName)}`}
                                    className="block px-3 py-2 text-sm text-ink-primary dark:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700 rounded-lg transition-colors"
                                  >
                                    {cat.categoryName}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="px-5 py-3 bg-paper-light dark:bg-ink-800/40 border-t border-ink-200/40 dark:border-ink-700/40 rounded-b-[calc(2rem-0.375rem)]">
                          <Link
                            to="/categories"
                            className="link-underline flex items-center justify-center gap-1 text-sm font-medium text-ink-primary dark:text-paper-light"
                          >
                            Xem tất cả phân loại
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {canAccessAdmin && (
                <Link
                  to="/admin"
                  className={`px-3.5 py-2 text-sm font-medium rounded-full transition-colors duration-700 ease-[var(--ease-fluid)] ${
                    location.pathname.startsWith('/admin')
                      ? 'text-ink-primary dark:text-paper-light bg-paper-light dark:bg-ink-700'
                      : 'text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light'
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>

            <div className="hidden lg:block w-px h-6 bg-ink-200/40 dark:bg-ink-700/40 mx-1" />

            {/* Right Side Actions */}
            <div className="flex items-center gap-0.5">
              {/* Search Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSearch(!showSearch)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700 transition-colors"
                aria-label="Tìm kiếm"
              >
                <Search className="w-4 h-4" strokeWidth={1.5} />
              </motion.button>

              {/* Theme Toggle */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={toggleTheme}
                className="w-9 h-9 rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700 transition-colors"
                aria-label="Đổi giao diện"
              >
                {theme === 'light' ? <Moon className="w-4 h-4" strokeWidth={1.5} /> : <Sun className="w-4 h-4" strokeWidth={1.5} />}
              </motion.button>

              {/* User Profile */}
              <div className="relative" ref={userDropdownRef}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="ml-1 flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full hover:bg-paper-light dark:hover:bg-ink-700 transition-colors"
                >
                  {user ? (
                    <>
                      <img
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.fullName || user.username || 'User')}&background=1A1814&color=FDFBF7&bold=true`}
                        alt={user.fullName || user.username || 'User'}
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <span className="hidden md:block text-sm font-medium text-ink-primary dark:text-paper-light max-w-[100px] truncate">
                        {user.fullName || user.username}
                      </span>
                    </>
                  ) : (
                    <span className="flex items-center gap-2 px-2 py-1 text-sm font-medium text-ink-primary dark:text-paper-light">
                      <User className="w-4 h-4" strokeWidth={1.5} />
                      <span className="hidden sm:inline">Đăng nhập</span>
                    </span>
                  )}
                </motion.button>

                <AnimatePresence>
                  {showUserDropdown && user && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.5, ease: easeFluid }}
                      className="absolute right-0 top-full mt-3 w-60 card-bezel z-50"
                    >
                      <div className="card-bezel-inner p-2">
                        <div className="px-3 py-3 mb-1 border-b border-ink-200/40 dark:border-ink-700/40">
                          <p className="text-sm font-semibold text-ink-primary dark:text-paper-light truncate">{user.fullName || user.username}</p>
                          <p className="text-xs text-ink-secondary truncate">{user.email}</p>
                        </div>
                        {canAccessAdmin && (
                          <Link to="/admin" className="dropdown-item">
                            <ShieldCheck className="w-4 h-4" strokeWidth={1.5} /> Quản trị
                          </Link>
                        )}
                        <Link to="/profile" className="dropdown-item">
                          <User className="w-4 h-4" strokeWidth={1.5} /> Hồ sơ
                        </Link>
                        <Link to="/meal-plans" className="dropdown-item">
                          <Calendar className="w-4 h-4" strokeWidth={1.5} /> Thực đơn
                        </Link>
                        <Link to="/favorites" className="dropdown-item">
                          <Heart className="w-4 h-4" strokeWidth={1.5} /> Yêu thích
                        </Link>
                        <Link to="/settings" className="dropdown-item">
                          <Settings className="w-4 h-4" strokeWidth={1.5} /> Cài đặt
                        </Link>
                        <div className="border-t border-ink-200/40 dark:border-ink-700/40 mt-1 pt-1">
                          <button
                            onClick={() => { logout(); navigate('/login') }}
                            className="dropdown-item-danger w-full"
                          >
                            <LogOut className="w-4 h-4" strokeWidth={1.5} /> Đăng xuất
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {showUserDropdown && !user && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.5, ease: easeFluid }}
                      className="absolute right-0 top-full mt-3 w-52 card-bezel z-50"
                    >
                      <div className="card-bezel-inner p-2">
                        <Link to="/login" className="dropdown-item">
                          <User className="w-4 h-4" strokeWidth={1.5} /> Đăng nhập
                        </Link>
                        <Link to="/register" className="dropdown-item">
                          <User className="w-4 h-4" strokeWidth={1.5} /> Đăng ký
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile Menu Toggle - morphs into X */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden w-9 h-9 ml-0.5 rounded-full flex items-center justify-center text-ink-primary dark:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700 transition-colors relative"
                aria-label="Menu"
              >
                <span className="relative w-4 h-4 block">
                  <motion.span
                    className="absolute left-0 right-0 h-px bg-current"
                    animate={showMobileMenu ? { top: '50%', rotate: 45, y: -0.5 } : { top: '30%', rotate: 0, y: 0 }}
                    transition={{ duration: 0.5, ease: easeFluid }}
                    style={{ top: '30%' }}
                  />
                  <motion.span
                    className="absolute left-0 right-0 h-px bg-current top-1/2 -translate-y-1/2"
                    animate={showMobileMenu ? { opacity: 0 } : { opacity: 1 }}
                    transition={{ duration: 0.3, ease: easeFluid }}
                  />
                  <motion.span
                    className="absolute left-0 right-0 h-px bg-current"
                    animate={showMobileMenu ? { bottom: '30%', rotate: -45, y: 0.5 } : { bottom: '30%', rotate: 0, y: 0 }}
                    transition={{ duration: 0.5, ease: easeFluid }}
                    style={{ bottom: '30%' }}
                  />
                </span>
              </motion.button>
            </div>
          </div>

          {/* Inline Search Bar */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.5, ease: easeFluid }}
                className="overflow-hidden border-t border-ink-200/40 dark:border-ink-700/40"
              >
                <form onSubmit={handleSearch} className="relative p-3">
                  <div className="input-bezel">
                    <div className="relative flex items-center">
                      <Search className="absolute left-5 w-4 h-4 text-ink-secondary" strokeWidth={1.5} />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm công thức, nguyên liệu..."
                        className="input-bezel-inner pl-12 pr-12 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => { setShowSearch(false); setSearchQuery('') }}
                        className="absolute right-3 w-7 h-7 rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-paper-light dark:hover:bg-ink-700 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Mobile Drawer - full screen editorial overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: easeFluid }}
            className="fixed inset-0 z-[60] lg:hidden"
          >
            <motion.div
              className="absolute inset-0 bg-ink-700/85 backdrop-blur-3xl"
              onClick={() => setShowMobileMenu(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.7, ease: easeFluid }}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-paper-light dark:bg-ink-800 overflow-y-auto"
            >
              <div className="p-6 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5" onClick={() => setShowMobileMenu(false)}>
                  <div className="w-9 h-9 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center">
                    <ChefHat className="w-5 h-5 text-paper-light dark:text-ink-700" strokeWidth={1.5} />
                  </div>
                  <span className="text-xl font-semibold tracking-tight">
                    <span className="text-ink-primary dark:text-paper-light">Cook</span>
                    <span className="text-ink-muted italic font-serif">Smart</span>
                  </span>
                </Link>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-ink-primary dark:text-paper-light hover:bg-paper-light dark:hover:bg-ink-700 transition-colors"
                >
                  <X className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="px-6 pb-6 space-y-6">
                <p className="eyebrow-tag">Menu</p>
                <nav className="space-y-1">
                  {navItems.map((item, i) => {
                    const active = isActive(item.path)
                    return (
                      <motion.div
                        key={item.path}
                        custom={i}
                        initial="hidden"
                        animate="visible"
                        variants={drawerItem}
                      >
                        <Link
                          to={item.path}
                          className={`flex items-center justify-between px-4 py-4 rounded-2xl text-2xl font-serif italic tracking-editorial transition-colors ${
                            active
                              ? 'text-[#ff4f00] bg-paper-light dark:bg-ink-700'
                              : 'text-ink-primary dark:text-paper-light'
                          }`}
                        >
                          {item.label}
                          <span className="text-xs font-sans not-italic text-ink-muted">→</span>
                        </Link>
                      </motion.div>
                    )
                  })}

                  {canAccessAdmin && (
                    <motion.div
                      custom={navItems.length}
                      initial="hidden"
                      animate="visible"
                      variants={drawerItem}
                    >
                      <Link
                        to="/admin"
                        className={`flex items-center justify-between px-4 py-4 rounded-2xl text-2xl font-serif italic tracking-editorial transition-colors ${
                          location.pathname.startsWith('/admin')
                            ? 'text-[#ff4f00] bg-paper-light dark:bg-ink-700'
                            : 'text-ink-primary dark:text-paper-light'
                        }`}
                      >
                        Quản trị
                        <span className="text-xs font-sans not-italic text-ink-muted">→</span>
                      </Link>
                    </motion.div>
                  )}
                </nav>

                <div>
                  <p className="eyebrow-tag mb-3">Phân loại</p>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.courses.slice(0, 6).map((cat, i) => (
                      <motion.div
                        key={cat.id}
                        custom={i + 5}
                        initial="hidden"
                        animate="visible"
                        variants={drawerItem}
                      >
                        <Link
                          to={`/categories/course/${encodeURIComponent(cat.categoryName)}`}
                          className="block px-3 py-2.5 text-sm text-ink-secondary hover:text-ink-primary hover:bg-paper-light dark:hover:bg-ink-700 rounded-xl transition-colors truncate"
                        >
                          {cat.categoryName}
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                  <Link
                    to="/categories"
                    className="mt-3 inline-flex items-center gap-1 link-underline text-sm font-medium text-ink-primary dark:text-paper-light"
                  >
                    Xem tất cả phân loại
                  </Link>
                </div>

                {!user && (
                  <div className="space-y-3 pt-4 border-t border-ink-200/40 dark:border-ink-700/40">
                    <Link
                      to="/login"
                      className="btn-editorial-primary w-full justify-between"
                    >
                      Đăng nhập
                      <span className="btn-icon-wrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="M13 5l7 7-7 7" />
                        </svg>
                      </span>
                    </Link>
                    <Link
                      to="/register"
                      className="btn-editorial-ghost w-full justify-between"
                    >
                      Tạo tài khoản
                      <span className="btn-icon-wrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="M13 5l7 7-7 7" />
                        </svg>
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default Header
