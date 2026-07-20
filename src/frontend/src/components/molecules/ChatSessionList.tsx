import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatSession } from '../../services/chatService';
import { Plus, Trash2, MessageSquare, Search, X } from 'lucide-react';
import { easeFluid } from '../../lib/motion';

interface ChatSessionListProps {
  sessions: ChatSession[];
  currentSessionId?: number;
  onSelectSession: (sessionId: number) => void;
  onDeleteSession: (sessionId: number) => void;
  onNewChat: () => void;
}

type SessionGroup = {
  label: string;
  items: ChatSession[];
};

const ChatSessionList: React.FC<ChatSessionListProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  onNewChat,
}) => {
  const [query, setQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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

  const groups = useMemo<SessionGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? sessions.filter(
          (s) =>
            (s.sessionTitle || '').toLowerCase().includes(q) ||
            (s.preview || '').toLowerCase().includes(q)
        )
      : sessions;

    const buckets: Record<string, ChatSession[]> = {};
    filtered.forEach((s) => {
      const key = formatDate(s.updatedAt || s.createdAt);
      if (!buckets[key]) buckets[key] = [];
      buckets[key].push(s);
    });

    return Object.entries(buckets).map(([label, items]) => ({ label, items }));
  }, [sessions, query]);

  return (
    <div className="flex flex-col h-full">
      {/* New chat CTA */}
      <div className="px-3.5 pt-3.5 pb-3">
        <button
          onClick={onNewChat}
          className="group relative w-full inline-flex items-center justify-between gap-2 bg-ink-700 dark:bg-paper-light text-paper-light dark:text-ink-700 rounded-full pl-5 pr-2 py-2 font-medium tracking-tight shadow-soft transition-all duration-700 ease-[var(--ease-fluid)] hover:scale-[1.01] active:scale-[0.99]"
        >
          <span className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-full bg-white/15 dark:bg-ink-700/15 flex items-center justify-center transition-transform duration-700 ease-[var(--ease-fluid)] group-hover:rotate-90">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.8} />
            </span>
            <span className="text-xs uppercase tracking-[0.18em] font-semibold">Cuộc trò chuyện mới</span>
          </span>
          <span className="w-7 h-7 rounded-full bg-white/10 dark:bg-ink-700/10 flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="M13 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      </div>

      {/* Search */}
      {sessions.length > 3 && (
        <div className="px-3.5 pb-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm trong các cuộc trò chuyện..."
              className="w-full pl-9 pr-9 py-2 text-xs rounded-full bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light placeholder-ink-muted focus:outline-none focus:ring-[#ff4f00] transition-all duration-500 ease-[var(--ease-fluid)]"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-ink-muted hover:text-ink-primary dark:hover:text-paper-light hover:bg-paper-light dark:hover:bg-ink-800 transition-colors"
              >
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 pb-3 custom-scrollbar">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="w-12 h-12 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-ink-muted opacity-60" strokeWidth={1.5} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-secondary">
              Chưa có cuộc trò chuyện
            </p>
            <p className="text-[11px] mt-1.5 text-ink-muted max-w-[180px]">
              Nhấn nút phía trên để bắt đầu cuộc trò chuyện đầu tiên của bạn.
            </p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-ink-muted">Không tìm thấy kết quả cho &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 px-2 mb-2">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-ink-muted">
                    {group.label}
                  </span>
                  <span className="flex-1 h-px bg-ink-200/30 dark:bg-ink-700/30" />
                  <span className="text-[10px] text-ink-muted font-mono">{group.items.length}</span>
                </div>
                <div className="space-y-1">
                  <AnimatePresence initial={false}>
                    {group.items.map((session) => {
                      const isActive = currentSessionId === session.id;
                      const isConfirming = confirmDeleteId === session.id;
                      return (
                        <motion.div
                          key={session.id}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.4, ease: easeFluid }}
                          className={`group relative rounded-2xl transition-all duration-500 ease-[var(--ease-fluid)] ${
                            isActive
                              ? 'bg-paper-light dark:bg-ink-700 ring-1 ring-[#ff4f00]/40 shadow-soft'
                              : 'hover:bg-paper-light/60 dark:hover:bg-ink-700/40 ring-1 ring-transparent hover:ring-ink-200/40 dark:hover:ring-ink-700/40'
                          }`}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 w-1 h-7 rounded-full bg-[#ff4f00]" />
                          )}
                          <button
                            onClick={() => onSelectSession(session.id)}
                            className="w-full p-2.5 text-left pl-3"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f00] animate-pulse flex-shrink-0" />
                              )}
                              <h3
                                className={`text-[13px] font-medium leading-snug line-clamp-2 ${
                                  isActive
                                    ? 'text-ink-primary dark:text-paper-light'
                                    : 'text-ink-secondary dark:text-ink-200 group-hover:text-ink-primary dark:group-hover:text-paper-light'
                                }`}
                              >
                                {session.sessionTitle || 'Cuộc trò chuyện'}
                              </h3>
                            </div>
                            {session.preview && (
                              <p className="text-[11px] text-ink-muted truncate mt-0.5 pl-3.5">
                                {session.preview}
                              </p>
                            )}
                          </button>

                          <AnimatePresence>
                            {isConfirming ? (
                              <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.92 }}
                                transition={{ duration: 0.3, ease: easeFluid }}
                                className="absolute inset-0 rounded-2xl bg-[#FDEBEC] dark:bg-[#9F2F2D]/15 ring-1 ring-[#9F2F2D]/40 flex items-center justify-between px-3"
                              >
                                <span className="text-[11px] font-semibold text-[#9F2F2D]">
                                  Xóa cuộc trò chuyện?
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteSession(session.id);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#9F2F2D] rounded-full hover:bg-[#8a2926] transition-colors"
                                  >
                                    Xóa
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2.5 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light rounded-full transition-colors"
                                  >
                                    Huỷ
                                  </button>
                                </div>
                              </motion.div>
                            ) : (
                              <motion.button
                                key="delete"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmDeleteId(session.id);
                                }}
                                className="absolute top-2 right-2 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-[#FDEBEC] dark:hover:bg-[#9F2F2D]/20 text-ink-muted hover:text-[#9F2F2D] transition-all duration-500 ease-[var(--ease-fluid)]"
                                aria-label="Xóa cuộc trò chuyện"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                              </motion.button>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3.5 py-3 border-t border-ink-200/30 dark:border-ink-700/30">
        <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted text-center">
          {sessions.length} cuộc trò chuyện
        </p>
      </div>
    </div>
  );
};

export default ChatSessionList;
