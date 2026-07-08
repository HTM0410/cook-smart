import React from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { EyebrowTag } from '../components/atoms/EyebrowTag'
import { ButtonEditorial } from '../components/atoms/ButtonEditorial'
import { easeFluid } from '../lib/motion'

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[100dvh] bg-paper-light dark:bg-ink-800 flex items-center justify-center px-6 relative overflow-hidden">
      {/* Decorative backdrops */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(255,79,0,0.08)_0%,transparent_60%)]" />
        <div className="absolute bottom-1/4 -right-32 w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(122,139,111,0.08)_0%,transparent_60%)]" />
      </div>

      <div className="relative z-10 max-w-2xl text-center space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: easeFluid }}
        >
          <EyebrowTag>Trang lạc</EyebrowTag>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 1.3, ease: easeFluid, delay: 0.1 }}
          className="text-display text-[10rem] md:text-[14rem] lg:text-[18rem] leading-none text-ink-primary dark:text-paper-light tracking-tightest"
        >
          404
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, ease: easeFluid, delay: 0.3 }}
          className="space-y-4"
        >
          <p className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light italic">
            Có gì đó lạc đà.
          </p>
          <p className="text-ink-secondary max-w-md mx-auto text-pretty">
            Trang bạn đang tìm không tồn tại — hoặc có thể nó đã được nấu chín và phục vụ rồi. Hãy quay về trang chủ nhé.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easeFluid, delay: 0.5 }}
          className="pt-2"
        >
          <Link to="/">
            <ButtonEditorial variant="primary" size="lg">
              Về trang chủ
            </ButtonEditorial>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

export default NotFoundPage
