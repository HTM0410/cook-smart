import React, { useState } from 'react';
import FavoriteButton from '../atoms/FavoriteButton';
import StarRating from '../atoms/StarRating';

const ComponentDemo: React.FC = () => {
  const [favoriteCount, setFavoriteCount] = useState(47);
  const [isFavorited, setIsFavorited] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [averageRating, setAverageRating] = useState(4.2);
  const [ratingCount, setRatingCount] = useState(128);

  const handleFavoriteChange = (favorited: boolean, count: number) => {
    setIsFavorited(favorited);
    setFavoriteCount(count);
    console.log(`Favorite changed: ${favorited}, count: ${count}`);
  };

  const handleRatingChange = (rating: number, average: number, count: number) => {
    setUserRating(rating);
    setAverageRating(average);
    setRatingCount(count);
    console.log(`Rating changed: ${rating}, average: ${average}, count: ${count}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            UI Components Demo
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Interactive components với WebSocket integration và tooltips
          </p>
        </div>

        {/* Favorite Button Demo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Favorite Button Component
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Small Size */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Small Size</h3>
              <div className="flex justify-center">
                <FavoriteButton
                  recipeId={1}
                  initialFavoriteCount={favoriteCount}
                  initialIsFavorited={isFavorited}
                  userId={999}
                  size="sm"
                  showTooltip={true}
                  onFavoriteChange={handleFavoriteChange}
                />
              </div>
            </div>

            {/* Medium Size */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Medium Size</h3>
              <div className="flex justify-center">
                <FavoriteButton
                  recipeId={1}
                  initialFavoriteCount={favoriteCount}
                  initialIsFavorited={isFavorited}
                  userId={999}
                  size="md"
                  showTooltip={true}
                  onFavoriteChange={handleFavoriteChange}
                />
              </div>
            </div>

            {/* Large Size */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Large Size</h3>
              <div className="flex justify-center">
                <FavoriteButton
                  recipeId={1}
                  initialFavoriteCount={favoriteCount}
                  initialIsFavorited={isFavorited}
                  userId={999}
                  size="lg"
                  showTooltip={true}
                  onFavoriteChange={handleFavoriteChange}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Features:</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Hover tooltips với smooth animations</li>
              <li>• Optimistic updates với WebSocket integration</li>
              <li>• Loading states với spinner animation</li>
              <li>• Debouncing để prevent rapid clicks</li>
              <li>• Responsive design với multiple sizes</li>
              <li>• Dark mode support</li>
            </ul>
          </div>
        </div>

        {/* Star Rating Demo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Star Rating Component
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Small Size */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Small Size</h3>
              <div className="flex justify-center">
                <StarRating
                  rating={averageRating}
                  count={ratingCount}
                  size="sm"
                  interactive={true}
                  showCount={true}
                  onChange={(rating) => handleRatingChange(rating, averageRating, ratingCount)}
                />
              </div>
            </div>

            {/* Medium Size */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Medium Size</h3>
              <div className="flex justify-center">
                <StarRating
                  rating={averageRating}
                  count={ratingCount}
                  size="md"
                  interactive={true}
                  showCount={true}
                  onChange={(rating) => handleRatingChange(rating, averageRating, ratingCount)}
                />
              </div>
            </div>

            {/* Large Size */}
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">Large Size</h3>
              <div className="flex justify-center">
                <StarRating
                  rating={averageRating}
                  count={ratingCount}
                  size="lg"
                  interactive={true}
                  showCount={true}
                  onChange={(rating) => handleRatingChange(rating, averageRating, ratingCount)}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Features:</h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Hover tooltips với rating labels (Poor, Fair, Good, Very Good, Excellent)</li>
              <li>• Real-time updates với WebSocket integration</li>
              <li>• Hover effects với scale animations</li>
              <li>• Loading states cho individual stars</li>
              <li>• Half-star support cho precise ratings</li>
              <li>• Accessibility với proper ARIA labels</li>
              <li>• Dark mode support</li>
            </ul>
          </div>
        </div>

        {/* Interactive Demo */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">
            Interactive Demo
          </h2>
          
          <div className="flex flex-col items-center space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
                Recipe: "Phở Bò Hà Nội"
              </h3>
              <div className="flex items-center justify-center space-x-8">
                <FavoriteButton
                  recipeId={1}
                  initialFavoriteCount={favoriteCount}
                  initialIsFavorited={isFavorited}
                  userId={999}
                  size="lg"
                  showTooltip={true}
                  onFavoriteChange={handleFavoriteChange}
                />
                
                <StarRating
                  rating={averageRating}
                  count={ratingCount}
                  size="lg"
                  interactive={true}
                  showCount={true}
                  onChange={(rating) => handleRatingChange(rating, averageRating, ratingCount)}
                />
              </div>
            </div>

            <div className="w-full max-w-md p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Current State:</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>Favorite: {isFavorited ? '❤️ Added' : '🤍 Not added'} ({favoriteCount} total)</p>
                <p>Your Rating: {userRating > 0 ? `${userRating} stars` : 'Not rated'}</p>
                <p>Average Rating: {averageRating.toFixed(1)} stars ({ratingCount} ratings)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComponentDemo;
