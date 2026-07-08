import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, ChefHat, Check, ArrowUpRight } from 'lucide-react'
import { EyebrowTag } from '../components/atoms/EyebrowTag'
import { ButtonEditorial } from '../components/atoms/ButtonEditorial'
import { splitRevealLeft, splitRevealRight } from '../lib/motion'

const RegisterPage: React.FC = () => {
  const { register, loading } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const passwordRequirements = [
    { label: 'Ít nhất 8 ký tự', met: password.length >= 8 },
    { label: 'Có chữ cái', met: /[A-Za-z]/.test(password) },
    { label: 'Có số', met: /\d/.test(password) },
  ]
  const strength = passwordRequirements.filter(r => r.met).length

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName || !email || !password) { setError('Vui lòng nhập đầy đủ thông tin'); return }
    if (password !== confirm) { setError('Xác nhận mật khẩu không khớp'); return }
    if (strength < 3) { setError('Mật khẩu chưa đủ mạnh'); return }
    try {
      await register(fullName, email, password)
      navigate('/')
    } catch {
      setError('Đăng ký thất bại, vui lòng thử lại')
    }
  }

  return (
    <div className="min-h-[100dvh] bg-paper-light dark:bg-ink-800 flex flex-col lg:flex-row">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={splitRevealLeft}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-ink-700 text-paper-light p-12 lg:p-20 flex-col justify-between min-h-[60vh] lg:min-h-[100dvh]"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 -right-32 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(122,139,111,0.18)_0%,transparent_60%)]" />
          <div className="absolute bottom-0 -left-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,79,0,0.10)_0%,transparent_60%)]" />
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
          <EyebrowTag dotColor="bg-[#95a583]" className="bg-paper-light/10 text-paper-light">
            Bắt đầu hành trình
          </EyebrowTag>
          <h1 className="text-display text-5xl xl:text-6xl text-paper-light text-balance">
            Tạo tài khoản.
            <br />
            <span className="text-ink-300 italic">Khám phá ẩm thực.</span>
          </h1>
          <p className="text-ink-200 text-lg leading-relaxed text-pretty">
            Lưu công thức yêu thích, lập thực đơn tuần và nhận gợi ý thông minh từ AI.
          </p>
          <div className="space-y-3 pt-4">
            {[
              'Khám phá 1,000+ công thức',
              'Lưu công thức yêu thích',
              'Lập thực đơn tuần',
              'AI gợi ý thông minh',
            ].map((label, i) => (
              <div key={i} className="flex items-center gap-3 text-ink-100">
                <span className="w-1.5 h-1.5 rounded-full bg-[#95a583]" />
                <span className="text-sm font-medium tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs uppercase tracking-[0.2em] text-ink-300">
          CookSmart · 2026
        </div>
      </motion.div>

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
            <EyebrowTag>Tạo tài khoản</EyebrowTag>
            <h2 className="mt-5 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
              Bắt đầu.
            </h2>
            <p className="mt-3 text-ink-secondary">
              Điền thông tin để bắt đầu.
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
            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary font-medium">Họ và tên</label>
              <div className="input-bezel">
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="input-bezel-inner h-12 text-base"
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary font-medium">Email</label>
              <div className="input-bezel">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="input-bezel-inner h-12 text-base"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary font-medium">Mật khẩu</label>
              <div className="input-bezel">
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input-bezel-inner h-12 pr-12 text-base"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-paper-light dark:hover:bg-ink-700 transition-colors"
                    aria-label="Hiện mật khẩu"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
              {password.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map(level => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-700 ease-[var(--ease-fluid)] ${
                          strength >= level
                            ? strength === 1 ? 'bg-[#9F2F2D]' : strength === 2 ? 'bg-[#956400]' : 'bg-[#346538]'
                            : 'bg-ink-200/40 dark:bg-ink-700/40'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="space-y-1">
                    {passwordRequirements.map((req, i) => (
                      <div key={i} className={`flex items-center gap-2 text-[11px] font-medium tracking-wide ${req.met ? 'text-[#346538]' : 'text-ink-muted'}`}>
                        <Check className="w-3 h-3" strokeWidth={2} />
                        {req.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary font-medium">Xác nhận mật khẩu</label>
              <div className="input-bezel">
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    className="input-bezel-inner h-12 pr-12 text-base"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-ink-secondary hover:text-ink-primary hover:bg-paper-light dark:hover:bg-ink-700 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" strokeWidth={1.5} /> : <Eye className="w-4 h-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>
              {confirm && password !== confirm && (
                <p className="text-xs text-[#9F2F2D] tracking-wide">Mật khẩu không khớp</p>
              )}
            </div>

            <ButtonEditorial
              type="submit"
              size="lg"
              className="w-full justify-between"
              disabled={loading}
            >
              {loading ? 'Đang tạo tài khoản...' : 'Tạo tài khoản'}
            </ButtonEditorial>
          </form>

          <p className="text-center text-sm text-ink-secondary">
            Đã có tài khoản?{' '}
            <Link to="/login" className="link-underline font-medium text-ink-primary dark:text-paper-light">
              Đăng nhập
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default RegisterPage
