import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, User, ChefHat, Copy, Check, ThumbsUp, ThumbsDown, RotateCw } from 'lucide-react';
import { easeFluid } from '../../lib/motion';

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

const formatTime = (dateString?: string) => {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFullTime = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
};

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, blockIdx) => {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();

    if (/^\d+\.\s+/.test(firstLine)) {
      return (
        <ol
          key={blockIdx}
          className="list-decimal list-outside ml-5 space-y-1.5 my-2 marker:text-[#ff4f00] marker:font-semibold marker:text-[13px]"
        >
          {lines.map((line, i) => {
            const m = line.match(/^\d+\.\s+(.*)/);
            return m ? <li key={i}>{renderInline(m[1])}</li> : null;
          })}
        </ol>
      );
    }

    if (/^[-*•]\s+/.test(firstLine)) {
      return (
        <ul
          key={blockIdx}
          className="list-disc list-outside ml-5 space-y-1.5 my-2 marker:text-[#ff4f00] marker:text-[10px]"
        >
          {lines.map((line, i) => {
            const m = line.match(/^[-*•]\s+(.*)/);
            return m ? <li key={i}>{renderInline(m[1])}</li> : null;
          })}
        </ul>
      );
    }

    if (/^#{1,3}\s+/.test(firstLine)) {
      const level = firstLine.match(/^(#{1,3})/)?.[1].length ?? 1;
      const content = firstLine.replace(/^#{1,3}\s+/, '');
      const sizeClass =
        level === 1
          ? 'text-base font-bold mt-2.5 mb-1.5 text-ink-primary dark:text-paper-light'
          : level === 2
          ? 'text-sm font-bold mt-2 mb-1 text-ink-primary dark:text-paper-light'
          : 'text-sm font-semibold mt-1.5 mb-0.5';
      return (
        <p key={blockIdx} className={sizeClass}>
          {renderInline(content)}
        </p>
      );
    }

    return (
      <p key={blockIdx} className="my-1.5 leading-relaxed">
        {lines.map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {renderInline(line)}
          </React.Fragment>
        ))}
      </p>
    );
  });
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-ink-primary dark:text-paper-light">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*')) {
      parts.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-ink-700/10 dark:bg-white/10 text-[0.85em] font-mono text-ink-primary dark:text-paper-light"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

