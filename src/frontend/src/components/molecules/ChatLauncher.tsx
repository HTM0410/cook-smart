import React from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';

interface ChatLauncherProps {
  isOpen: boolean;
  onClick: () => void;
  hasUnread?: boolean;
}

const ChatLauncher: React.FC<ChatLauncherProps> = ({ isOpen, onClick, hasUnread = false }) => {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      className={`
        fixed bottom-6 right-6 z-50
        w-14 h-14 rounded-full
        flex items-center justify-center
        transition-all duration-700 ease-[var(--ease-fluid)]
        ring-1
        ${
          isOpen
            ? 'bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light ring-ink-200/40 dark:ring-ink-700/40'
            : 'bg-[#ff4f00] text-white ring-[#ff4f00]/30 shadow-[0_4px_24px_-8px_rgba(255,79,0,0.4)]'
        }
      `}
      aria-label={isOpen ? 'Đóng chatbot' : 'Mở chatbot'}
    >
      {isOpen ? (
        <X className="w-5 h-5" strokeWidth={1.5} />
      ) : (
        <>
          <MessageSquare className="w-5 h-5" strokeWidth={1.5} />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#9F2F2D] rounded-full ring-2 ring-paper-light dark:ring-ink-700 flex items-center justify-center">
              <span className="w-1.5 h-1.5 bg-white rounded-full" />
            </span>
          )}
        </>
      )}
    </motion.button>
  );
};

export default ChatLauncher;