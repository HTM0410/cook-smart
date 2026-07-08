import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Calendar, ShoppingCart, Sparkles, ArrowUpRight, MessageCircle } from 'lucide-react'
import { EyebrowTag } from '../atoms/EyebrowTag'
import { ButtonEditorial } from '../atoms/ButtonEditorial'
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, viewportOnce } from '../../lib/motion'

const MealPlanCTA: React.FC = () => {
  const features = [
    { icon: Sparkles, label: 'AI gợi ý thông minh', desc: 'Công nghệ AI giúp bạn chọn món ăn phù hợp' },
    { icon: Calendar, label: 'Lên thực đơn dễ dàng', desc: 'Kéo thả công thức vào lịch tuần của bạn' },
    { icon: ShoppingCart, label: 'Danh sách đi chợ tự động', desc: 'Tạo danh sách mua sắm từ thực đơn đã chọn' },
  ]

  return (
    <section className="section-lg bg-ink-700 text-paper-light relative overflow-hidden">
      {/* Decorative mesh background */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,79,0,0.15)_0%,transparent_60%)]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(122,139,111,0.10)_0%,transparent_60%)]" />
      </div>

      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left - Editorial Text */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={splitRevealLeft}
            className="lg:col-span-7"
          >
            <EyebrowTag dotColor="bg-[#ff6f33]">Tính năng mới</EyebrowTag>
            <h2 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-paper-light text-balance">
              Lên thực đơn.
              <br />
              <span className="text-ink-300 italic">Đi chợ tự động.</span>
            </h2>
            <p className="text-ink-200 text-lg leading-relaxed max-w-[52ch] mt-8 text-pretty">
              Kết hợp AI gợi ý, lịch tuần trực quan và danh sách đi chợ tự động.
              Tất cả giúp bạn tiết kiệm thời gian và ăn uống lành mạnh hơn.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link to="/meal-plans">
                <ButtonEditorial variant="inverse" size="lg">
                  <Calendar className="w-4 h-4" strokeWidth={1.5} />
                  Lập thực đơn
                </ButtonEditorial>
              </Link>
              <Link to="/chat">
                <ButtonEditorial variant="ghost" size="lg" className="ring-paper-light/20 text-paper-light">
                  <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
                  Trò chuyện với AI
                </ButtonEditorial>
              </Link>
            </div>
          </motion.div>

          {/* Right - Floating glass feature cards */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerGrid}
            className="lg:col-span-5"
          >
            <div className="space-y-4">
              {features.map((feature, i) => (
                <motion.div key={i} custom={i} variants={cardReveal}>
                  <div className="rounded-squircle bg-paper-light/[0.04] backdrop-blur-md ring-1 ring-paper-light/10 p-1.5">
                    <div className="rounded-[calc(2rem-0.375rem)] bg-ink-700/40 p-6 flex items-start gap-4 transition-colors duration-700 ease-[var(--ease-fluid)] hover:bg-ink-700/60">
                      <span className="w-12 h-12 rounded-full bg-paper-light/10 ring-1 ring-paper-light/10 flex items-center justify-center flex-shrink-0">
                        <feature.icon className="w-5 h-5 text-paper-light" strokeWidth={1.5} />
                      </span>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-paper-light mb-1">{feature.label}</h3>
                        <p className="text-sm text-ink-200 leading-relaxed">{feature.desc}</p>
                      </div>
                      <span className="w-9 h-9 rounded-full bg-paper-light/10 flex items-center justify-center text-paper-light">
                        <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={1.5} />
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportOnce}
              transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1], delay: 0.5 }}
              className="mt-8 flex items-center gap-4"
            >
              <div className="flex -space-x-2">
                {['#ff4f00', '#7a8b6f', '#f59e0b', '#a8bb95'].map((color, i) => (
                  <div
                    key={i}
                    className="w-9 h-9 rounded-full border-2 border-ink-700 flex items-center justify-center text-white text-[10px] font-bold tracking-wide"
                    style={{ backgroundColor: color }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-display text-2xl text-paper-light">2,000+</p>
                <p className="text-xs uppercase tracking-[0.2em] text-ink-200">Người dùng</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default MealPlanCTA
