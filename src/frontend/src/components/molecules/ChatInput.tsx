import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Smile, Paperclip, X, Mic, Sparkles } from 'lucide-react';
import { easeFluid } from '../../lib/motion';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onUploadImage?: (file: File) => void;
}

const EMOJI_LIST = [
  '🍜', '🍲', '🍛', '🍗', '🥗', '🍕', '🍔', '🌮', '🥘', '🍱',
  '🥩', '🍳', '🥟', '🍤', '🥡', '🍝', '🍣', '🥐', '🍰', '🍵',
  '😋', '🤤', '😍', '🥰', '😎', '🤔', '👍', '❤️', '🔥',
  '⭐', '💡', '✅', '🎉', '👏', '💪', '🍴',
  '🥄', '🧂', '🥕', '🌶️', '🧄', '🧅', '🧀', '🥛', '🍋',
];

const QUICK_PROMPTS = [
  { icon: '🍳', label: 'Món sáng nhanh' },
  { icon: '🥗', label: 'Salad healthy' },
  { icon: '🍰', label: 'Tráng miệng' },
];

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Nhập tin nhắn...',
  onUploadImage,
}) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((message.trim() || attachedImage) && !disabled) {
      if (attachedImage && onUploadImage) {
        fetch(attachedImage)
          .then((res) => res.blob())
          .then((blob) => {
            const file = new File([blob], 'upload.jpg', { type: blob.type });
            onUploadImage(file);
          })
          .catch(() => {});
      }
      if (message.trim()) {
        onSendMessage(message.trim());
      }
      setMessage('');
      setAttachedImage(null);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 150) + 'px';
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAttachedImage(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickPrompt = (label: string) => {
    onSendMessage(`Gợi ý cho tôi món: ${label}`);
  };

  const canSend = (message.trim().length > 0 || attachedImage) && !disabled;

  return (
    <form onSubmit={handleSubmit} className="relative p-3.5">
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            ref={emojiRef}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.3, ease: easeFluid }}
            className="absolute bottom-full left-3.5 mb-2 z-50 w-72 bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 rounded-2xl p-3 shadow-ambient"
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">
                Biểu tượng cảm xúc
              </span>
              <button
                type="button"
                onClick={() => setShowEmojiPicker(false)}
                className="p-1 hover:bg-paper-light dark:hover:bg-ink-700 rounded-full transition-colors duration-500 ease-[var(--ease-fluid)]"
              >
                <X className="w-4 h-4 text-ink-secondary" strokeWidth={1.5} />
              </button>
            </div>
            <div className="grid grid-cols-9 gap-1 max-h-48 overflow-y-auto custom-scrollbar">
              {EMOJI_LIST.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-lg hover:bg-paper-light dark:hover:bg-ink-700 rounded-full transition-all duration-500 ease-[var(--ease-fluid)] hover:scale-110"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {attachedImage && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.4, ease: easeFluid }}
            className="absolute bottom-full left-3.5 mb-2"
          >
            <div className="relative p-1 rounded-2xl bg-[rgba(0,0,0,0.04)] dark:bg-[rgba(255,255,255,0.04)] ring-1 ring-ink-200/40 dark:ring-ink-700/40">
              <div className="p-1.5 rounded-[calc(1rem-0.375rem)] bg-paper-light dark:bg-ink-700">
                <img
                  src={attachedImage}
                  alt="Attached"
                  className="w-20 h-20 object-cover rounded-xl"
                />
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-[#9F2F2D] text-white rounded-full flex items-center justify-center ring-2 ring-paper-light dark:ring-ink-700 hover:scale-110 transition-transform duration-500 ease-[var(--ease-fluid)]"
              >
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Double-bezel input container */}
      <div
        className={`relative rounded-2xl p-[1.5px] transition-all duration-500 ease-[var(--ease-fluid)] ${
          isFocused
            ? 'bg-gradient-to-br from-[#ff4f00]/60 via-[#ff4f00]/30 to-[#ff4f00]/60'
            : 'bg-[rgba(0,0,0,0.05)] dark:bg-[rgba(255,255,255,0.05)]'
        }`}
      >
        <div className="rounded-[calc(1rem-0.09rem)] bg-paper-light dark:bg-ink-700 px-1.5 py-1.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_0_rgba(0,0,0,0.02)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
          <div className="flex items-end gap-2">
            {/* Action buttons (left) */}
            <div className="flex items-center gap-0.5 flex-shrink-0 pb-1.5">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className={`p-2 rounded-full transition-all duration-500 ease-[var(--ease-fluid)] ${
                  showEmojiPicker
                    ? 'text-[#ff4f00] bg-[#fff4ed] dark:bg-[#ff4f00]/15'
                    : 'text-ink-muted hover:text-[#ff4f00] hover:bg-[#fff4ed] dark:hover:bg-[#ff4f00]/15'
                }`}
                title="Biểu tượng cảm xúc"
              >
                <Smile className="w-4 h-4" strokeWidth={1.5} />
              </button>
              {onUploadImage && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-ink-muted hover:text-[#ff4f00] hover:bg-[#fff4ed] dark:hover:bg-[#ff4f00]/15 rounded-full transition-all duration-500 ease-[var(--ease-fluid)]"
                  title="Đính kèm hình ảnh"
                >
                  <Paperclip className="w-4 h-4" strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="flex-1 px-2 py-2.5 bg-transparent text-ink-primary dark:text-paper-light placeholder-ink-muted text-[13.5px] leading-relaxed resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '40px', maxHeight: '150px' }}
            />

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={!canSend}
              whileHover={canSend ? { scale: 1.05 } : {}}
              whileTap={canSend ? { scale: 0.92 } : {}}
              transition={{ duration: 0.4, ease: easeFluid }}
              className={`flex-shrink-0 mb-0.5 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ease-[var(--ease-fluid)] ${
                canSend
                  ? 'bg-gradient-to-br from-[#ff4f00] to-[#c72602] text-white shadow-[0_4px_14px_-4px_rgba(255,79,0,0.5)]'
                  : 'bg-paper-light dark:bg-ink-700 text-ink-muted cursor-not-allowed ring-1 ring-ink-200/40 dark:ring-ink-700/40'
              }`}
            >
              {disabled ? (
                <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <Send className="w-4 h-4" strokeWidth={1.8} />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Quick prompts + hint */}
      <div className="mt-2.5 flex items-center gap-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ink-muted flex items-center gap-1 flex-shrink-0">
          <Sparkles className="w-2.5 h-2.5" strokeWidth={1.5} />
          Gợi ý
        </span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => handleQuickPrompt(p.label)}
              disabled={disabled}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-secondary hover:text-[#ff4f00] hover:ring-[#ff4f00]/40 transition-all duration-500 ease-[var(--ease-fluid)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="text-[12px]">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
};

export default ChatInput;
