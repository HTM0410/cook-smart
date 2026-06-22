import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import socketService from '../../services/socketService';
import { MessageSquare, Bot, User, MessageCircle } from 'lucide-react';

interface ChatMessageProps {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  sources?: Array<{
    recipeId: number;
    recipeName: string;
    content: string;
    similarity: number;
  }>;
  onRecipeClick?: (recipeId: number) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  createdAt,
  sources,
  onRecipeClick,
}) => {
  const isUser = role === 'user';
  const time = createdAt ? new Date(createdAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }) : null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`flex gap-3 max-w-[80%] ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            isUser
              ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
              : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
          }`}
        >
          {isUser ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
        </div>

        {/* Message content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`px-4 py-3 rounded-2xl ${
              isUser
                ? 'bg-orange-600 text-white rounded-tr-md'
                : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 rounded-tl-md'
            }`}
          >
            <p className="whitespace-pre-wrap">{content}</p>
          </div>

          {/* Sources (for AI responses) */}
          {sources && sources.length > 0 && (
            <div className="mt-2 w-full">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Nguồn tham khảo:
              </p>
              <div className="flex flex-wrap gap-2">
                {sources.map((source, index) => (
                  <button
                    key={index}
                    onClick={() => onRecipeClick?.(source.recipeId)}
                    className="px-3 py-1.5 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {source.recipeName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Timestamp */}
          {time && (
            <span className="text-xs text-gray-400 mt-1 px-1">{time}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
