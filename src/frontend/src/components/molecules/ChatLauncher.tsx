import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Sparkles } from 'lucide-react';
import { easeFluid } from '../../lib/motion';

interface ChatLauncherProps {
  isOpen: boolean;
  onClick: () => void;
  hasUnread?: boolean;
}

const ChatLauncher: React.FC<ChatLauncherProps> = ({ isOpen, onClick, hasUnread = false }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.5, ease: easeFluid }}
      className="group fixed bottom-24 right-5 z-50 w-[60px] h-[60px] rounded-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-[#ff4f00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FDFBF7] dark:focus-visible:ring-offset-[#0E0C09]"
      aria-label={isOpen ? 'Đóng chatbot' : 'Mở chatbot'}
    >
      {/* Outer ambient ring - always present */}
      <span
        className="absolute inset-[-6px] rounded-full pointer-events-none transition-opacity duration-700 ease-[var(--ease-fluid)]"
        style={{
          opacity: isOpen ? 0 : 0.55,
          background:
            'radial-gradient(circle at center, rgba(255,79,0,0.35) 0%, rgba(255,79,0,0.0) 70%)',
        }}
      />

      {/* Pulse ring - ping animation when closed */}
      {!isOpen && (
        <span className="absolute inset-0 rounded-full ring-2 ring-[#ff4f00]/40 animate-ping" />
      )}

      {/* Bezel shell */}
      <span
        className={`absolute inset-0 rounded-full p-[1.5px] transition-all duration-700 ease-[var(--ease-fluid)] ${
          isOpen
            ? 'bg-[rgba(0,0,0,0.06)] dark:bg-[rgba(255,255,255,0.06)]'
            : 'bg-gradient-to-br from-[#ff6f33] via-[#ff4f00] to-[#c72602]'
        }`}
      >
        <span
          className={`flex items-center justify-center w-full h-full rounded-full transition-all duration-700 ease-[var(--ease-fluid)] ${
            isOpen
              ? 'bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light'
              : 'bg-[#ff4f00] text-white shadow-[0_8px_24px_-6px_rgba(255,79,0,0.5)]'
          }`}
        >
          {/* Icon swap */}
          <AnimatePresence mode="wait" initial={false}>
            {isOpen ? (
              <motion.span
                key="close"
                initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
                transition={{ duration: 0.4, ease: easeFluid }}
                className="inline-flex"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18" />
                  <path d="M6 6l12 12" />
                </svg>
              </motion.span>
            ) : (
              <motion.span
                key="msg"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.4, ease: easeFluid }}
                className="inline-flex relative"
              >
                <Sparkles className="w-[22px] h-[22px]" strokeWidth={1.5} />
              </motion.span>
            )}
          </AnimatePresence>

          {hasUnread && !isOpen && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-white rounded-full shadow-[0_0_8px_2px_rgba(255,255,255,0.7)]" />
          )}
        </span>
      </span>

      {/* Tooltip on hover (only when closed) */}
      <AnimatePresence>
        {!isOpen && hovered && (
          <motion.span
            initial={{ opacity: 0, x: 8, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 8, scale: 0.96 }}
            transition={{ duration: 0.4, ease: easeFluid }}
            className="absolute right-full mr-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-3 py-1.5 rounded-full bg-ink-700 dark:bg-paper-light text-paper-light dark:text-ink-700 text-xs font-medium tracking-tight shadow-ambient pointer-events-none"
          >
            Hỏi AI ngay
            <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-px w-2 h-2 bg-ink-700 dark:bg-paper-light rotate-45" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default ChatLauncher;
