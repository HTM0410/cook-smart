import React, { useState } from 'react';

interface SocialShareProps {
  profileUrl: string;
  profileName: string;
  className?: string;
}

const SocialShare: React.FC<SocialShareProps> = ({
  profileUrl,
  profileName,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const shareText = `Xem profile của ${profileName} trên Food Suggest!`;
  const encodedUrl = encodeURIComponent(profileUrl);
  const encodedText = encodeURIComponent(shareText);

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
  };

  const handleShare = (platform: string) => {
    const url = shareLinks[platform as keyof typeof shareLinks];
    if (url) {
      window.open(url, '_blank', 'width=600,height=400');
    }
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      // You could add a toast notification here
      alert('Đã copy link vào clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-5 py-2.5 border-2 border-orange-500 text-orange-500 rounded-xl font-medium hover:bg-orange-50 transition-colors"
      >
        Chia sẻ
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 min-w-[220px] overflow-hidden">
          <div className="p-2">
            <button
              onClick={() => handleShare('facebook')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="text-xl">📘</span>
              <span>Facebook</span>
            </button>
            <button
              onClick={() => handleShare('twitter')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="text-xl">🐦</span>
              <span>Twitter</span>
            </button>
            <button
              onClick={() => handleShare('whatsapp')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="text-xl">📱</span>
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => handleShare('telegram')}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="text-xl">✈️</span>
              <span>Telegram</span>
            </button>
            <hr className="my-2 border-gray-200" />
            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="text-xl">📋</span>
              <span>Sao chép liên kết</span>
            </button>
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default SocialShare;