const ChatMessage: React.FC<ChatMessageProps> = ({
  role,
  content,
  createdAt,
  sources,
  onRecipeClick,
}) => {
  const isUser = role === 'user';
  const time = formatTime(createdAt);
  const fullTime = formatFullTime(createdAt);
  const [copied, setCopied] = React.useState(false);
  const [feedback, setFeedback] = React.useState<'up' | 'down' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeFluid }}
      className={`group/msg flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`flex gap-2.5 max-w-[94%] sm:max-w-[88%] ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Avatar */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center ring-1 transition-all duration-500 ease-[var(--ease-fluid)] ${
              isUser
                ? 'bg-ink-700 dark:bg-paper-light text-paper-light dark:text-ink-700 ring-ink-700 dark:ring-paper-light'
                : 'bg-gradient-to-br from-[#ff4f00] to-[#c72602] text-white ring-[#ff4f00]/40 shadow-[0_4px_14px_-4px_rgba(255,79,0,0.4)]'
            }`}
            aria-hidden="true"
          >
            {isUser ? (
              <User className="w-3.5 h-3.5" strokeWidth={1.5} />
            ) : (
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />
            )}
          </div>
        </div>

        <div className={`flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Name + time */}
          <div
            className={`flex items-center gap-2 mb-1 px-1 text-[10px] uppercase tracking-[0.18em] font-semibold ${
              isUser ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            <span className={isUser ? 'text-ink-primary dark:text-paper-light' : 'text-[#ff4f00]'}>
              {isUser ? 'Bạn' : 'CookSmart'}
            </span>
            {fullTime && (
              <span className="text-ink-muted font-mono normal-case tracking-normal text-[10px]">
                · {fullTime}
              </span>
            )}
          </div>

          {/* Bubble */}
          <div
            className={`relative ${
              isUser
                ? 'px-4 py-2.5 rounded-2xl rounded-tr-md bg-ink-700 dark:bg-paper-light text-paper-light dark:text-ink-700 shadow-soft'
                : 'px-4 py-3 rounded-2xl rounded-tl-md bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light ring-1 ring-ink-200/40 dark:ring-ink-700/40 shadow-soft'
            }`}
          >
            <div className="text-[13.5px] leading-[1.65]">
              {isUser ? (
                <span className="whitespace-pre-wrap">{content}</span>
              ) : (
                renderMarkdown(content)
              )}
            </div>
          </div>

          {/* Sources panel */}
          {sources && sources.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeFluid, delay: 0.1 }}
              className="mt-2 max-w-full"
            >
              <div className="flex items-center gap-2 mb-1.5 px-1">
                <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-muted">
                  Nguồn tham khảo
                </span>
                <span className="flex-1 h-px bg-ink-200/30 dark:bg-ink-700/30" />
                <span className="text-[10px] text-ink-muted font-mono">{sources.length}</span>
              </div>
              <div className="flex flex-col gap-1">
                {sources.slice(0, 4).map((source, index) => (
                  <button
                    key={`${source.recipeId}-${index}`}
                    onClick={() => onRecipeClick?.(source.recipeId)}
                    className="group/src inline-flex items-center gap-2 px-2.5 py-1.5 text-xs text-left bg-[#EDF3EC] dark:bg-[#346538]/15 text-[#346538] dark:text-[#7ea37f] rounded-xl ring-1 ring-[#346538]/20 hover:ring-[#346538]/60 hover:bg-[#dfeedd] dark:hover:bg-[#346538]/25 transition-all duration-500 ease-[var(--ease-fluid)]"
                    title={source.content}
                  >
                    <ChefHat
                      className="w-3 h-3 flex-shrink-0 text-[#346538]/70"
                      strokeWidth={1.5}
                    />
                    <span className="font-medium truncate max-w-[180px]">{source.recipeName}</span>
                    <span className="flex-shrink-0 text-[10px] text-[#346538]/60 font-mono">
                      {Math.round(source.similarity * 100)}%
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Action bar - only for assistant, on hover */}
          {!isUser && (
            <div className="flex items-center gap-0.5 mt-1.5 px-1 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-500 ease-[var(--ease-fluid)]">
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-full hover:bg-paper-light dark:hover:bg-ink-700 text-ink-muted hover:text-ink-primary dark:hover:text-paper-light transition-colors"
                title="Sao chép"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-[#346538]" strokeWidth={2} />
                ) : (
                  <Copy className="w-3 h-3" strokeWidth={1.5} />
                )}
              </button>
              <button
                onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                className={`p-1.5 rounded-full hover:bg-paper-light dark:hover:bg-ink-700 transition-colors ${
                  feedback === 'up' ? 'text-[#346538]' : 'text-ink-muted hover:text-ink-primary'
                }`}
                title="Hữu ích"
              >
                <ThumbsUp className="w-3 h-3" strokeWidth={1.5} />
              </button>
              <button
                onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                className={`p-1.5 rounded-full hover:bg-paper-light dark:hover:bg-ink-700 transition-colors ${
                  feedback === 'down' ? 'text-[#9F2F2D]' : 'text-ink-muted hover:text-ink-primary'
                }`}
                title="Chưa tốt"
              >
                <ThumbsDown className="w-3 h-3" strokeWidth={1.5} />
              </button>
              <button
                className="p-1.5 rounded-full hover:bg-paper-light dark:hover:bg-ink-700 text-ink-muted hover:text-ink-primary dark:hover:text-paper-light transition-colors"
                title="Tạo lại"
              >
                <RotateCw className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;
