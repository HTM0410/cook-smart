import React from 'react';
import { motion } from 'framer-motion';
import { ChatSession } from '../../services/chatService';
import { Plus, Trash2, MessageSquare } from 'lucide-react';

interface ChatSessionListProps {
  sessions: ChatSession[];
  currentSessionId?: number;
  onSelectSession: (sessionId: number) => void;
  onDeleteSession: (sessionId: number) => void;
  onNewChat: () => void;
}

const ChatSessionList: React.FC<ChatSessionListProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Hôm nay';
    if (days === 1) return 'Hôm qua';
    if (days < 7) return `${days} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-ink-200/40 dark:border-ink-700/40">
        <button
          onClick={onNewChat}
          className="btn-editorial-primary w-full justify-center !py-2.5 !text-xs"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          Cuộc trò chuyện mới
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4 text-ink-muted">
            <MessageSquare className="w-10 h-10 mb-2 opacity-50" strokeWidth={1} />
            <p className="text-sm font-medium">Chưa có cuộc trò chuyện</p>
            <p className="text-xs mt-1 opacity-80">Nhấn nút phía trên để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = currentSessionId === session.id;
              return (
                <motion.div
                  key={session.id}
                  whileHover={{ scale: 1.01 }}
                  className={`group relative rounded-2xl transition-all duration-500 ease-[var(--ease-fluid)] ${
                    isActive
                      ? 'bg-paper-light dark:bg-ink-700 ring-1 ring-[#ff4f00]/40'
                      : 'hover:bg-paper-light dark:hover:bg-ink-700 ring-1 ring-transparent hover:ring-ink-200/40 dark:hover:ring-ink-700/40'
                  }`}
                >
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="w-full p-2.5 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] uppercase tracking-[0.15em] font-bold ${
                          isActive
                            ? 'text-[#ff4f00]'
                            : 'text-ink-muted'
                        }`}
                      >
                        {formatDate(session.updatedAt || session.createdAt)}
                      </span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f00] animate-pulse" />
                      )}
                    </div>
                    <h3
                      className={`text-sm font-medium truncate ${
                        isActive
                          ? 'text-ink-primary dark:text-paper-light'
                          : 'text-ink-secondary'
                      }`}
                    >
                      {session.sessionTitle || 'Cuộc trò chuyện'}
                    </h3>
                    {session.preview && (
                      <p className="text-xs text-ink-muted truncate mt-0.5">
                        {session.preview}
                      </p>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-[#FDEBEC] dark:hover:bg-[#9F2F2D]/15 text-[#9F2F2D] transition-all duration-500 ease-[var(--ease-fluid)]"
                    aria-label="Xóa cuộc trò chuyện"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSessionList;