import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Heart, Clock, Users, ChevronLeft, ChevronRight,
  Search, Grid, List, Star, ChefHat, SlidersHorizontal, ArrowUpRight
} from 'lucide-react';
import favoriteService, { Favorite } from '../services/favoriteService';
import { useAuth } from '../contexts/AuthContext';
import showToast from '../utils/toast';
import FavoriteButton from '../components/atoms/FavoriteButton';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { ButtonEditorial } from '../components/atoms/ButtonEditorial';
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, viewportOnce } from '../lib/motion';
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

  const getDifficultyConfig = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return { label: 'Dễ', bg: 'bg-[#EDF3EC] text-[#346538]' };
      case 'medium': return { label: 'Vừa', bg: 'bg-[#FBF3DB] text-[#956400]' };
      case 'hard': return { label: 'Khó', bg: 'bg-[#FDEBEC] text-[#9F2F2D]' };
      default: return { label: difficulty, bg: 'bg-paper-light text-ink-secondary' };
    }
  };

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;
      if (prevLocationRef.current === location.pathname + location.search) return;
      prevLocationRef.current = location.pathname + location.search;
      try {
        setIsLoading(true);
        const cacheKey = `favorites_${user.id}_p${page}_l${limit}`;
        const cached = requestCache.get<{ favorites: Favorite[]; totalPages: number; total: number }>(cacheKey);
        if (cached) {
          setFavorites(cached.favorites || []);
          setTotalPages(cached.totalPages || 1);
          setTotal(cached.total || 0);
          setIsLoading(false);
          return;
        }
        const response = await favoriteService.getUserFavorites(page, limit);
        if (response.success) {
          const list = response.data.favorites || [];
          const totalVal = response.data.pagination?.total || 0;
          const pagesVal = response.data.pagination?.pages || 1;
          setFavorites(list);
          setTotalPages(pagesVal);
          setTotal(totalVal);
          requestCache.set(cacheKey, { favorites: list, totalPages: pagesVal, total: totalVal });
        }
      } catch (error) {
        console.error('Error fetching favorites:', error);
        showToast.error('Không thể tải danh sách yêu thích');
      } finally {
        setIsLoading(false);
      }
    };
    fetchFavorites();
  }, [user, page, location.pathname, location.search]);

  const filteredAndSortedFavorites = useMemo(() => {
    let result = [...favorites];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.recipe?.recipeName.toLowerCase().includes(q));
    }
    switch (sortBy) {
      case 'newest': result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'oldest': result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()); break;
      case 'name': result.sort((a, b) => (a.recipe?.recipeName || '').localeCompare(b.recipe?.recipeName || '')); break;
      case 'time': result.sort((a, b) => ((a.recipe?.prepTime || 0) + (a.recipe?.cookTime || 0)) - ((b.recipe?.prepTime || 0) + (b.recipe?.cookTime || 0))); break;
      case 'difficulty': {
        const order = { easy: 0, medium: 1, hard: 2 };
        result.sort((a, b) => (order[a.recipe?.difficulty as keyof typeof order] ?? 3) - (order[b.recipe?.difficulty as keyof typeof order] ?? 3));
        break;
      }
    }
    return result;
  }, [favorites, searchQuery, sortBy]);

  const handleFavoriteChange = async (recipeId: number, isFavorited: boolean) => {
    if (!isFavorited) {
      setFavorites(prev => prev.filter(f => f.recipe?.id !== recipeId));
      setTotal(prev => Math.max(0, prev - 1));
      try {
        await favoriteService.removeFavorite(recipeId);
        requestCache.clear();
      } catch (e) { console.error(e); }
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-paper-light dark:bg-ink-800 flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <Heart className="w-16 h-16 mx-auto text-ink-muted" strokeWidth={1} />
          <h2 className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light text-balance">Vui lòng đăng nhập</h2>
          <p className="text-ink-secondary text-pretty">Bạn cần đăng nhập để xem danh sách món ăn yêu thích.</p>
          <Link to="/login" className="btn-editorial-primary inline-flex">Đăng nhập ngay</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-light dark:bg-ink-800">
      {/* Editorial Header */}
      <section className="pt-32 md:pt-40 pb-12">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={splitRevealLeft}
              className="lg:col-span-7"
            >
              <EyebrowTag>Bộ sưu tập cá nhân</EyebrowTag>
              <h1 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
                Món ăn
                <br />
                <span className="text-ink-muted">yêu thích.</span>
              </h1>
              <p className="mt-6 text-ink-secondary text-lg leading-relaxed max-w-md text-pretty">
                {total > 0 ? `Bộ sưu tập ${total} công thức yêu thích của bạn.` : 'Chưa có món ăn yêu thích nào.'}
              </p>
            </motion.div>

            <motion.div
              initial="hidden"
              animate="visible"
              variants={splitRevealRight}
              className="lg:col-span-5 lg:pb-3"
            >
              {total > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="input-bezel">
                      <div className="relative">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary" strokeWidth={1.5} />
                        <input
                          type="text"
                          placeholder="Tìm trong yêu thích..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="input-bezel-inner h-11 pl-12 pr-4 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortBy)}
                      className="h-11 pl-5 pr-10 text-sm rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-700 ease-[var(--ease-fluid)] font-medium"
                    >
                      <option value="newest">Mới nhất</option>
                      <option value="oldest">Cũ nhất</option>
                      <option value="name">Tên A-Z</option>
                      <option value="time">Thời gian</option>
                      <option value="difficulty">Độ khó</option>
                    </select>
                    <SlidersHorizontal className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" strokeWidth={1.5} />
                  </div>
                  <div className="inline-flex p-1 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700">
                    {[
                      { id: 'grid', icon: Grid },
                      { id: 'list', icon: List },
                    ].map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setViewMode(v.id as ViewMode)}
                        className={`relative p-2.5 rounded-full transition-colors duration-700 ease-[var(--ease-fluid)] ${
                          viewMode === v.id
                            ? 'bg-white dark:bg-ink-800 text-ink-primary dark:text-paper-light shadow-sm'
                            : 'text-ink-secondary hover:text-ink-primary'
                        }`}
                        aria-label={v.id}
                      >
                        <v.icon className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="pb-24">
        <div className="container">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="card-bezel">
                  <div className="card-bezel-inner aspect-video animate-pulse bg-gradient-to-r from-paper-light via-ink-200 to-paper-light dark:from-ink-700 dark:via-ink-600 dark:to-ink-700 bg-[length:200%_100%]" />
                </div>
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={splitRevealLeft}
              className="card-bezel max-w-2xl mx-auto"
            >
              <div className="card-bezel-inner p-12 md:p-16 text-center">
                <div className="relative inline-block mb-6">
                  <div className="absolute inset-0 bg-[#ff4f00]/15 blur-3xl rounded-full" />
                  <Heart className="relative w-20 h-20 text-ink-300 dark:text-ink-200 mx-auto" strokeWidth={1} />
                </div>
                <h2 className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light mb-3 text-balance">
                  Chưa có món yêu thích.
                </h2>
                <p className="text-ink-secondary mb-8 text-lg text-pretty max-w-md mx-auto">
                  Khám phá hàng nghìn công thức nấu ăn và lưu những món bạn yêu thích để dễ dàng tìm lại sau này.
                </p>
                <Link to="/recipes" className="btn-editorial-primary inline-flex">
                  <ChefHat className="w-4 h-4" strokeWidth={1.5} />
                  Khám phá công thức
                </Link>
              </div>
            </motion.div>
          ) : filteredAndSortedFavorites.length === 0 ? (
            <div className="card-bezel max-w-2xl mx-auto">
              <div className="card-bezel-inner p-10 md:p-12 text-center">
                <Search className="w-12 h-12 mx-auto text-ink-muted mb-4" strokeWidth={1.5} />
                <h2 className="text-display text-2xl md:text-3xl text-ink-primary dark:text-paper-light mb-2 text-balance">
                  Không tìm thấy kết quả
                </h2>
                <p className="text-ink-secondary mb-6">
                  Không có công thức nào phù hợp với từ khóa "{searchQuery}"
                </p>
                <button onClick={() => setSearchQuery('')} className="btn-editorial-ghost">Xóa bộ lọc</button>
              </div>
            </div>
          ) : (
            <>
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerGrid}
                className={viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 mb-12'
                  : 'space-y-4 mb-12'
                }
              >
                {filteredAndSortedFavorites.map((favorite, idx) => {
                  const recipe = favorite.recipe;
                  if (!recipe) return null;
                  const diff = getDifficultyConfig(recipe.difficulty);

                  if (viewMode === 'list') {
                    return (
                      <motion.div key={favorite.id} custom={idx} variants={cardReveal}>
                        <article className="card-bezel">
                          <div className="card-bezel-inner flex flex-col sm:flex-row overflow-hidden p-0">
                            <Link to={`/recipes/${recipe.id}`} className="block relative overflow-hidden sm:w-64 h-48 sm:h-auto flex-shrink-0">
                              {recipe.imageUrl ? (
                                <img
                                  src={recipe.imageUrl}
                                  alt={recipe.recipeName}
                                  loading="lazy"
                                  className="w-full h-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                                  <ChefHat className="w-12 h-12 text-ink-200" strokeWidth={1} />
                                </div>
                              )}
                            </Link>
                            <div className="flex-1 p-5 md:p-6 flex flex-col">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <Link to={`/recipes/${recipe.id}`} className="flex-1 min-w-0">
                                  <h3 className="text-xl font-semibold text-ink-primary dark:text-paper-light hover:text-[#ff4f00] transition-colors duration-700 ease-[var(--ease-fluid)] line-clamp-1">
                                    {recipe.recipeName}
                                  </h3>
                                </Link>
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
                              {recipe.description && (
                                <p className="text-sm text-ink-secondary mb-4 line-clamp-2 flex-1 text-pretty">
                                  {recipe.description}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.2em] text-ink-secondary">
                                <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" strokeWidth={1.5} />{recipe.prepTime + recipe.cookTime}p</span>
                                <span className="flex items-center gap-1.5"><Users className="w-3 h-3" strokeWidth={1.5} />{recipe.servings} người</span>
                                <span className={`eyebrow-tag ${diff.bg}`}>{diff.label}</span>
                              </div>
                            </div>
                          </div>
                        </article>
                      </motion.div>
                    );
                  }

                  return (
                    <motion.div key={favorite.id} custom={idx} variants={cardReveal}>
                      <Link to={`/recipes/${recipe.id}`} className="group block h-full">
                        <article className="card-bezel h-full">
                          <div className="card-bezel-inner p-0 overflow-hidden h-full flex flex-col">
                            <div className="relative aspect-[4/3] overflow-hidden">
                              {recipe.imageUrl ? (
                                <img
                                  src={recipe.imageUrl}
                                  alt={recipe.recipeName}
                                  loading="lazy"
                                  className="w-full h-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                                  <ChefHat className="w-12 h-12 text-ink-200" strokeWidth={1} />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-ink-700/30 to-transparent" />
                              <div className="absolute top-3 right-3 z-10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
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
                              <div className="absolute bottom-3 left-3 z-10">
                                <span className={`eyebrow-tag ${diff.bg}`}>{diff.label}</span>
                              </div>
                            </div>
                            <div className="p-5 flex-1 flex flex-col">
                              <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light mb-2 line-clamp-2 group-hover:text-[#ff4f00] transition-colors duration-700 ease-[var(--ease-fluid)] flex-1">
                                {recipe.recipeName}
                              </h3>
                              <div className="flex items-center justify-between pt-3 border-t border-ink-200/40 dark:border-ink-700/40">
                                <div className="flex items-center gap-1 text-sm">
                                  <Star className="w-3.5 h-3.5 text-[#ff4f00] fill-[#ff4f00]" />
                                  <span className="font-semibold text-ink-primary dark:text-paper-light">
                                    {(recipe as any).averageRating ? ((recipe as any).averageRating).toFixed(1) : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-ink-secondary">
                                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" strokeWidth={1.5} />{recipe.prepTime + recipe.cookTime}p</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </article>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-11 px-5 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light disabled:opacity-30 disabled:cursor-not-allowed hover:ring-ink-primary/30 transition-all duration-700 ease-[var(--ease-fluid)] flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={1.5} /> Trước
                  </motion.button>
                  <span className="px-4 text-xs uppercase tracking-[0.2em] text-ink-secondary">
                    Trang {page} / {totalPages}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-11 px-5 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light disabled:opacity-30 disabled:cursor-not-allowed hover:ring-ink-primary/30 transition-all duration-700 ease-[var(--ease-fluid)] flex items-center gap-2"
                  >
                    Sau <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                  </motion.button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default FavoritesPage;