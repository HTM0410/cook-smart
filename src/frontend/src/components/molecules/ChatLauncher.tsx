import React from 'react';
import { MessageSquare, X } from 'lucide-react';

interface ChatLauncherProps {
  isOpen: boolean;
  onClick: () => void;
  hasUnread?: boolean;
}

const ChatLauncher: React.FC<ChatLauncherProps> = ({ isOpen, onClick, hasUnread = false }) => {
  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6 z-50
        w-14 h-14 rounded-full
        flex items-center justify-center
        shadow-lg transition-all duration-300
        ${
          isOpen
            ? 'bg-gray-600 hover:bg-gray-700 text-white'
            : 'bg-gradient-to-br from-primary-500 to-amber-500 hover:from-primary-600 hover:to-amber-600 text-white hover:scale-110 hover:shadow-xl hover:shadow-primary-500/25'
        }
        ${hasUnread ? 'animate-pulse-soft' : ''}
      `}
      aria-label={isOpen ? 'Đóng chatbot' : 'Mở chatbot'}
    >
      {isOpen ? (
        <X className="w-6 h-6" />
      ) : (
        <>
          <MessageSquare className="w-6 h-6" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 flex items-center justify-center">
              <span className="w-2 h-2 bg-white rounded-full" />
            </span>
          )}
        </>
      )}
    </button>
  );
};

export default ChatLauncher;
