import React, { useState, useEffect, useRef } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import socketService from '../../services/socketService';
import favoriteService from '../../services/favoriteService';
import showToast from '../../utils/toast';

interface FavoriteButtonProps {
  recipeId: number;
  initialFavoriteCount: number;
  initialIsFavorited?: boolean;
  userId?: number;
  size?: 'sm' | 'md' | 'lg';
  showCount?: boolean;
  showTooltip?: boolean;
  onFavoriteChange?: (isFavorited: boolean, count: number) => void;
}

const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  recipeId,
  initialFavoriteCount,
  initialIsFavorited = false,
  userId,
  size = 'md',
  showCount = true,
  showTooltip = true,
  onFavoriteChange,
}) => {
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [favoriteCount, setFavoriteCount] = useState(initialFavoriteCount);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimistic, setIsOptimistic] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [justToggled, setJustToggled] = useState(false);
  const isOptimisticRef = useRef(false);
  // Pill button — a soft rounded rectangle with a frosted backdrop so it
  // reads cleanly on top of any recipe image (dark or light) and stays
  // visually anchored to the card instead of looking like a floating dot.
  // When showCount is false we collapse the pill to a rounded square so
  // it doesn't look stranded with nothing inside.
  const sizeConfig = {
    sm: {
      button: 'h-9 px-3 gap-1.5 rounded-xl',
      buttonOnly: 'h-9 w-9 rounded-xl',
      iconBox: 'w-5 h-5',
      icon: 'h-[14px] w-[14px]',
      text: 'text-xs',
    },
    md: {
      button: 'h-10 px-3.5 gap-2 rounded-xl',
      buttonOnly: 'h-10 w-10 rounded-xl',
      iconBox: 'w-6 h-6',
      icon: 'h-[16px] w-[16px]',
      text: 'text-sm',
    },
    lg: {
      button: 'h-12 px-4 gap-2 rounded-2xl',
      buttonOnly: 'h-12 w-12 rounded-2xl',
      iconBox: 'w-7 h-7',
      icon: 'h-5 w-5',
      text: 'text-base',
    },
  };

  const config = sizeConfig[size];

  useEffect(() => {
    isOptimisticRef.current = isOptimistic;
  }, [isOptimistic]);

  useEffect(() => {
    let isMounted = true;

    const loadFavoriteState = async () => {
      try {
        const [statusResponse, countResponse] = await Promise.all([
          userId ? favoriteService.checkFavoriteStatus(recipeId) : Promise.resolve(null),
          favoriteService.getFavoriteCount(recipeId),
        ]);

        if (!isMounted || isOptimisticRef.current) return;

        if (statusResponse) {
          setIsFavorited(statusResponse.data.favorited);
        }
        setFavoriteCount(countResponse.data.count);
      } catch (error) {
        console.error('Error loading favorite state:', error);
      }
    };

    loadFavoriteState();

    // ✅ JOIN RECIPE ROOM to receive real-time updates
    if (socketService.isConnected()) {
      socketService.joinRecipeRoom(recipeId);
      console.log(`🔔 Joined recipe room for recipe ${recipeId}`);
    }
    
    // Listen for favorite updates from WebSocket
    const handleFavoriteUpdate = (data: {
      recipeId: number;
      userId: number;
      isFavorited: boolean;
      favoriteCount: number;
      timestamp: string;
    }) => {
      if (data.recipeId === recipeId) {
        console.log(`✅ Received favorite-updated event for recipe ${recipeId}`, data);
        // Update count from server
        setFavoriteCount(data.favoriteCount);
        
        // If it's the current user's action, update the favorite state
        if (data.userId === userId) {
          setIsFavorited(data.isFavorited);
          setIsOptimistic(false);
          setIsLoading(false);
          onFavoriteChange?.(data.isFavorited, data.favoriteCount);
        }
      }
    };

    const handleFavoriteStatus = (data: {
      recipeId: number;
      userId: number;
      isFavorited: boolean;
      favoriteCount: number;
      timestamp: string;
    }) => {
      if (data.recipeId === recipeId && data.userId === userId) {
        // Only update if not currently in optimistic state
        if (!isOptimisticRef.current) {
          setIsFavorited(data.isFavorited);
          setFavoriteCount(data.favoriteCount);
          console.log(`📊 Favorite status: ${data.isFavorited} (count: ${data.favoriteCount})`);
        }
      }
    };

    const handleRecipeStats = (data: {
      recipeId: number;
      favoriteCount: number;
      averageRating: number;
      ratingCount: number;
      commentCount: number;
    }) => {
      if (data.recipeId === recipeId && !isOptimisticRef.current) {
        setFavoriteCount(data.favoriteCount);
      }
    };

    // Get initial favorite status from socket when it is available.
    if (userId && socketService.isConnected()) {
      socketService.getFavoriteStatus(recipeId);
    }

    socketService.on('favorite-updated', handleFavoriteUpdate);
    socketService.on('favorite-status', handleFavoriteStatus);
    socketService.on('recipe-stats', handleRecipeStats);

    return () => {
      isMounted = false;
      // ✅ LEAVE ROOM when component unmounts
      socketService.leaveRecipeRoom(recipeId);
      socketService.off('favorite-updated', handleFavoriteUpdate);
      socketService.off('favorite-status', handleFavoriteStatus);
      socketService.off('recipe-stats', handleRecipeStats);
      console.log(`🔕 Left recipe room for recipe ${recipeId}`);
    };
  }, [recipeId, userId]); // Removed favoriteCount and onFavoriteChange from dependencies

  const handleClick = async () => {
    if (!userId || !localStorage.getItem('token')) {
      setError('Please login to favorite recipes');
      showToast.warning('Vui lòng đăng nhập để yêu thích công thức');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (isLoading || isOptimistic) return;

    // Debounce: prevent multiple clicks within 500ms
    const now = Date.now();
    if (now - lastClickTime < 500) {
      console.log('Click debounced - too fast');
      return;
    }
    setLastClickTime(now);

    // Clear any previous errors
    setError(null);

    // Save current state for potential rollback
    const stateBeforeToggle = {
      isFavorited,
      count: favoriteCount,
    };

    setIsLoading(true);
    setIsOptimistic(true);

    // Optimistic update
    const newIsFavorited = !isFavorited;
    const newCount = newIsFavorited ? favoriteCount + 1 : Math.max(0, favoriteCount - 1);

    setIsFavorited(newIsFavorited);
    setFavoriteCount(newCount);
    onFavoriteChange?.(newIsFavorited, newCount);

    // Trigger heart animation
    setJustToggled(true);
    setTimeout(() => setJustToggled(false), 600);

    try {
      const response = await favoriteService.toggleFavorite(recipeId, isFavorited);
      const countResponse = await favoriteService.getFavoriteCount(recipeId);

      setIsFavorited(response.data.favorited);
      setFavoriteCount(countResponse.data.count);
      setIsOptimistic(false);
      setIsLoading(false);
      onFavoriteChange?.(response.data.favorited, countResponse.data.count);
      showToast.success(response.data.favorited ? 'Đã thêm vào yêu thích' : 'Đã xóa khỏi yêu thích');
      console.log(`🔄 Toggling favorite for recipe: ${recipeId}, new state: ${newIsFavorited}`);
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      const isUnauthorized = error?.response?.status === 401;
      setError(isUnauthorized ? 'Please login again' : 'Failed to update favorite');
      showToast.error(isUnauthorized
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại'
        : 'Không thể cập nhật yêu thích. Vui lòng thử lại'
      );
      
      // Rollback optimistic update
      setIsFavorited(stateBeforeToggle.isFavorited);
      setFavoriteCount(stateBeforeToggle.count);
      onFavoriteChange?.(stateBeforeToggle.isFavorited, stateBeforeToggle.count);
      setIsOptimistic(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center">
        <div className="relative group">
          <button
            onClick={(e) => {
              e.preventDefault(); // Ngăn default behavior
              e.stopPropagation(); // Ngăn event bubble lên Link parent
              handleClick();
            }}
            disabled={isLoading || isOptimistic}
            className={`
              ${showCount ? config.button : config.buttonOnly}
              inline-flex items-center justify-center font-semibold
              backdrop-blur-md transition-all duration-200
              ${isFavorited
                ? 'bg-rose-500 text-white border border-rose-600/30 shadow-[0_4px_14px_rgba(244,63,94,0.45)] hover:bg-rose-600'
                : 'bg-white/90 text-ink-primary border border-white/50 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:bg-white dark:bg-ink-700/90 dark:text-paper-light dark:border-white/10'
              }
              ${isLoading || isOptimistic ? 'opacity-75 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
              ${error ? 'ring-2 ring-rose-400' : ''}
              focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
            `}
            aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isLoading || isOptimistic ? (
              <Loader2 className={`${config.icon} animate-spin`} />
            ) : (
              <span className={`inline-flex items-center justify-center rounded-md ${
                isFavorited ? 'bg-white/20' : 'bg-rose-50 dark:bg-rose-500/15'
              } ${config.iconBox} ${showCount ? 'mr-1' : ''}`}>
                <Heart
                  className={`${config.icon} ${
                    isFavorited
                      ? 'fill-current text-white'
                      : 'text-rose-500 dark:text-rose-400'
                  } ${justToggled && isFavorited ? 'animate-heart-pop' : ''}`}
                  strokeWidth={isFavorited ? 0 : 2}
                />
              </span>
            )}
            {showCount && (
              <span className={`${config.text} tabular-nums ${
                isFavorited ? 'text-white' : 'text-ink-primary dark:text-paper-light'
              } ${isOptimistic ? 'italic opacity-70' : ''}`}>
                {favoriteCount}
              </span>
            )}
          </button>

          {showTooltip && !error && (
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-ink-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              {isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              {isOptimistic && ' (pending...)'}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-ink-700"></div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-1 text-xs text-rose-500 animate-fade-in">
          {error}
        </div>
      )}
    </div>
  );
};

export default FavoriteButton;
