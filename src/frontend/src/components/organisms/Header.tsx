import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTheme } from '../../contexts/ThemeContext'
import Logo from '../atoms/Logo'
import { useAuth } from '../../contexts/AuthContext'
import { useState, useEffect, useRef } from 'react'
import categoryService, { RecipeCategory } from '../../services/categoryService'
import { useDebounce } from '../../utils/debounce'
import {
  Search, Bell, Moon, Sun, User, LogOut, Settings, ChefHat, X, Menu,
  Home, UtensilsCrossed, Heart, Calendar, LayoutGrid, ChevronDown
} from 'lucide-react'

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [scrolled, setScrolled] = useState(false)
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
    { label: 'Trang chủ', path: '/', icon: Home },
    { label: 'Công thức', path: '/recipes', icon: UtensilsCrossed },
    { label: 'Thực đơn', path: '/meal-plans', icon: Calendar },
    { label: 'Yêu thích', path: '/favorites', icon: Heart },
  ]

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full transition-all duration-500 ${
          scrolled
            ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl shadow-sm border-b border-gray-100/80 dark:border-gray-800/50'
            : 'bg-white/50 dark:bg-gray-900/50 backdrop-blur-md border-b border-transparent'
        }`}
      >
        <div className="container">
          <div className="flex h-16 lg:h-[70px] items-center justify-between gap-4">

            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-amber-500 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:shadow-primary-500/25 transition-all duration-300 group-hover:scale-105">
                <ChefHat className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-xl font-extrabold tracking-tight hidden sm:block">
                <span className="text-gray-900 dark:text-white">Cook</span>
                <span className="text-gradient-sm">Smart</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 group ${
                    isActive(item.path)
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </span>
                </Link>
              ))}

              {/* Categories Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowCategoriesDropdown(!showCategoriesDropdown)}
                  className={`px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 ${
                    isCategoriesActive
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Phân loại
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showCategoriesDropdown ? 'rotate-180' : ''}`} />
                </button>

                {showCategoriesDropdown && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-[780px] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 overflow-hidden animate-scale-in">
                    {loadingCategories ? (
                      <div className="px-6 py-10 text-center">
                        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="mt-3 text-sm text-gray-500">Đang tải...</p>
                      </div>
                    ) : (
                      <div className="flex divide-x divide-gray-100 dark:divide-gray-700">
                        <div className="flex-1 p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-sm">🍜</div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ẩm thực</span>
                          </div>
                          <div className="space-y-1 max-h-[280px] overflow-y-auto pr-2 hide-scrollbar">
                            {categories.cuisines.map((cat) => (
                              <Link
                                key={cat.id}
                                to={`/categories/cuisine/${encodeURIComponent(cat.categoryName)}`}
                                className="block px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 hover:text-orange-600 dark:hover:text-orange-400 rounded-xl transition-colors"
                              >
                                {cat.categoryName}
                              </Link>
                            ))}
                          </div>
                        </div>

                        <div className="flex-1 p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm">🍽️</div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Món ăn</span>
                          </div>
                          <div className="space-y-1 max-h-[280px] overflow-y-auto pr-2 hide-scrollbar">
                            {categories.courses.map((cat) => (
                              <Link
                                key={cat.id}
                                to={`/categories/course/${encodeURIComponent(cat.categoryName)}`}
                                className="block px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors"
                              >
                                {cat.categoryName}
                              </Link>
                            ))}
                          </div>
                        </div>

                        <div className="flex-1 p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-sm">🏷️</div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Thẻ</span>
                          </div>
                          <div className="space-y-1 max-h-[280px] overflow-y-auto pr-2 hide-scrollbar">
                            {categories.tags.map((cat) => (
                              <Link
                                key={cat.id}
                                to={`/categories/tag/${encodeURIComponent(cat.categoryName)}`}
                                className="block px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-gray-700 hover:text-green-600 dark:hover:text-green-400 rounded-xl transition-colors"
                              >
                                {cat.categoryName}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700">
                      <Link
                        to="/categories"
                        className="flex items-center justify-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                      >
                        Xem tất cả phân loại
                        <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center gap-1 lg:gap-2">
              {/* Search Toggle */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              {/* Notifications */}
              <button className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-all relative">
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse-soft" />
              </button>

              {/* User Profile */}
              <div className="relative" ref={userDropdownRef}>
                <button
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center gap-2 pl-2 ml-1 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  {user ? (
                    <>
                      <img
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || '')}&background=ff4f00&color=fff&bold=true`}
                        alt={user.username}
                        className="w-8 h-8 rounded-xl object-cover border-2 border-primary-100 dark:border-primary-900 shadow-sm"
                      />
                      <span className="hidden md:block text-sm font-semibold text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
                        {user.username}
                      </span>
                      <ChevronDown className={`hidden md:block w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showUserDropdown ? 'rotate-180' : ''}`} />
                    </>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors">
                      <User className="w-4 h-4" />
                      <span className="text-sm font-semibold hidden sm:block">Đăng nhập</span>
                    </div>
                  )}
                </button>

                {showUserDropdown && user && (
                  <div className="absolute right-0 top-full mt-3 w-56 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-50 animate-scale-in">
                    <div className="px-3 py-3 mb-2 border-b border-gray-100 dark:border-gray-700">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.username}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link to="/profile" className="dropdown-item">
                      <User className="w-4 h-4" /> Hồ sơ
                    </Link>
                    <Link to="/meal-plans" className="dropdown-item">
                      <Calendar className="w-4 h-4" /> Thực đơn
                    </Link>
                    <Link to="/favorites" className="dropdown-item">
                      <Heart className="w-4 h-4" /> Yêu thích
                    </Link>
                    <Link to="/settings" className="dropdown-item">
                      <Settings className="w-4 h-4" /> Cài đặt
                    </Link>
                    <div className="border-t border-gray-100 dark:border-gray-700 mt-2 pt-2">
                      <button
                        onClick={() => { logout(); navigate('/login') }}
                        className="dropdown-item-danger w-full"
                      >
                        <LogOut className="w-4 h-4" /> Đăng xuất
                      </button>
                    </div>
                  </div>
                )}

                {showUserDropdown && !user && (
                  <div className="absolute right-0 top-full mt-3 w-48 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 p-2 z-50 animate-scale-in">
                    <Link to="/login" className="dropdown-item">
                      <User className="w-4 h-4" /> Đăng nhập
                    </Link>
                    <Link to="/register" className="dropdown-item">
                      <User className="w-4 h-4" /> Đăng ký
                    </Link>
                  </div>
                )}
              </div>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden w-10 h-10 rounded-xl flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              >
                {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Inline Search Bar */}
          {showSearch && (
            <div className="pb-4 animate-slide-down">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm công thức, nguyên liệu..."
                  className="w-full h-12 pl-14 pr-14 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-sm"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => { setShowSearch(false); setSearchQuery('') }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Drawer */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowMobileMenu(false)} />
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white dark:bg-gray-900 shadow-2xl animate-slide-in-right overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2.5" onClick={() => setShowMobileMenu(false)}>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-amber-500 flex items-center justify-center">
                    <ChefHat className="w-5 h-5 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-xl font-extrabold">
                    <span className="text-gray-900 dark:text-white">Cook</span>
                    <span className="text-gradient-sm">Smart</span>
                  </span>
                </Link>
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-1">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">Menu</p>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive(item.path)
                      ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}

              <div className="pt-4 pb-2">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-3 mb-2">Phân loại</p>
                <div className="grid grid-cols-2 gap-1">
                  {categories.courses.slice(0, 4).map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/categories/course/${encodeURIComponent(cat.categoryName)}`}
                      className="px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl transition-colors truncate"
                    >
                      {cat.categoryName}
                    </Link>
                  ))}
                </div>
                <Link
                  to="/categories"
                  className="flex items-center justify-center gap-1 mt-3 px-3 py-2.5 text-sm font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                >
                  Xem tất cả →
                </Link>
              </div>

              {!user && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                  <Link to="/login" className="flex items-center justify-center gap-2 px-4 py-3 bg-primary-500 text-white rounded-xl font-semibold text-sm hover:bg-primary-600 transition-colors">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl font-semibold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Header
