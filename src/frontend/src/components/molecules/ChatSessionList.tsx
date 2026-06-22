import React from 'react';
import { ChatSession } from '../../services/chatService';
import { MessageSquare, Trash2, Clock } from 'lucide-react';

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

    if (days === 0) {
      return 'Hôm nay';
    } else if (days === 1) {
      return 'Hôm qua';
    } else if (days < 7) {
      return `${days} ngày trước`;
    } else {
      return date.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700">
        <button
          onClick={onNewChat}
          className="w-full px-4 py-3 rounded-xl bg-orange-600 text-white font-medium hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-5 h-5" />
          Cuộc trò chuyện mới
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8 px-4">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Chưa có cuộc trò chuyện nào</p>
            <p className="text-sm mt-1">Bắt đầu cuộc trò chuyện mới</p>
          </div>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group relative rounded-lg ${
                  currentSessionId === session.id
                    ? 'bg-orange-50 dark:bg-orange-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <button
                  onClick={() => onSelectSession(session.id)}
                  className="w-full p-3 text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(session.updatedAt || session.createdAt)}
                    </span>
                  </div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {session.sessionTitle}
                  </h3>
                  {session.preview && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                      {session.preview}
                    </p>
                  )}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="absolute top-2 right-2 p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSessionList;
