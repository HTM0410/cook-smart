import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Loader2, Smile, Paperclip, X } from 'lucide-react';
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

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  placeholder = 'Nhập tin nhắn...',
  onUploadImage,
}) => {
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
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
          .then(res => res.blob())
          .then(blob => {
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
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + 'px';
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
            className="absolute bottom-full left-3.5 mb-2 z-50 w-72 bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 rounded-2xl p-3"
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
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-3.5 mb-2 flex items-center gap-2"
          >
            <div className="relative">
              <img src={attachedImage} alt="Attached" className="w-16 h-16 object-cover rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40" />
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-[#9F2F2D] text-white rounded-full flex items-center justify-center ring-1 ring-white hover:scale-110 transition-transform duration-500 ease-[var(--ease-fluid)]"
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

      <div className="flex items-end gap-2.5">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-3 pr-24 rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light placeholder-ink-muted resize-none focus:outline-none focus:ring-2 focus:ring-[#ff4f00] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-500 ease-[var(--ease-fluid)] text-sm"
            style={{ minHeight: '44px', maxHeight: '150px' }}
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-ink-muted hover:text-[#ff4f00] hover:bg-[#fff4ed] dark:hover:bg-[#ff4f00]/15 rounded-full transition-all duration-500 ease-[var(--ease-fluid)]"
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
        </div>

        <motion.button
          type="submit"
          disabled={!canSend}
          whileHover={canSend ? { scale: 1.05 } : {}}
          whileTap={canSend ? { scale: 0.95 } : {}}
          className={`flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-500 ease-[var(--ease-fluid)] ${
            canSend
              ? 'bg-[#ff4f00] text-white'
              : 'bg-paper-light dark:bg-ink-700 text-ink-muted cursor-not-allowed ring-1 ring-ink-200/40 dark:ring-ink-700/40'
          }`}
        >
          {disabled ? (
            <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.5} />
          ) : (
            <Send className="w-4 h-4" strokeWidth={1.5} />
          )}
        </motion.button>
      </div>
    </form>
  );
};

export default ChatInput;