import React, { useState } from 'react';
import { Share2, X, Facebook, Twitter, MessageCircle, Send, Mail, Link2, Check } from 'lucide-react';
import showToast from '../../utils/toast';

interface RecipeShareButtonProps {
  recipeId: number;
  recipeName: string;
  recipeDescription?: string;
  recipeImage?: string;
  className?: string;
}

const RecipeShareButton: React.FC<RecipeShareButtonProps> = ({
  recipeId,
  recipeName,
  recipeDescription,
  recipeImage: _recipeImage,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/recipes/${recipeId}`;
  };

  const getShareText = () => {
    return `Xem công thức "${recipeName}" trên CookSmart!`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      showToast.success('Đã sao chép link!');
      setTimeout(() => setCopied(false), 2000);
      
      // Track analytics
      trackShare('copy_link');
    } catch (err) {
      showToast.error('Không thể sao chép link');
    }
  };

  const trackShare = async (platform: string) => {
    // Track share event for analytics
    if (window.gtag) {
      window.gtag('event', 'share', {
        method: platform,
        content_type: 'recipe',
        content_id: recipeId,
        item_id: recipeId,
      });
    }
    
    // Send to backend analytics
    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3000/api/share/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          recipeId,
          platform,
        }),
      });
    } catch (error) {
      console.error('Failed to track share:', error);
    }
    
    console.log(`📊 Share tracked: ${platform} - Recipe ${recipeId}`);
  };

  const shareViaFacebook = () => {
    const url = encodeURIComponent(getShareUrl());
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      '_blank',
      'width=600,height=400'
    );
    trackShare('facebook');
    setIsOpen(false);
  };

  const shareViaTwitter = () => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    window.open(
      `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      '_blank',
      'width=600,height=400'
    );
    trackShare('twitter');
    setIsOpen(false);
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`${getShareText()} ${getShareUrl()}`);
    window.open(
      `https://wa.me/?text=${text}`,
      '_blank'
    );
    trackShare('whatsapp');
    setIsOpen(false);
  };

  const shareViaTelegram = () => {
    const url = encodeURIComponent(getShareUrl());
    const text = encodeURIComponent(getShareText());
    window.open(
      `https://t.me/share/url?url=${url}&text=${text}`,
      '_blank'
    );
    trackShare('telegram');
    setIsOpen(false);
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent(getShareText());
    const body = encodeURIComponent(
      `${getShareText()}\n\n${recipeDescription || ''}\n\nXem chi tiết tại: ${getShareUrl()}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    trackShare('email');
    setIsOpen(false);
  };

  const shareViaWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: recipeName,
          text: getShareText(),
          url: getShareUrl(),
        });
        trackShare('native_share');
        setIsOpen(false);
      } catch (err) {
        console.error('Error sharing:', err);
      }
    }
  };

  const shareOptions = [
    {
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600 hover:bg-blue-700',
      textColor: 'text-blue-600',
      onClick: shareViaFacebook,
    },
    {
      name: 'Twitter',
      icon: Twitter,
      color: 'bg-sky-500 hover:bg-sky-600',
      textColor: 'text-sky-500',
      onClick: shareViaTwitter,
    },
    {
      name: 'WhatsApp',
      icon: MessageCircle,
      color: 'bg-green-600 hover:bg-green-700',
      textColor: 'text-green-600',
      onClick: shareViaWhatsApp,
    },
    {
      name: 'Telegram',
      icon: Send,
      color: 'bg-blue-500 hover:bg-blue-600',
      textColor: 'text-blue-500',
      onClick: shareViaTelegram,
    },
    {
      name: 'Email',
      icon: Mail,
      color: 'bg-gray-600 hover:bg-gray-700',
      textColor: 'text-gray-600',
      onClick: shareViaEmail,
    },
  ];

  return (
    <div className={`relative ${className}`}>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        aria-label="Chia sẻ công thức"
      >
        <Share2 className="h-5 w-5" />
        <span className="font-medium">Chia sẻ</span>
      </button>

      {/* Share Modal/Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setIsOpen(false)}
          />

          {/* Share Panel */}
          <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Chia sẻ công thức
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Share Options */}
            <div className="p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {shareOptions.map((option) => (
                  <button
                    key={option.name}
                    onClick={option.onClick}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className={`p-3 rounded-full ${option.color} text-white`}>
                      <option.icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {option.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Copy Link */}
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  Hoặc sao chép link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={getShareUrl()}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`p-2 rounded-lg transition-colors ${
                      copied
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                    aria-label="Copy link"
                  >
                    {copied ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Link2 className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Native Share (Mobile) */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={shareViaWebShare}
                  className="w-full mt-3 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="text-sm font-medium">Chia sẻ thêm...</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (command: string, eventName: string, params: any) => void;
  }
}

export default RecipeShareButton;

