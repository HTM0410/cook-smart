import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/atoms/Button'
import { Eye, EyeOff, ChefHat, Sparkles, ArrowRight, Check } from 'lucide-react'

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
    { label: 'Có ít nhất 1 chữ cái', met: /[A-Za-z]/.test(password) },
    { label: 'Có ít nhất 1 số', met: /\d/.test(password) },
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-teal-600 via-secondary-600 to-cyan-600">
        <div className="absolute inset-0">
          <div className="absolute top-10 right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute bottom-20 left-20 w-60 h-60 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 py-12 text-white">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <ChefHat className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-extrabold">Cook<span className="text-teal-200">Smart</span></span>
          </div>

          <div className="space-y-8">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-sm font-semibold mb-6">
                <Sparkles className="w-4 h-4" />
                Tham gia cùng chúng tôi
              </div>
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight mb-6">
                Bắt đầu
                <br />
                <span className="text-teal-200">hành trình</span>
                <br />
                ẩm thực
              </h1>
              <p className="text-white/70 text-lg max-w-md leading-relaxed">
                Đăng ký tài khoản để lưu công thức yêu thích, lập thực đơn và nhận gợi ý từ AI.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { emoji: '🍳', label: 'Khám phá 1,000+ công thức' },
                { emoji: '💾', label: 'Lưu công thức yêu thích' },
                { emoji: '📋', label: 'Lập thực đơn tuần' },
                { emoji: '🤖', label: 'AI gợi ý thông minh' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-white/80">
                  <span className="text-xl">{item.emoji}</span>
                  <span className="font-medium">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="absolute top-24 right-16 text-5xl opacity-20 animate-float">🍰</div>
          <div className="absolute bottom-32 left-16 text-4xl opacity-15 animate-float-slow">🥗</div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-500 to-teal-500 flex items-center justify-center shadow-md">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">Cook<span className="text-secondary-500">Smart</span></span>
          </div>

          <div className="animate-fade-in-up">
            <div className="mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">Tạo tài khoản</h2>
              <p className="text-muted-foreground">Điền thông tin để bắt đầu khám phá ẩm thực.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 animate-slide-down">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="label">Họ và tên</label>
                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Nhập họ và tên" className="input" autoComplete="name" />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Nhập email" className="input" autoComplete="email" />
              </div>
              <div>
                <label className="label">Mật khẩu</label>
                <div className="relative">
                  <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Nhập mật khẩu" className="input pr-12" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                    {showPwd ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {/* Password Strength */}
                {password.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-1.5">
                      {[1,2,3].map(level => (
                        <div key={level} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          strength >= level
                            ? strength === 1 ? 'bg-red-500' : strength === 2 ? 'bg-amber-500' : 'bg-green-500'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`} />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {passwordRequirements.map((req, i) => (
                        <div key={i} className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${req.met ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                          <Check className="w-3 h-3" />
                          {req.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Xác nhận mật khẩu</label>
                <div className="relative">
                  <input type={showConfirm ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Nhập lại mật khẩu" className="input pr-12" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirm && password !== confirm && (
                  <p className="text-xs text-red-500 mt-1">Mật khẩu không khớp</p>
                )}
              </div>

              <Button type="submit" size="lg" loading={loading} className="w-full mt-4">
                Tạo tài khoản
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-700" /></div>
              <div className="relative flex justify-center"><span className="px-4 text-sm text-muted-foreground bg-gray-50 dark:bg-gray-900">hoặc</span></div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Đã có tài khoản?{' '}
              <Link to="/login" className="font-semibold text-secondary-600 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-300 transition-colors">
                Đăng nhập ngay
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage
