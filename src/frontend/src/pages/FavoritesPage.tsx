import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Loader2, Heart, Clock, Users, ChevronLeft, ChevronRight, 
  Search, Filter, Grid, List, Star, ChefHat, SlidersHorizontal
} from 'lucide-react';
import favoriteService, { Favorite } from '../services/favoriteService';
import { useAuth } from '../contexts/AuthContext';
import showToast from '../utils/toast';
import FavoriteButton from '../components/atoms/FavoriteButton';
import requestCache from '../utils/requestCache';

type ViewMode = 'grid' | 'list';
type SortBy = 'newest' | 'oldest' | 'name' | 'time' | 'difficulty';

const FavoritesPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const prevLocationRef = useRef<string>('');
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const limit = 12;

  // Load favorites
  const loadFavorites = async (pageNum = 1) => {
    if (!user) return;

    try {
      setIsLoading(true);
      const response = await favoriteService.getUserFavorites(pageNum, limit);
      setFavorites(response.data.favorites);
      setTotalPages(response.data.pagination.pages);
      setTotal(response.data.pagination.total);
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading favorites:', error);
      showToast.error('Không thể tải danh sách yêu thích');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFavorites(1);
  }, [user]);

  // Reload favorites when navigating to this page (from another page)
  useEffect(() => {
    if (location.pathname === '/favorites' && prevLocationRef.current !== location.pathname && prevLocationRef.current !== '') {
      console.log('🔄 Navigated to favorites page - invalidating cache and reloading');
      // Invalidate favorites cache to ensure fresh data
      requestCache.invalidate(/^favorites:/);
      loadFavorites(page);
    }
    prevLocationRef.current = location.pathname;
  }, [location.pathname, page]);

  // Reload favorites when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        console.log('🔄 Page visible - reloading favorites');
        loadFavorites(page);
      }
    };

    const handleFocus = () => {
      if (user) {
        console.log('🔄 Window focused - reloading favorites');
        loadFavorites(page);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, page]);

  const handleFavoriteChange = (recipeId: number, isFavorited: boolean) => {
    if (!isFavorited) {
      // Remove from list
      setFavorites(favorites.filter(f => f.recipeId !== recipeId));
      setTotal(total - 1);
    } else {
      // Added favorite - reload to show new favorite
      console.log('✅ Favorite added - reloading favorites list');
      loadFavorites(page);
    }
  };

  // Filter and sort favorites
  const filteredAndSortedFavorites = useMemo(() => {
    let result = [...favorites];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f => 
        f.recipe?.recipeName.toLowerCase().includes(query) ||
        f.recipe?.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      const recipeA = a.recipe;
      const recipeB = b.recipe;
      
      if (!recipeA || !recipeB) return 0;

      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return recipeA.recipeName.localeCompare(recipeB.recipeName);
        case 'time':
          return (recipeA.prepTime + recipeA.cookTime) - (recipeB.prepTime + recipeB.cookTime);
        case 'difficulty':
          const diffOrder = { easy: 1, medium: 2, hard: 3 };
          return diffOrder[recipeA.difficulty as keyof typeof diffOrder] - 
                 diffOrder[recipeB.difficulty as keyof typeof diffOrder];
        default:
          return 0;
      }
    });

    return result;
  }, [favorites, searchQuery, sortBy]);


  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Heart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Vui lòng đăng nhập
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Bạn cần đăng nhập để xem danh sách món ăn yêu thích
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors"
          >
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-3">
                <Heart className="w-10 h-10 text-orange-500 fill-orange-500" />
                Món ăn yêu thích
              </h1>
              <div className="flex items-center gap-3">
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  {total > 0 ? `Bộ sưu tập ${total} công thức yêu thích của bạn` : 'Chưa có món ăn yêu thích nào'}
                </p>
                {total > 0 && (
                  <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                    <ChefHat className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">{total}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Search and Filter Bar */}
          {total > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm trong yêu thích..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Sort */}
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-gray-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                  >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="name">Tên A-Z</option>
                    <option value="time">Thời gian</option>
                    <option value="difficulty">Độ khó</option>
                  </select>
                </div>

                {/* View Mode */}
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'grid'
                        ? 'bg-white dark:bg-gray-600 text-orange-500 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Grid className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-colors ${
                      viewMode === 'list'
                        ? 'bg-white dark:bg-gray-600 text-orange-500 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <List className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden animate-pulse">
                <div className="aspect-video bg-gray-300 dark:bg-gray-700" />
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-full" />
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-5/6" />
                  <div className="flex gap-4 pt-2">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20" />
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          /* Empty State */
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
            <div className="max-w-md mx-auto">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full" />
                <Heart className="relative w-20 h-20 text-gray-400 dark:text-gray-600 mx-auto" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                Chưa có món ăn yêu thích
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
                Khám phá hàng nghìn công thức nấu ăn và lưu những món bạn yêu thích để dễ dàng tìm lại sau này
              </p>
              <Link
                to="/recipes"
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full hover:from-orange-600 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                <ChefHat className="w-5 h-5" />
                <span className="font-semibold">Khám phá công thức</span>
              </Link>
            </div>
          </div>
        ) : filteredAndSortedFavorites.length === 0 ? (
          /* No results from search */
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center border border-gray-200 dark:border-gray-700">
            <Search className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Không tìm thấy kết quả
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Không có công thức nào phù hợp với từ khóa "{searchQuery}"
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="px-6 py-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors"
            >
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <>
            {/* Recipes Grid/List */}
            <div className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8'
                : 'space-y-4 mb-8'
            }>
              {filteredAndSortedFavorites.map((favorite) => {
                const recipe = favorite.recipe;
                if (!recipe) return null;

                if (viewMode === 'list') {
                  return (
                    <div
                      key={favorite.id}
                      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 group"
                    >
                      <div className="flex flex-col sm:flex-row relative">
                        {/* Image */}
                        <Link to={`/recipes/${recipe.id}`} className="block relative overflow-hidden sm:w-64 h-48 sm:h-auto flex-shrink-0">
                          {recipe.imageUrl ? (
                            <img
                              src={recipe.imageUrl}
                              alt={recipe.recipeName}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                              <span className="text-white text-5xl font-bold">
                                {recipe.recipeName.charAt(0)}
                              </span>
                            </div>
                          )}
                        </Link>
                        {/* Favorite Button - Đặt ra ngoài Link */}
                        <div 
                          className="absolute top-3 right-3 z-20"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          <FavoriteButton
                            recipeId={recipe.id}
                            initialFavoriteCount={0}
                            initialIsFavorited={true}
                            userId={user.id}
                            size="sm"
                            showCount={false}
                            onFavoriteChange={(isFavorited) => handleFavoriteChange(recipe.id, isFavorited)}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-5">
                          <Link to={`/recipes/${recipe.id}`}>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 hover:text-orange-500 transition-colors">
                              {recipe.recipeName}
                            </h3>
                          </Link>

                          {recipe.description && (
                            <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                              {recipe.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <Clock className="w-4 h-4" />
                              <span>{recipe.prepTime + recipe.cookTime} phút</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                              <Users className="w-4 h-4" />
                              <span>{recipe.servings} người</span>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                recipe.difficulty === 'easy'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : recipe.difficulty === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              }`}
                            >
                              {recipe.difficulty === 'easy' ? 'Dễ' : recipe.difficulty === 'medium' ? 'Trung bình' : 'Khó'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Grid view
                return (
                  <div
                    key={favorite.id}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group border border-gray-200 dark:border-gray-700 relative"
                  >
                    {/* Image */}
                    <Link to={`/recipes/${recipe.id}`} className="block relative overflow-hidden aspect-video">
                      {recipe.imageUrl ? (
                        <img
                          src={recipe.imageUrl}
                          alt={recipe.recipeName}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                          <span className="text-white text-4xl font-bold">
                            {recipe.recipeName.charAt(0)}
                          </span>
                        </div>
                      )}
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </Link>
                    {/* Favorite Badge - Đặt ra ngoài Link */}
                    <div 
                      className="absolute top-3 right-3 z-20"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <FavoriteButton
                        recipeId={recipe.id}
                        initialFavoriteCount={0}
                        initialIsFavorited={true}
                        userId={user.id}
                        size="sm"
                        showCount={false}
                        onFavoriteChange={(isFavorited) => handleFavoriteChange(recipe.id, isFavorited)}
                      />
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      <Link to={`/recipes/${recipe.id}`}>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 hover:text-orange-500 transition-colors min-h-[3.5rem]">
                          {recipe.recipeName}
                        </h3>
                      </Link>

                      {recipe.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 min-h-[2.5rem]">
                          {recipe.description}
                        </p>
                      )}

                      {/* Meta Info */}
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{recipe.prepTime + recipe.cookTime}p</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          <span>{recipe.servings}</span>
                        </div>
                      </div>

                      {/* Difficulty Badge */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${
                            recipe.difficulty === 'easy'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : recipe.difficulty === 'medium'
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {recipe.difficulty === 'easy' ? 'Dễ' : recipe.difficulty === 'medium' ? 'Trung bình' : 'Khó'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4">
                <button
                  onClick={() => loadFavorites(page - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-orange-50 dark:hover:bg-gray-700 hover:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800 disabled:hover:border-gray-300 dark:disabled:hover:border-gray-600 transition-all duration-300 font-medium text-gray-700 dark:text-gray-300"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span>Trước</span>
                </button>

                <div className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl font-semibold shadow-md">
                  Trang {page} / {totalPages}
                </div>

                <button
                  onClick={() => loadFavorites(page + 1)}
                  disabled={page === totalPages}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-orange-50 dark:hover:bg-gray-700 hover:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-gray-800 disabled:hover:border-gray-300 dark:disabled:hover:border-gray-600 transition-all duration-300 font-medium text-gray-700 dark:text-gray-300"
                >
                  <span>Sau</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FavoritesPage;

