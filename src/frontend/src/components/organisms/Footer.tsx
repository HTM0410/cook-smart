import React from 'react'
import { Link } from 'react-router-dom'
import Logo from '../atoms/Logo'
import { Mail, Phone, MapPin, Facebook, Instagram, Youtube } from 'lucide-react'

const Footer: React.FC = () => {
  return (
    <footer className="relative bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 border-t border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-500/5 rounded-full blur-3xl" />

      <div className="container relative z-10 py-16 lg:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">

          {/* Brand Column */}
          <div className="lg:col-span-1 space-y-5">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-amber-500 flex items-center justify-center shadow-md group-hover:shadow-lg group-hover:shadow-primary-500/25 transition-all duration-300">
                <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <span className="text-2xl font-extrabold tracking-tight">
                <span className="text-gray-900 dark:text-white">Cook</span>
                <span className="text-gradient-sm">Smart</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nền tảng gợi ý món ăn thông minh sử dụng AI. Khám phá, nấu nưởng và tận hưởng những món ăn tuyệt vời mỗi ngày.
            </p>
            <div className="flex items-center gap-3">
              {[Facebook, Instagram, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-200 hover:scale-110"
                >
                  <Icon className="w-4.5 h-4.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Khám phá
            </h3>
            <ul className="space-y-3">
              {[
                { label: 'Trang chủ', path: '/' },
                { label: 'Tất cả công thức', path: '/recipes' },
                { label: 'Danh mục', path: '/categories' },
                { label: 'Tìm kiếm', path: '/search' },
                { label: 'Thực đơn tuần', path: '/meal-plans' },
              ].map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="text-sm font-medium text-muted-foreground hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 inline-flex items-center gap-1 group"
                  >
                    <span className="w-0 group-hover:w-2 transition-all duration-200 overflow-hidden">
                      <span className="inline-block w-2 h-0.5 bg-primary-500 rounded-full" />
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Danh mục
            </h3>
            <ul className="space-y-3">
              {[
                { label: 'Món chính', path: '/categories/course/Món chính' },
                { label: 'Món khai vị', path: '/categories/course/Món khai vị' },
                { label: 'Tráng miệng', path: '/categories/course/Tráng miệng' },
                { label: 'Đồ uống', path: '/categories/course/Đồ uống' },
                { label: 'Món chay', path: '/categories/tag/Món chay' },
              ].map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="text-sm font-medium text-muted-foreground hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 inline-flex items-center gap-1 group"
                  >
                    <span className="w-0 group-hover:w-2 transition-all duration-200 overflow-hidden">
                      <span className="inline-block w-2 h-0.5 bg-primary-500 rounded-full" />
                    </span>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Liên hệ
            </h3>
            <div className="space-y-4">
              {[
                { icon: Mail, text: 'hoangtruongminh22@gmail.com', href: 'mailto:hoangtruongminh22@gmail.com' },
                { icon: Phone, text: '0332834914', href: 'tel:0332834914' },
                { icon: MapPin, text: 'TP. Hồ Chí Minh, Việt Nam', href: '#' },
              ].map((item, i) => (
                <a
                  key={i}
                  href={item.href}
                  className="flex items-start gap-3 text-sm font-medium text-muted-foreground hover:text-primary-600 dark:hover:text-primary-400 transition-colors duration-200 group"
                >
                  <item.icon className="w-4.5 h-4.5 mt-0.5 flex-shrink-0 text-gray-400 group-hover:text-primary-500 transition-colors" />
                  <span>{item.text}</span>
                </a>
              ))}
            </div>

            {/* Newsletter */}
            <div className="pt-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                Nhận công thức mới
              </p>
              <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="Email của bạn"
                  className="flex-1 h-10 px-4 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  className="h-10 px-4 bg-primary-500 hover:bg-primary-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-md hover:shadow-lg hover:shadow-primary-500/25 active:scale-95"
                >
                  Gửi
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 CookSmart. Tất cả quyền được bảo lưu.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                Điều khoản sử dụng
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                Chính sách bảo mật
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                Hỗ trợ
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
