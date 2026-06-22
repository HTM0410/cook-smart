import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Smile, Paperclip, X } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onUploadImage?: (file: File) => void;
}

// Common Vietnamese food emojis + general emojis
const EMOJI_LIST = [
  '🍜', '🍲', '🍛', '🍗', '🥗', '🍕', '🍔', '🌮', '🥘', '🍱',
  '🥩', '🍳', '🥟', '🍤', '🥡', '🍝', '🍣', '🥐', '🍰', '🍵',
  '😋', '🤤', '😍', '🥰', '😎', '🤔', '👍', '👎', '❤️', '🔥',
  '⭐', '🌟', '💡', '✅', '❌', '⚠️', '🎉', '👏', '💪', '🍴',
  '🥄', '🍳', '🧂', '🥕', '🌶️', '🧄', '🧅', '🧀', '🥛', '🍋',
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

  // Close emoji picker on outside click
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
        // Convert data URL to File-like object via fetch
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
    <form onSubmit={handleSubmit} className="flex items-end gap-3 p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-800 relative">
      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div
          ref={emojiRef}
          className="absolute bottom-full left-4 mb-2 z-50 w-72 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-2xl p-3 animate-fade-in"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Biểu tượng cảm xúc</span>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto custom-scrollbar">
            {EMOJI_LIST.map((emoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleEmojiSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center text-lg hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-all hover:scale-110"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attached image preview */}
      {attachedImage && (
        <div className="absolute bottom-full left-4 mb-2 flex items-center gap-2 animate-fade-in">
          <div className="relative">
            <img src={attachedImage} alt="Attached" className="w-16 h-16 object-cover rounded-xl shadow-md" />
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Input area */}
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full px-4 py-3 pr-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          style={{ minHeight: '48px', maxHeight: '150px' }}
        />

        {/* Action buttons inside input */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
            title="Biểu tượng cảm xúc"
          >
            <Smile className="w-5 h-5" />
          </button>
          {onUploadImage && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
              title="Đính kèm hình ảnh"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSend}
        className={
          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 " +
          (canSend
            ? "bg-gradient-to-br from-orange-500 to-red-500 text-white hover:shadow-lg hover:shadow-orange-500/25 hover:scale-105 active:scale-95"
            : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed")
        }
      >
        {disabled ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Send className="w-5 h-5" />
        )}
      </button>
    </form>
  );
};

export default ChatInput;
