import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import chatService, { ChatSession, ChatMessage } from '../../services/chatService';
import socketService from '../../services/socketService';
import ChatMessageBubble from '../molecules/ChatMessageBubble';
import ChatInput from '../molecules/ChatInput';
import ChatSessionList from '../molecules/ChatSessionList';
import {
  MessageSquare,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  Sparkles,
  LogIn,
  Plus,
} from 'lucide-react';

interface ChatBotProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialSessionId?: number;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 0,
  role: 'assistant',
  content: 'Xin chào! Tôi là trợ lý nấu ăn của CookSmart. Bạn có thể hỏi tôi về công thức nấu ăn, nguyên liệu, hoặc gợi ý món ăn nhé!',
  createdAt: new Date().toISOString(),
};

const ChatBot: React.FC<ChatBotProps> = ({ isOpen = true, onClose, initialSessionId }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (user) {
      loadSessions();
      loadSuggestions();
    } else {
      setSessions([]);
      setCurrentSession(null);
      setMessages([]);
      setSuggestions([]);
    }
  }, [user]);

  const cleanupSocket = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (user && currentSession) {
      loadMessages(currentSession.id);
      const cleanup = setupSocket(currentSession.id);
      cleanupSocket.current = cleanup;
      reconnectAttempts.current = 0;
    } else {
      if (cleanupSocket.current) {
        cleanupSocket.current();
        cleanupSocket.current = null;
      }
    }

    return () => {
      if (cleanupSocket.current) {
        cleanupSocket.current();
        cleanupSocket.current = null;
      }
    };
  }, [user, currentSession?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const setupSocket = useCallback((sessionId: number): (() => void) => {
    socketService.connect(localStorage.getItem('token') || undefined);

    const handleJoined = (data: any) => {
      setMessages(data.messages || []);
      setIsTyping(false);
    };

    const handleMessage = (data: any) => {
      const newMessage: ChatMessage = {
        id: data.id,
        role: data.role as 'user' | 'assistant',
        content: data.content,
        createdAt: data.createdAt,
        sources: data.sources,
      };
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, newMessage];
      });
      setIsTyping(false);
    };

    const handleTyping = (data: any) => {
      if (data.role === 'assistant') {
        setIsTyping(data.isTyping);
      }
    };

    const handleErr = (data: any) => {
      setError(data.message);
      setIsTyping(false);
      setTimeout(() => setError(null), 5000);
    };

    socketService.on('chat:joined', handleJoined);
    socketService.on('chat:message', handleMessage);
    socketService.on('chat:typing', handleTyping);
    socketService.on('chat:error', handleErr);

    socketService.joinChat(sessionId);

    return () => {
      socketService.off('chat:joined', handleJoined);
      socketService.off('chat:message', handleMessage);
      socketService.off('chat:typing', handleTyping);
      socketService.off('chat:error', handleErr);
      socketService.leaveChat(sessionId);
    };
  }, []);

  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const data = await chatService.getSessions();
      setSessions(data);

      if (initialSessionId) {
        const session = data.find((s) => s.id === initialSessionId);
        if (session) {
          setCurrentSession(session);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadMessages = async (sessionId: number) => {
    setIsLoading(true);
    try {
      const data = await chatService.getSession(sessionId);
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages([{ ...WELCOME_MESSAGE, createdAt: new Date().toISOString() }]);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([{ ...WELCOME_MESSAGE, createdAt: new Date().toISOString() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      const data = await chatService.getSuggestions();
      setSuggestions(data);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
      setSuggestions([
        'Gợi ý món ăn cho tôi',
        'Công thức nấu ăn nhanh',
        'Món ăn cho người ăn chay',
      ]);
    }
  };

  const handleNewChat = async () => {
    if (!user) {
      handleLoginPrompt();
      return;
    }

    if (currentSession) {
      if (cleanupSocket.current) {
        cleanupSocket.current();
        cleanupSocket.current = null;
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      const session = await chatService.createSession();
      setCurrentSession(session);
      setMessages([{ ...WELCOME_MESSAGE, createdAt: new Date().toISOString() }]);
      setSessions((prev) => [session, ...prev]);
    } catch (err) {
      console.error('Failed to create session:', err);
      setError('Không thể tạo cuộc trò chuyện. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = async (sessionId: number) => {
    if (currentSession?.id === sessionId) return;

    if (cleanupSocket.current) {
      cleanupSocket.current();
      cleanupSocket.current = null;
    }

    setIsLoading(true);
    setError(null);
    try {
      const session = await chatService.getSession(sessionId);
      setCurrentSession(session);
      if (session.messages && session.messages.length > 0) {
        setMessages(session.messages);
      } else {
        setMessages([{ ...WELCOME_MESSAGE, createdAt: new Date().toISOString() }]);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError('Không thể tải cuộc trò chuyện. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await chatService.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSession?.id === sessionId) {
        if (cleanupSocket.current) {
          cleanupSocket.current();
          cleanupSocket.current = null;
        }
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      setError('Không thể xóa cuộc trò chuyện.');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    if (isCreatingSession) return;

    let sessionId = currentSession?.id;

    if (!sessionId) {
      setIsCreatingSession(true);
      setError(null);
      try {
        const session = await chatService.createSession();
        setCurrentSession(session);
        setSessions((prev) => [session, ...prev]);
        setMessages([{ ...WELCOME_MESSAGE, createdAt: new Date().toISOString() }]);
        sessionId = session.id;
      } catch (err) {
        console.error('Failed to create session:', err);
        setError('Không thể tạo cuộc trò chuyện. Vui lòng thử lại.');
        setIsCreatingSession(false);
        return;
      } finally {
        setIsCreatingSession(false);
      }
    }

    if (!sessionId) return;

    const tempUserMessage: ChatMessage = {
      id: Date.now(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);
    setIsTyping(true);

    try {
      const result = await chatService.sendMessage(sessionId, content);
      const aiMessage: ChatMessage = {
        id: result.aiMessage.id || Date.now() + 1,
        role: 'assistant',
        content: result.aiMessage.content,
        createdAt: result.aiMessage.createdAt,
        sources: result.aiMessage.sources,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Không thể gửi tin nhắn. Vui lòng thử lại.');
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleRecipeClick = (recipeId: number) => {
    onClose?.();
    navigate(`/recipes/${recipeId}`);
  };

  const handleLoginPrompt = () => {
    onClose?.();
    navigate('/login');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[420px] max-w-[calc(100vw-3rem)] h-[640px] max-h-[calc(100vh-140px)] bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden animate-scale-in origin-bottom-right">
      {/* Header - slim & balanced */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 via-emerald-600 to-teal-600 text-white flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0 ring-1 ring-white/20">
            <Sparkles className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-sm leading-tight truncate">CookSmart Assistant</h2>
            <div className="flex items-center gap-1.5 text-[11px] text-white/80 mt-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-200"></span>
              </span>
              <span>Trực tuyến • Powered by AI</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {user && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-white/15 active:bg-white/25 transition-colors"
              title={isSidebarOpen ? 'Ẩn danh sách' : 'Hiện danh sách'}
              aria-label="Toggle sidebar"
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/15 active:bg-white/25 transition-colors"
            title="Đóng"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Session sidebar */}
        {user && isSidebarOpen && (
          <div className="w-60 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
            <ChatSessionList
              sessions={sessions}
              currentSessionId={currentSession?.id}
              onSelectSession={handleSelectSession}
              onDeleteSession={handleDeleteSession}
              onNewChat={handleNewChat}
            />
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-900/30 dark:to-gray-900">
          {isLoadingSessions && !currentSession ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Đang tải cuộc trò chuyện...</p>
            </div>
          ) : !currentSession && !isLoading ? (
            /* Welcome screen */
            <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/25 flex-shrink-0">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1.5 text-center">
                Xin chào! Tôi có thể giúp gì?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 max-w-xs">
                Gợi ý công thức, hướng dẫn nấu ăn, hoặc tìm món phù hợp với nguyên liệu bạn có.
              </p>

              {!user ? (
                <>
                  <div className="w-full max-w-xs p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40 mb-4 flex items-start gap-2">
                    <LogIn className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                      Đăng nhập để lưu lịch sử trò chuyện và đồng bộ giữa các thiết bị.
                    </p>
                  </div>
                  <div className="w-full max-w-xs space-y-2 mb-4">
                    {suggestions.slice(0, 3).map((suggestion, index) => (
                      <div
                        key={index}
                        className="w-full px-3 py-2.5 text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 opacity-70"
                      >
                        <div className="flex items-center gap-2.5">
                          <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{suggestion}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleLoginPrompt}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4" />
                    Đăng nhập để bắt đầu
                  </button>
                </>
              ) : isCreatingSession ? (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="text-sm font-medium">Đang tạo cuộc trò chuyện...</span>
                </div>
              ) : (
                <>
                  <div className="w-full max-w-xs space-y-2 mb-5">
                    {suggestions.slice(0, 3).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        disabled={isCreatingSession}
                        className="group w-full px-3 py-2.5 text-left rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2.5">
                          <MessageSquare className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-500 flex-shrink-0 transition-colors" />
                          <span className="text-xs text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 truncate transition-colors">
                            {suggestion}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleNewChat}
                    disabled={isLoading || isCreatingSession}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {(isLoading || isCreatingSession) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Bắt đầu cuộc trò chuyện mới
                  </button>
                </>
              )}
            </div>
          ) : isLoading && currentSession ? (
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Đang tải tin nhắn...</p>
            </div>
          ) : (
            /* Normal chat view */
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
                {messages.map((message, index) => (
                  <ChatMessageBubble
                    key={message.id || index}
                    id={message.id || index}
                    role={message.role}
                    content={message.content}
                    createdAt={message.createdAt}
                    sources={message.sources}
                    onRecipeClick={handleRecipeClick}
                  />
                ))}

                {isTyping && (
                  <div className="flex justify-start mb-3 animate-fade-in">
                    <div className="flex gap-2.5 items-end">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700 shadow-sm">
                        <div className="flex gap-1.5 items-center">
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {error && (
                <div className="mx-3 mb-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded-lg border border-red-200 dark:border-red-800/50 flex-shrink-0 animate-fade-in">
                  {error}
                </div>
              )}

              <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={isTyping || isCreatingSession}
                  placeholder="Hỏi tôi về công thức nấu ăn..."
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBot;