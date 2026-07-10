import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ChefHat, Sparkles, ArrowUpRight } from 'lucide-react'
import { EyebrowTag } from '../components/atoms/EyebrowTag'
import { easeFluid, splitRevealLeft, splitRevealRight, viewportOnce } from '../lib/motion'

const LoginPage: React.FC = () => {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email || !password) { setError('Vui lòng nhập đầy đủ thông tin'); return }
    try {
      await login(email, password)
      const isAdmin = localStorage.getItem('isAdmin') === 'true'
      navigate(isAdmin ? '/admin' : '/')
    } catch (err: any) {
      const status = err?.response?.status
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error
      const code = err?.response?.data?.code
      if (status === 401) {
        if (code === 'ACCOUNT_BANNED') setError('Tài khoản đã bị khóa.')
        else setError(serverMsg || 'Email/username hoặc mật khẩu không đúng.')
      } else if (status === 400) {
        setError(serverMsg || 'Thông tin đăng nhập chưa hợp lệ.')
      } else if (status === 429) {
        setError('Quá nhiều lần thử. Vui lòng đợi một chút rồi thử lại.')
      } else if (status === 404) {
        setError('Không tìm thấy máy chủ. Kiểm tra backend đang chạy ở cổng 3000.')
      } else if (!status) {
        setError('Không thể kết nối máy chủ. Kiểm tra backend có đang chạy không.')
      } else {
        setError(serverMsg || `Đăng nhập thất bại (HTTP ${status}).`)
      }
    }
  }

  return (
    <div className="min-h-[100dvh] bg-paper-light dark:bg-ink-800 flex flex-col lg:flex-row">
      {/* Left - Editorial Visual */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={splitRevealLeft}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-ink-700 text-paper-light p-12 lg:p-20 flex-col justify-between min-h-[60vh] lg:min-h-[100dvh]"
      >
        {/* Decorative backdrops */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,79,0,0.18)_0%,transparent_60%)]" />
          <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(122,139,111,0.15)_0%,transparent_60%)]" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-paper-light/10 ring-1 ring-paper-light/15 flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-paper-light" strokeWidth={1.5} />
          </div>
          <span className="text-2xl font-semibold tracking-tight">
            <span className="text-paper-light">Cook</span>
            <span className="text-ink-300 italic font-serif">Smart</span>
          </span>
        </div>

        <div className="relative z-10 space-y-8 max-w-md">
          <EyebrowTag dotColor="bg-[#ff6f33]" className="bg-paper-light/10 text-paper-light">
            Chào mừng trở lại
          </EyebrowTag>
          <h1 className="text-display text-5xl xl:text-6xl text-paper-light text-balance">
            Khám phá.
            <br />
            <span className="text-ink-300 italic">Nấu ăn.</span>
            <br />
            Yêu thích.
          </h1>
          <p className="text-ink-200 text-lg leading-relaxed text-pretty">
            Đăng nhập để truy cập thực đơn cá nhân, công thức yêu thích và AI gợi ý thông minh.
          </p>
          <div className="space-y-3 pt-4">
            {[
              '1,000+ công thức đa dạng',
              'AI gợi ý thông minh',
              'Lập thực đơn dễ dàng',
            ].map((label, i) => (
              <div key={i} className="flex items-center gap-3 text-ink-100">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff6f33]" />
                <span className="text-sm font-medium tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ink-300">
          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
          <span>CookSmart · 2026</span>
        </div>
      </motion.div>

      {/* Right - Form */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={splitRevealRight}
        className="flex-1 flex items-center justify-center px-6 py-16 lg:py-24"
      >
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-paper-light dark:text-ink-700" strokeWidth={1.5} />
            </div>
            <span className="text-xl font-semibold tracking-tight">
              <span className="text-ink-primary dark:text-paper-light">Cook</span>
              <span className="text-ink-muted italic font-serif">Smart</span>
            </span>
          </div>

          <div>
            <EyebrowTag>Tài khoản</EyebrowTag>
            <h2 className="mt-5 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
              Đăng nhập.
            </h2>
            <p className="mt-3 text-ink-secondary">
              Chào mừng bạn quay trở lại.
            </p>
          </div>

          {error && (
            <div className="card-bezel">
              <div className="card-bezel-inner p-4 bg-[#FDEBEC] dark:bg-[#9F2F2D]/15 text-[#9F2F2D] dark:text-[#FDEBEC] text-sm font-medium">
                {error}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-5">
            <style>{`
              .clean-input {
                width: 100%;
                height: 48px;
                padding: 0 14px;
                background: #FFFFFF;
                border: 1px solid #CBD5E1;
                border-radius: 10px;
                color: #0F172A;
                font-size: 15px;
                font-family: inherit;
                outline: none;
                transition: border-color 150ms ease, box-shadow 150ms ease;
                box-sizing: border-box;
              }
              .clean-input::placeholder { color: #94A3B8; }
              .clean-input:focus {
                border-color: #ff4f00;
                box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.18);
              }
              .dark .clean-input {
                background: #0F172A;
                border-color: #334155;
                color: #F1F5F9;
              }
              .dark .clean-input::placeholder { color: #64748B; }
            `}</style>
            <div>
              <label className="block text-sm font-medium text-ink-primary dark:text-paper-light mb-1.5">
                Email hoặc Username
              </label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="clean-input"
                autoComplete="email"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-ink-primary dark:text-paper-light">
                  Mật khẩu
                </label>
                <a
                  href="#"
                  className="text-sm text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light transition-colors"
                >
                  Quên?
                </a>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="clean-input"
                  style={{ paddingRight: 44 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 36,
                    height: 36,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    color: '#64748B',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  aria-label={showPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPwd ? <EyeOff className="w-4 h-4" strokeWidth={2} /> : <Eye className="w-4 h-4" strokeWidth={2} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full"
              style={{
                height: 48,
                padding: '0 16px',
                background: loading ? '#94A3B8' : '#ff4f00',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="12" cy="12" r="10" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" />
                  </svg>
                  Đang đăng nhập...
                </>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-ink-secondary">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="link-underline font-medium text-ink-primary dark:text-paper-light">
              Tạo tài khoản
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage
