import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  interactive?: boolean;
  showCount?: boolean;
  count?: number;
  onChange?: (rating: number) => void;
  disabled?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  showCount = false,
  count = 0,
  onChange,
  disabled = false,
}) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  const handleClick = (value: number) => {
    if (interactive && !disabled && onChange) {
      onChange(value);
    }
  };

  const handleMouseEnter = (value: number) => {
    if (interactive && !disabled) {
      setHoverRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (interactive && !disabled) {
      setHoverRating(null);
    }
  };

  const displayRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {Array.from({ length: maxRating }, (_, index) => {
          const starValue = index + 1;
          const isFilled = starValue <= Math.floor(displayRating);
          const isHalfFilled = !isFilled && starValue - 0.5 <= displayRating;

          return (
            <button
              key={index}
              type="button"
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => handleMouseEnter(starValue)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive || disabled}
              className={`
                relative
                ${interactive && !disabled ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                ${disabled ? 'opacity-50' : ''}
                transition-all duration-200
              `}
              aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
            >
              {isHalfFilled ? (
                <div className="relative">
                  <Star
                    className={`${sizeClasses[size]} text-gray-300 dark:text-gray-600`}
                    fill="currentColor"
                  />
                  <div className="absolute inset-0 overflow-hidden" style={{ width: '50%' }}>
                    <Star
                      className={`${sizeClasses[size]} text-yellow-400`}
                      fill="currentColor"
                    />
                  </div>
                </div>
              ) : (
                <Star
                  className={`
                    ${sizeClasses[size]}
                    ${isFilled ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                    ${interactive && !disabled && hoverRating && starValue <= hoverRating ? 'text-yellow-300' : ''}
                  `}
                  fill={isFilled || (interactive && !disabled && hoverRating && starValue <= hoverRating) ? 'currentColor' : 'none'}
                  strokeWidth={2}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Rating value and count */}
      <div className="flex items-center gap-1 text-sm">
        <span className="font-semibold text-gray-900 dark:text-white">
          {rating > 0 ? rating.toFixed(1) : '—'}
        </span>
        {showCount && count > 0 && (
          <span className="text-gray-500 dark:text-gray-400">
            ({count.toLocaleString()})
          </span>
        )}
      </div>
    </div>
  );
};

export default StarRating;
