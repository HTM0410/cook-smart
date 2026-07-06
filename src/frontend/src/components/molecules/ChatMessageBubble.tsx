import React from 'react';
import { Bot, User, Sparkles } from 'lucide-react';

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

/**
 * Mini markdown renderer — không cần thêm dependency.
 * Hỗ trợ:
 *   - **bold**        → <strong>
 *   - *italic*        → <em>
 *   - `code`          → <code>
 *   - Dòng bắt đầu bằng "- " hoặc "* " hoặc "1. " → <ul>/<ol>
 *   - Xuống dòng đôi → <p>
 *   - Xuống dòng đơn → <br>
 */
function renderMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, blockIdx) => {
    const lines = block.split('\n');
    const firstLine = lines[0].trim();

    // Ordered list: "1. ", "2. ", ...
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

    // Unordered list: "- ", "* ", "• "
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

    // Heading: "## ..." → bold larger
    if (/^#{1,3}\s+/.test(firstLine)) {
      const level = firstLine.match(/^(#{1,3})/)?.[1].length ?? 1;
      const content = firstLine.replace(/^#{1,3}\s+/, '');
      const sizeClass =
        level === 1 ? 'text-base font-bold mt-2 mb-1' :
        level === 2 ? 'text-sm font-bold mt-1.5 mb-1' :
                      'text-sm font-semibold mt-1 mb-0.5';
      return <p key={blockIdx} className={sizeClass}>{renderInline(content)}</p>;
    }

    // Plain paragraph: preserve single line breaks with <br/>
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

/** Render inline markdown: **bold**, *italic*, `code` */
function renderInline(text: string): React.ReactNode {
  // Split keeping delimiters using a single regex pass
  // Pattern order matters: bold (**) before italic (*)
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
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-black/10 dark:bg-white/15 text-[0.85em] font-mono"
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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 animate-fade-in`}>
      <div
        className={`flex gap-2.5 max-w-[92%] sm:max-w-[88%] ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Avatar - compact, aligned to first line */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm ${
            isUser
              ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white'
              : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
          }`}
          aria-hidden="true"
        >
          {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>

        {/* Message column */}
        <div className={`flex flex-col min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
          {/* Bubble */}
          <div
            className={`relative px-4 py-2.5 text-sm leading-relaxed break-words ${
              isUser
                ? 'bg-gradient-to-br from-orange-500 to-rose-500 text-white rounded-2xl rounded-tr-md shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-2xl rounded-tl-md border border-gray-200/80 dark:border-gray-700 shadow-sm'
            }`}
          >
            <div className={isUser ? 'whitespace-pre-wrap' : ''}>
              {isUser ? content : renderMarkdown(content)}
            </div>
          </div>

          {/* Sources as inline chips below bubble */}
          {sources && sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 max-w-full">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold self-center mr-1">
                Nguồn
              </span>
              {sources.slice(0, 5).map((source, index) => (
                <button
                  key={`${source.recipeId}-${index}`}
                  onClick={() => onRecipeClick?.(source.recipeId)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/60 dark:border-emerald-800/40 transition-colors"
                  title={source.content}
                >
                  <Bot className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate max-w-[140px]">{source.recipeName}</span>
                </button>
              ))}
            </div>
          )}

          {/* Timestamp */}
          {time && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
              {time}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;