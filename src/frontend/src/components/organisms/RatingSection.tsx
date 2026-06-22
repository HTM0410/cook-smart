import React, { useState, useEffect } from 'react';
import { Star, Users } from 'lucide-react';
import StarRating from '../atoms/StarRating';
import ratingService, { RatingStats } from '../../services/ratingService';
import { useAuth } from '../../contexts/AuthContext';
import showToast from '../../utils/toast';

interface RatingSectionProps {
  recipeId: number;
  mockStats?: RatingStats; // Dữ liệu mẫu cho demo
  compact?: boolean;
}

const RatingSection: React.FC<RatingSectionProps> = ({ recipeId, mockStats, compact = false }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<RatingStats | null>(null);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load rating stats and user rating
  useEffect(() => {
    // Nếu có mockStats, sử dụng luôn (cho demo)
    if (mockStats) {
      setStats(mockStats);
      setIsLoading(false);
      return;
    }
    
    loadRatingData();
  }, [recipeId, user, mockStats]);

  const loadRatingData = async () => {
    try {
      setIsLoading(true);
      
      // Load stats
      const statsResponse = await ratingService.getRatingStats(recipeId);
      setStats(statsResponse.data);
      
      // Load user rating if logged in
      if (user) {
        const userResponse = await ratingService.getUserRating(recipeId);
        setUserRating(userResponse.data.userRating?.rating || null);
      }
    } catch (error: any) {
      console.error('Error loading rating data:', error);
      // Set default stats if API fails
      setStats({
        averageRating: 0,
        ratingCount: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        userRating: null
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRatingChange = async (newRating: number) => {
    if (!user) {
      showToast.error('Vui lòng đăng nhập để đánh giá');
      return;
    }

    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      const response = await ratingService.submitRating(recipeId, newRating);
      
      // Update local state
      setUserRating(newRating);
      setStats(response.data.stats);
      
      showToast.success(
        response.data.status === 'created' 
          ? 'Đánh giá thành công!' 
          : 'Cập nhật đánh giá thành công!'
      );
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      showToast.error(error.response?.data?.message || 'Không thể đánh giá. Vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-300 dark:bg-gray-700 rounded-xl" />
        <div className="h-20 bg-gray-300 dark:bg-gray-700 rounded-lg" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Overall Rating Display */}
      <div className="flex flex-col items-center p-4 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl">
        <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}
        </div>
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                i < Math.floor(stats.averageRating)
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300 dark:text-gray-600'
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <Users className="w-3 h-3" />
          <span>{stats.ratingCount.toLocaleString()} đánh giá</span>
        </div>
      </div>

      {/* User Rating Input */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 text-center">
          {userRating ? 'Đánh giá của bạn' : user ? 'Đánh giá món này' : 'Đăng nhập để đánh giá'}
        </p>
        <div className="flex justify-center">
          <StarRating
            rating={userRating || 0}
            size="lg"
            interactive={!!user}
            onChange={handleRatingChange}
            disabled={isSubmitting}
            showCount={false}
          />
        </div>
        {isSubmitting && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Đang lưu...
          </p>
        )}
      </div>
    </div>
  );
};

export default RatingSection;

