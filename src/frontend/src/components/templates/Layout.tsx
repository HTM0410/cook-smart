import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Header from '../organisms/Header'
import Footer from '../organisms/Footer'
import BottomNav from '../organisms/BottomNav'
import ChatBot from '../organisms/ChatBot'
import { MessageSquare } from 'lucide-react'

const Layout: React.FC = () => {
  const location = useLocation()
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    setIsTransitioning(true)
    const timer = setTimeout(() => setIsTransitioning(false), 300)
    return () => clearTimeout(timer)
  }, [location.pathname])

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main
        className={`flex-1 transition-opacity duration-300 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <Outlet />
      </main>
      <Footer />
      <BottomNav />

      {/* Chat FAB - only show when not on chat page */}
      {!chatOpen && location.pathname !== '/chat' && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-24 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-amber-500 text-white shadow-xl hover:shadow-2xl hover:shadow-primary-500/30 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 group"
          aria-label="Mở trợ lý chat"
        >
          <MessageSquare className="w-6 h-6 group-hover:animate-bounce-gentle" />
        </button>
      )}

      {chatOpen && location.pathname !== '/chat' && (
        <div className="fixed bottom-24 right-5 z-50 w-96 h-[600px] max-w-[calc(100vw-2rem)]">
          <ChatBot isOpen={chatOpen} onClose={() => setChatOpen(false)} />
        </div>
      )}
    </div>
  )
}

export default Layout
