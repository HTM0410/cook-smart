import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Sparkles } from 'lucide-react';
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

function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, blockIdx) => {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();

    if (/^\d+\.\s+/.test(firstLine)) {
      return (
        <ol key={blockIdx} className="list-decimal list-outside ml-5 space-y-1.5 my-2 marker:text-current marker:font-semibold">
          {lines.map((line, i) => {
            const m = line.match(/^\d+\.\s+(.*)/);
            return m ? <li key={i}>{renderInline(m[1])}</li> : null;
          })}
        </ol>
      );
    }

    if (/^[-*•]\s+/.test(firstLine)) {
      return (
        <ul key={blockIdx} className="list-disc list-outside ml-5 space-y-1.5 my-2 marker:text-current">
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
        level === 1 ? 'text-base font-bold mt-2 mb-1' :
        level === 2 ? 'text-sm font-bold mt-1.5 mb-1' :
                      'text-sm font-semibold mt-1 mb-0.5';
      return <p key={blockIdx} className={sizeClass}>{renderInline(content)}</p>;
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
        <strong key={key++} className="font-semibold">
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
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-ink-700/15 dark:bg-white/15 text-[0.85em] font-mono"
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
  const time = createdAt
    ? new Date(createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeFluid }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`flex gap-2.5 max-w-[92%] sm:max-w-[88%] ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ring-1 ${
            isUser
              ? 'bg-ink-700 dark:bg-paper-light text-paper-light dark:text-ink-700 ring-ink-700 dark:ring-paper-light'
              : 'bg-[#ff4f00] text-white ring-[#ff4f00]'
          }`}
          aria-hidden="true"
        >
          {isUser ? <User className="w-4 h-4" strokeWidth={1.5} /> : <Sparkles className="w-4 h-4" strokeWidth={1.5} />}
        </div>

        <div className={`flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`relative px-4 py-2.5 text-sm leading-relaxed break-words ${
              isUser
                ? 'bg-[#ff4f00] text-white rounded-2xl rounded-tr-md'
                : 'bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light rounded-2xl rounded-tl-md ring-1 ring-ink-200/40 dark:ring-ink-700/40'
            }`}
          >
            <div className={isUser ? 'whitespace-pre-wrap' : ''}>
              {isUser ? content : renderMarkdown(content)}
            </div>
          </div>

          {sources && sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 max-w-full">
              <span className="text-[10px] uppercase tracking-[0.15em] text-ink-muted font-semibold self-center mr-1">
                Nguồn
              </span>
              {sources.slice(0, 5).map((source, index) => (
                <button
                  key={`${source.recipeId}-${index}`}
                  onClick={() => onRecipeClick?.(source.recipeId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#EDF3EC] dark:bg-[#346538]/15 text-[#346538] rounded-full ring-1 ring-[#346538]/30 hover:ring-[#346538] transition-all duration-500 ease-[var(--ease-fluid)]"
                  title={source.content}
                >
                  <Bot className="w-3 h-3 flex-shrink-0" strokeWidth={1.5} />
                  <span className="truncate max-w-[140px]">{source.recipeName}</span>
                </button>
              ))}
            </div>
          )}

          {time && (
            <span className="text-[10px] uppercase tracking-[0.15em] text-ink-muted mt-1 px-1">
              {time}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ChatMessage;