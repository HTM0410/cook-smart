import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import chatService, { ChatSession, ChatMessage } from '../../services/chatService';
import socketService from '../../services/socketService';
import ChatMessageBubble from '../molecules/ChatMessageBubble';
import ChatInput from '../molecules/ChatInput';
import ChatSessionList from '../molecules/ChatSessionList';
import { MessageSquare, X, ChevronLeft, Loader2, Bot, Sparkles } from 'lucide-react';

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const reconnectAttempts = useRef(0);

  // Load sessions and suggestions when user logs in
  useEffect(() => {
    if (user) {
      loadSessions();
      loadSuggestions();
    } else {
      // Reset state when logged out
      setSessions([]);
      setCurrentSession(null);
      setMessages([]);
      setSuggestions([]);
    }
  }, [user]);

  const cleanupSocket = useRef<(() => void) | null>(null);

  // Load messages when session changes, but NOT on mount
  useEffect(() => {
    if (user && currentSession) {
      loadMessages(currentSession.id);
      // Connect socket after session is set
      const cleanup = setupSocket(currentSession.id);
      cleanupSocket.current = cleanup;
      reconnectAttempts.current = 0;
    } else {
      // Cleanup when no session
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    // Return cleanup function
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
      // Show welcome message on error
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

    let sessionId = currentSession?.id;

    // If no current session, create one first
    if (!sessionId) {
      setIsLoading(true);
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
        setIsLoading(false);
        return;
      } finally {
        setIsLoading(false);
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

    // Send via socket for real-time (if connected)
    socketService.sendMessage(sessionId, content);

    // Also send via REST as fallback
    try {
      await chatService.sendMessage(sessionId, content);
    } catch (err) {
      console.error('Failed to save message via REST:', err);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleRecipeClick = (recipeId: number) => {
    onClose?.();
    navigate(`/recipes/${recipeId}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 z-50 w-96 h-[600px] max-h-[calc(100vh-120px)] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border dark:border-gray-700 animate-scale-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary-500 to-amber-500 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold">CookSmart Assistant</h2>
            <p className="text-xs text-white/80">Powered by AI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            title={isExpanded ? 'Thu nhỏ' : 'Phóng to'}
          >
            {isExpanded ? <ChevronLeft className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Session sidebar */}
        {(isExpanded || currentSession) && (
          <div className={`${isExpanded ? 'w-64 flex-shrink-0' : 'hidden'} border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-y-auto`}>
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
        <div className="flex-1 flex flex-col min-w-0">
          {/* Loading sessions — show full screen loader */}
          {isLoadingSessions && !currentSession ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Đang tải cuộc trò chuyện...</p>
            </div>
          ) : !currentSession && !isLoading ? (
            /* Welcome screen — always show start options */
            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-amber-500 flex items-center justify-center mb-3 shadow-lg flex-shrink-0">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2 text-center">
                Xin chào! Tôi có thể giúp gì?
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
                Tôi có thể gợi ý công thức nấu ăn, trả lời câu hỏi về nguyên liệu, và nhiều hơn nữa.
              </p>
              <div className="w-full space-y-2 max-h-40 overflow-y-auto pr-1">
                {suggestions.slice(0, 3).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-3 py-2.5 text-left rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-primary-500 flex-shrink-0" />
                      <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{suggestion}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={handleNewChat}
                disabled={isLoading}
                className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary-500 to-amber-500 text-white font-medium hover:shadow-lg transition-all active:scale-95 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Dang tao...
                  </>
                ) : (
                  'Bat dau cuoc tro chuyen moi'
                )}
              </button>
            </div>
          ) : isLoading && currentSession ? (
            /* Loading messages for a session */
            <div className="flex-1 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary-500 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Đang tải tin nhắn...</p>
            </div>
          ) : (
            /* Normal chat view */
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={message.id || index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="w-full max-w-[85%]">
                      <ChatMessageBubble
                        id={message.id || index}
                        role={message.role}
                        content={message.content}
                        createdAt={message.createdAt}
                        sources={message.sources}
                        onRecipeClick={handleRecipeClick}
                      />
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="px-3 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {error && (
                <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm flex-shrink-0">
                  {error}
                </div>
              )}

              <div className="flex-shrink-0 border-t dark:border-gray-700 p-3">
                <ChatInput
                  onSendMessage={handleSendMessage}
                  disabled={isTyping}
                  placeholder="Hoi toi ve cong thuc nau an..."
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
