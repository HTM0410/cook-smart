import React from 'react'
import { Link } from 'react-router-dom'
import Button from '../atoms/Button'
import { Sparkles, Calendar, ShoppingCart, ChefHat, ArrowRight } from 'lucide-react'

const MealPlanCTA: React.FC = () => {
  const features = [
    { icon: Sparkles, label: 'AI gợi ý thông minh', desc: 'Công thghệ AI giúp bạn chọn món ăn phù hợp' },
    { icon: Calendar, label: 'Lên thực đơn dễ dàng', desc: 'Kéo thả công thức vào lịch tuần của bạn' },
    { icon: ShoppingCart, label: 'Danh sách đi chợ tự động', desc: 'Tạo danh sách mua sắm từ thực đơn đã chọn' },
    { icon: ChefHat, label: 'Theo dõi dinh dưỡng', desc: 'Giám sát lượng calories và chất dinh dưỡng' },
  ]

  return (
    <section className="py-16 lg:py-20 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-500 to-amber-500" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-40 h-40 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-60 h-60 bg-white rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white rounded-full blur-3xl opacity-50" />
      </div>

      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <div className="space-y-8 text-white">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-sm font-semibold">
                <Sparkles className="w-4 h-4" />
                Tính năng mới
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-white">
                Lên kế hoạch
                <br />
                <span className="text-amber-200">bữa ăn thông minh</span>
              </h2>
              <p className="text-white/80 text-lg max-w-lg leading-relaxed">
                Kết hợp AI gợi ý, lịch tuần trực quan và danh sách đi chợ tự động. Tất cả giúp bạn tiết kiệm thời gian và ăn uống lành mạnh hơn.
              </p>
            </div>

            {/* Action */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/meal-plans">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-white text-primary-600 hover:bg-gray-100 shadow-xl hover:shadow-2xl hover:shadow-black/10 transition-all group"
                >
                  <Calendar className="w-5 h-5" />
                  Lập thực đơn ngay
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Link to="/chat">
                <Button
                  variant="glass"
                  size="lg"
                  className="w-full sm:w-auto text-white border-white/30 hover:bg-white/20"
                >
                  <Sparkles className="w-5 h-5" />
                  Trò chuyện với AI
                </Button>
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {['#ff4f00', '#14b8a6', '#f59e0b', '#8b5cf6'].map((color, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white text-xs font-bold shadow-md"
                    style={{ backgroundColor: color }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div className="text-sm text-white/80">
                <span className="font-bold text-white">2,000+</span> người đang sử dụng
              </div>
            </div>
          </div>

          {/* Right: Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feature, i) => (
              <div
                key={i}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 hover:bg-white/20 transition-all duration-300 hover:-translate-y-1 group/feature"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4 group-hover/feature:scale-110 transition-transform duration-300">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-base font-bold text-white mb-1">{feature.label}</h3>
                <p className="text-sm text-white/60">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default MealPlanCTA
