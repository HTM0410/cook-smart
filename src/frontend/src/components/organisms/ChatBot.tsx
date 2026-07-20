import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import chatService, { ChatSession, ChatMessage } from '../../services/chatService';
import socketService from '../../services/socketService';
import ChatMessageBubble from '../molecules/ChatMessageBubble';
import ChatInput from '../molecules/ChatInput';
import ChatSessionList from '../molecules/ChatSessionList';
import { easeFluid } from '../../lib/motion';
import {
  MessageSquare,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  Sparkles,
  LogIn,
  Plus,
  ChefHat,
  ArrowDown,
} from 'lucide-react';

interface ChatBotProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialSessionId?: number;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 0,
  role: 'assistant',
  content:
    'Xin chào! Tôi là trợ lý nấu ăn của CookSmart. Bạn có thể hỏi tôi về công thức nấu ăn, nguyên liệu, hoặc gợi ý món ăn nhé!',
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
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollDown(!atBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-5 z-50 w-[420px] max-w-[calc(100vw-2.5rem)] h-[min(680px,calc(100vh-8rem))] origin-bottom-right animate-fade-in">
      {/* Bezel outer */}
      <div className="card-bezel h-full">
        <div className="card-bezel-inner p-0 h-full overflow-hidden flex flex-col">
          {/* Header - Editorial Luxury */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-br from-[#ff4f00] via-[#ff6f33] to-[#c72602] text-white flex-shrink-0 relative overflow-hidden">
            {/* Subtle ambient pattern */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 20% 0%, rgba(255,255,255,0.4) 0%, transparent 50%)',
              }}
            />
            <div className="flex items-center gap-3 min-w-0 relative">
              {/* Avatar with double-bezel ring */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]">
                  <Sparkles className="w-4 h-4" strokeWidth={1.5} />
                </div>
                {/* Online indicator */}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#34d399] rounded-full ring-2 ring-[#ff4f00]">
                  <span className="absolute inset-0 rounded-full bg-[#34d399] animate-ping opacity-75" />
                </span>
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-semibold text-[14.5px] leading-tight truncate">
                  CookSmart Assistant
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-white/90">
                  <span className="uppercase tracking-[0.18em] font-semibold">Trực tuyến</span>
                  <span className="w-0.5 h-0.5 rounded-full bg-white/50" />
                  <span className="uppercase tracking-[0.18em] font-medium opacity-85">
                    Powered by Gemini · RAG
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5 flex-shrink-0 relative">
              {user && (
                <button
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="p-2 rounded-full hover:bg-white/15 active:bg-white/25 transition-colors duration-500 ease-[var(--ease-fluid)]"
                  title={isSidebarOpen ? 'Ẩn danh sách' : 'Hiện danh sách'}
                  aria-label="Toggle sidebar"
                >
                  {isSidebarOpen ? (
                    <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />
                  ) : (
                    <PanelLeftOpen className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/15 active:bg-white/25 transition-colors duration-500 ease-[var(--ease-fluid)]"
                title="Đóng"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* Session sidebar */}
            <AnimatePresence initial={false}>
              {user && isSidebarOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 248, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.5, ease: easeFluid }}
                  className="flex-shrink-0 border-r border-ink-200/30 dark:border-ink-700/30 overflow-hidden bg-paper-light/40 dark:bg-ink-700/20"
                >
                  <ChatSessionList
                    sessions={sessions}
                    currentSessionId={currentSession?.id}
                    onSelectSession={handleSelectSession}
                    onDeleteSession={handleDeleteSession}
                    onNewChat={handleNewChat}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-w-0 bg-paper-light dark:bg-ink-800/30">
              {isLoadingSessions && !currentSession ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#ff4f00]/20 blur-xl rounded-full" />
                    <Loader2
                      className="relative w-8 h-8 animate-spin text-[#ff4f00]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className="text-ink-secondary text-sm mt-3">Đang tải cuộc trò chuyện...</p>
                </div>
              ) : !currentSession && !isLoading ? (
                /* Welcome screen - editorial */
                <div className="flex-1 flex flex-col items-center justify-center px-5 py-6 overflow-y-auto custom-scrollbar">
                  {/* Brand mark */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: easeFluid }}
                    className="relative mb-5"
                  >
                    <div className="absolute inset-0 bg-[#ff4f00]/25 blur-2xl rounded-full" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#ff4f00] via-[#ff6f33] to-[#c72602] flex items-center justify-center flex-shrink-0 shadow-[0_8px_24px_-6px_rgba(255,79,0,0.5)] ring-1 ring-white/20">
                      <ChefHat className="w-7 h-7 text-white" strokeWidth={1.5} />
                    </div>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: easeFluid, delay: 0.1 }}
                    className="text-[10px] uppercase tracking-[0.22em] font-semibold text-[#ff4f00] mb-2.5"
                  >
                    Trợ lý AI · Phiên bản 2.0
                  </motion.p>

                  <motion.h3
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: easeFluid, delay: 0.15 }}
                    className="font-serif italic text-[26px] leading-[1.15] tracking-editorial text-ink-primary dark:text-paper-light mb-2.5 text-center text-balance"
                  >
                    Xin chào, tôi có thể giúp gì?
                  </motion.h3>

                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: easeFluid, delay: 0.2 }}
                    className="text-[13px] text-ink-secondary text-center mb-6 max-w-[280px] text-pretty leading-relaxed"
                  >
                    Gợi ý công thức, hướng dẫn nấu ăn, hoặc tìm món phù hợp với nguyên liệu bạn có.
                  </motion.p>

                  {!user ? (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: easeFluid, delay: 0.25 }}
                      className="w-full max-w-[300px] flex flex-col items-center"
                    >
                      <div className="w-full p-3.5 rounded-2xl bg-[#FBF3DB] dark:bg-[#956400]/15 ring-1 ring-[#956400]/30 mb-4 flex items-start gap-2.5">
                        <LogIn
                          className="w-4 h-4 text-[#956400] flex-shrink-0 mt-0.5"
                          strokeWidth={1.5}
                        />
                        <p className="text-xs text-[#956400] leading-relaxed">
                          Đăng nhập để lưu lịch sử trò chuyện và đồng bộ giữa các thiết bị.
                        </p>
                      </div>
                      <div className="w-full space-y-2 mb-4">
                        {suggestions.slice(0, 3).map((suggestion, index) => (
                          <div
                            key={index}
                            className="w-full px-3.5 py-2.5 text-left rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 opacity-70"
                          >
                            <div className="flex items-center gap-2.5">
                              <MessageSquare
                                className="w-3.5 h-3.5 text-ink-muted flex-shrink-0"
                                strokeWidth={1.5}
                              />
                              <span className="text-xs text-ink-secondary truncate">
                                {suggestion}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleLoginPrompt}
                        className="btn-editorial-primary inline-flex"
                      >
                        <LogIn className="w-4 h-4" strokeWidth={1.5} />
                        Đăng nhập để bắt đầu
                      </button>
                    </motion.div>
                  ) : isCreatingSession ? (
                    <div className="flex items-center gap-2 text-ink-primary dark:text-paper-light">
                      <Loader2
                        className="w-5 h-5 animate-spin text-[#ff4f00]"
                        strokeWidth={1.5}
                      />
                      <span className="text-sm font-medium">Đang tạo cuộc trò chuyện...</span>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: easeFluid, delay: 0.25 }}
                      className="w-full max-w-[300px] flex flex-col items-center"
                    >
                      <div className="w-full space-y-2 mb-5">
                        {suggestions.slice(0, 3).map((suggestion, index) => (
                          <motion.button
                            key={index}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              duration: 0.5,
                              ease: easeFluid,
                              delay: 0.3 + index * 0.06,
                            }}
                            whileHover={{ scale: 1.01, x: 2 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handleSuggestionClick(suggestion)}
                            disabled={isCreatingSession}
                            className="group w-full px-3.5 py-2.5 text-left rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 hover:ring-[#ff4f00] hover:bg-[#fff4ed]/40 dark:hover:bg-[#ff4f00]/5 transition-all duration-500 ease-[var(--ease-fluid)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-2.5">
                              <MessageSquare
                                className="w-3.5 h-3.5 text-ink-muted group-hover:text-[#ff4f00] flex-shrink-0 transition-colors duration-500 ease-[var(--ease-fluid)]"
                                strokeWidth={1.5}
                              />
                              <span className="text-xs text-ink-primary dark:text-paper-light truncate">
                                {suggestion}
                              </span>
                              <svg
                                className="w-3 h-3 ml-auto text-ink-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-500 ease-[var(--ease-fluid)]"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M5 12h14" />
                                <path d="M13 5l7 7-7 7" />
                              </svg>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                      <button
                        onClick={handleNewChat}
                        disabled={isLoading || isCreatingSession}
                        className="btn-editorial-primary inline-flex disabled:opacity-50"
                      >
                        {(isLoading || isCreatingSession) ? (
                          <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
                        ) : (
                          <>
                            <Plus className="w-4 h-4" strokeWidth={1.5} />
                            <span>Bắt đầu cuộc trò chuyện</span>
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : isLoading && currentSession ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#ff4f00]/20 blur-xl rounded-full" />
                    <Loader2
                      className="relative w-8 h-8 animate-spin text-[#ff4f00]"
                      strokeWidth={1.5}
                    />
                  </div>
                  <p className="text-ink-secondary text-sm mt-3">Đang tải tin nhắn...</p>
                </div>
              ) : (
                <>
                  <div
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto px-3.5 py-4 custom-scrollbar"
                  >
                    {/* Date divider */}
                    <div className="flex items-center gap-3 mb-4 px-1">
                      <span className="flex-1 h-px bg-ink-200/40 dark:bg-ink-700/40" />
                      <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-muted">
                        Hôm nay
                      </span>
                      <span className="flex-1 h-px bg-ink-200/40 dark:bg-ink-700/40" />
                    </div>

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

                    <AnimatePresence>
                      {isTyping && (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.4, ease: easeFluid }}
                          className="flex justify-start mb-4"
                        >
                          <div className="flex gap-2.5 items-end">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff4f00] to-[#c72602] flex items-center justify-center flex-shrink-0 shadow-[0_4px_14px_-4px_rgba(255,79,0,0.4)]">
                              <Sparkles
                                className="w-3.5 h-3.5 text-white"
                                strokeWidth={1.5}
                              />
                            </div>
                            <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 shadow-soft">
                              <div className="flex gap-1.5 items-center">
                                <span className="w-1.5 h-1.5 bg-[#ff4f00] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-[#ff4f00] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-[#ff4f00] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Scroll to bottom button */}
                  <AnimatePresence>
                    {showScrollDown && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8, y: 8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 8 }}
                        transition={{ duration: 0.3, ease: easeFluid }}
                        onClick={scrollToBottom}
                        className="absolute bottom-[120px] right-5 w-8 h-8 rounded-full bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/60 dark:ring-ink-700/60 shadow-soft flex items-center justify-center text-ink-secondary hover:text-[#ff4f00] transition-colors"
                        title="Cuộn xuống"
                      >
                        <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
                      </motion.button>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4, ease: easeFluid }}
                        className="mx-3.5 mb-2 px-3.5 py-2.5 bg-[#FDEBEC] dark:bg-[#9F2F2D]/20 text-[#9F2F2D] text-xs rounded-2xl ring-1 ring-[#9F2F2D]/30 flex-shrink-0 flex items-center gap-2"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[#9F2F2D] flex-shrink-0" />
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex-shrink-0 border-t border-ink-200/30 dark:border-ink-700/30 bg-paper-light dark:bg-ink-700/30">
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
      </div>
    </div>
  );
};

export default ChatBot;
