import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Header from '../organisms/Header'
import Footer from '../organisms/Footer'
import BottomNav from '../organisms/BottomNav'
import ChatBot from '../organisms/ChatBot'
import ChatLauncher from '../molecules/ChatLauncher'
import { NoiseOverlay } from '../atoms/NoiseOverlay'
import { easeFluid } from '../../lib/motion'

const Layout: React.FC = () => {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    setIsTransitioning(true)
    const timer = setTimeout(() => setIsTransitioning(false), 280)
    return () => clearTimeout(timer)
  }, [location.pathname])

  // Auto-close chat when navigating
  useEffect(() => {
    setChatOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] dark:bg-[#0E0C09]">
      <NoiseOverlay />
      <Header />
      <main className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: isTransitioning ? 0 : 1, y: isTransitioning ? 8 : 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.6, ease: easeFluid }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <BottomNav />

      {/* Chat FAB - only show when not on chat page */}
      {location.pathname !== '/chat' && (
        <ChatLauncher isOpen={chatOpen} onClick={() => setChatOpen(!chatOpen)} />
      )}

      <AnimatePresence>
        {chatOpen && location.pathname !== '/chat' && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.7, ease: easeFluid }}
            className="fixed bottom-24 right-5 z-50"
          >
            <ChatBot isOpen={chatOpen} onClose={() => setChatOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Layout
