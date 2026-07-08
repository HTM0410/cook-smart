import React from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, ChefHat, ArrowUpRight } from 'lucide-react'
import { EyebrowTag } from '../atoms/EyebrowTag'
import { ButtonEditorial } from '../atoms/ButtonEditorial'

const Footer: React.FC = () => {
  return (
    <footer className="bg-paper-light dark:bg-ink-800 border-t border-ink-200/40 dark:border-ink-700/40">
      {/* Editorial top intro */}
      <div className="container py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Brand Column */}
          <div className="lg:col-span-5 space-y-6">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:scale-110">
                <ChefHat className="w-5 h-5 text-paper-light dark:text-ink-700" strokeWidth={1.5} />
              </div>
              <span className="text-2xl font-semibold tracking-tight">
                <span className="text-ink-primary dark:text-paper-light">Cook</span>
                <span className="text-ink-muted italic font-serif">Smart</span>
              </span>
            </Link>
            <h2 className="text-display text-3xl md:text-4xl lg:text-5xl text-ink-primary dark:text-paper-light max-w-md text-balance">
              Nấu ăn ngon.<br />Mỗi ngày.
            </h2>
            <p className="text-ink-secondary leading-relaxed max-w-md text-pretty">
              Nền tảng gợi ý món ăn thông minh sử dụng AI. Khám phá công thức, lên thực đơn tuần và tận hưởng những bữa ăn tuyệt vời.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2 space-y-5">
            <EyebrowTag>Khám phá</EyebrowTag>
            <ul className="space-y-3">
              {[
                { label: 'Trang chủ', path: '/' },
                { label: 'Công thức', path: '/recipes' },
                { label: 'Danh mục', path: '/categories' },
                { label: 'Tìm kiếm', path: '/search' },
                { label: 'Thực đơn', path: '/meal-plans' },
              ].map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="link-underline text-sm font-medium text-ink-primary dark:text-paper-light"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div className="lg:col-span-2 space-y-5">
            <EyebrowTag>Danh mục</EyebrowTag>
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
                    className="link-underline text-sm font-medium text-ink-primary dark:text-paper-light"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + Newsletter */}
          <div className="lg:col-span-3 space-y-5">
            <EyebrowTag>Liên hệ</EyebrowTag>
            <div className="space-y-4">
              {[
                { icon: Mail, text: 'hoangtruongminh22@gmail.com', href: 'mailto:hoangtruongminh22@gmail.com' },
                { icon: Phone, text: '0332834914', href: 'tel:0332834914' },
                { icon: MapPin, text: 'TP. Hồ Chí Minh, Việt Nam', href: '#' },
              ].map((item, i) => (
                <a
                  key={i}
                  href={item.href}
                  className="flex items-start gap-3 text-sm font-medium text-ink-primary dark:text-paper-light group"
                >
                  <span className="w-7 h-7 rounded-full bg-white dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center flex-shrink-0 transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:scale-110">
                    <item.icon className="w-3.5 h-3.5 text-ink-secondary" strokeWidth={1.5} />
                  </span>
                  <span className="pt-1 link-underline">{item.text}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Newsletter - bezel pattern */}
        <div className="mt-16">
          <div className="card-bezel">
            <div className="card-bezel-inner p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-10">
              <div className="flex-1 space-y-3">
                <p className="eyebrow-tag">Bản tin</p>
                <h3 className="text-display text-2xl md:text-3xl text-ink-primary dark:text-paper-light">
                  Công thức mới mỗi tuần.
                </h3>
                <p className="text-ink-secondary text-sm md:text-base">
                  Đăng ký để nhận những công thức được tuyển chọn và mẹo nấu ăn từ đội ngũ CookSmart.
                </p>
              </div>
              <form className="w-full md:w-auto md:min-w-[380px] flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <div className="input-bezel flex-1">
                  <input
                    type="email"
                    placeholder="email@example.com"
                    className="input-bezel-inner text-sm"
                  />
                </div>
                <ButtonEditorial type="submit" size="md" aria-label="Đăng ký">
                  Gửi
                </ButtonEditorial>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="container py-8 border-t border-ink-200/40 dark:border-ink-700/40">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs uppercase tracking-[0.2em] text-ink-secondary">
            © 2026 CookSmart. Mọi quyền được bảo lưu.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="link-underline text-xs uppercase tracking-[0.2em] text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light">
              Điều khoản
            </a>
            <a href="#" className="link-underline text-xs uppercase tracking-[0.2em] text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light">
              Bảo mật
            </a>
            <a href="#" className="link-underline text-xs uppercase tracking-[0.2em] text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light">
              Hỗ trợ
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
