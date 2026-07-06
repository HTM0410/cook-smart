import React from 'react';
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
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900/50">
      {/* New-chat button */}
      <div className="p-3 border-b border-gray-200/70 dark:border-gray-800">
        <button
          onClick={onNewChat}
          className="w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-medium hover:shadow-md hover:shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10 px-4 text-gray-400 dark:text-gray-500">
            <MessageSquare className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm font-medium">Chưa có cuộc trò chuyện</p>
            <p className="text-xs mt-1 opacity-80">Nhấn nút phía trên để bắt đầu</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = currentSessionId === session.id;
              return (
                <div
                  key={session.id}
                  className={`group relative rounded-xl transition-all ${
                    isActive
                      ? 'bg-white dark:bg-gray-800 shadow-sm border border-orange-200 dark:border-orange-900/40'
                      : 'hover:bg-white/70 dark:hover:bg-gray-800/60 border border-transparent'
                  }`}
                >
                  <button
                    onClick={() => onSelectSession(session.id)}
                    className="w-full p-2.5 text-left"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[10px] uppercase tracking-wider font-semibold ${
                          isActive
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-400 dark:text-gray-500'
                        }`}
                      >
                        {formatDate(session.updatedAt || session.createdAt)}
                      </span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                      )}
                    </div>
                    <h3
                      className={`text-sm font-medium truncate ${
                        isActive
                          ? 'text-gray-900 dark:text-gray-100'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {session.sessionTitle || 'Cuộc trò chuyện'}
                    </h3>
                    {session.preview && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {session.preview}
                      </p>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all"
                    aria-label="Xóa cuộc trò chuyện"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSessionList;