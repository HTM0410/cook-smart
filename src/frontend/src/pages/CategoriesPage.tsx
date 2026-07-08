import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import categoryService from '../services/categoryService';
import { Recipe } from '../types/recipe';
import FavoriteButton from '../components/atoms/FavoriteButton';
import { useAuth } from '../contexts/AuthContext';

const CategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const params = useParams<{ type?: string; name?: string }>();
  
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [totalRecipes, setTotalRecipes] = useState(0);
  
  // Use refs to track last search to prevent duplicate calls
  const lastSearchRef = useRef<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Memoize selected filters to prevent unnecessary re-renders
  const selectedCuisine = useMemo(() => {
    return params.type === 'cuisine' && params.name 
      ? decodeURIComponent(params.name) 
      : '';
  }, [params.type, params.name]);

  const selectedCourse = useMemo(() => {
    return params.type === 'course' && params.name 
      ? decodeURIComponent(params.name) 
      : '';
  }, [params.type, params.name]);

  const selectedTag = useMemo(() => {
    return params.type === 'tag' && params.name 
      ? decodeURIComponent(params.name) 
      : '';
  }, [params.type, params.name]);

  // Create search key to track if search params changed
  const searchKey = useMemo(() => {
    return JSON.stringify({
      cuisine: selectedCuisine,
      course: selectedCourse,
      tag: selectedTag,
      type: params.type,
      name: params.name,
    });
  }, [selectedCuisine, selectedCourse, selectedTag, params.type, params.name]);

  // Cleanup: abort requests when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadRecipes = useCallback(async () => {
    // Cancel previous request if exists
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Check if this is a duplicate request
    if (lastSearchRef.current === searchKey) {
      return;
    }

    // Skip if no category selected
    if (!params.type || !params.name) {
      setRecipes([]);
      setTotalRecipes(0);
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    lastSearchRef.current = searchKey;

    try {
      setRecipesLoading(true);
      const response = await categoryService.searchRecipesByCategory({
        cuisine: selectedCuisine || undefined,
        course: selectedCourse || undefined,
        tags: selectedTag ? [selectedTag] : undefined,
        limit: 1000, // Load tất cả để hiển thị đúng số lượng
        page: 1,
      }, abortController.signal);
      
      // Check if request was aborted
      if (abortController.signal.aborted) {
        return;
      }
      
      const recipesList = response.data?.recipes || [];
      const total = response.data?.pagination?.total || recipesList.length;
      setRecipes(recipesList);
      setTotalRecipes(total);
    } catch (error: any) {
      // Ignore abort errors
      if (error.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      console.error('Error loading recipes:', error);
      setRecipes([]);
      setTotalRecipes(0);
    } finally {
      if (!abortController.signal.aborted) {
        setRecipesLoading(false);
        abortControllerRef.current = null;
      }
    }
  }, [selectedCuisine, selectedCourse, selectedTag, params.type, params.name, searchKey]);

  useEffect(() => {
    // If we have URL params (from direct navigation), load recipes immediately
    if (params.type && params.name) {
      loadRecipes();
    } else {
      // Clear recipes if no category
      setRecipes([]);
      setTotalRecipes(0);
      lastSearchRef.current = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]); // Only depend on searchKey to prevent multiple calls

  const isCategoryPage = params.type && params.name; // True when viewing a specific category

  // If no category selected, redirect to home or show message
  if (!isCategoryPage) {
    return (
      <div className="min-h-screen bg-paper-light dark:bg-ink-800">
        <div className="container py-32 md:py-40">
          <div className="max-w-md mx-auto text-center space-y-6">
            <span className="eyebrow-tag inline-flex">Phân loại</span>
            <h1 className="text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
              Chọn danh mục.
            </h1>
            <p className="text-ink-secondary text-pretty">
              Vui lòng chọn một phân loại từ menu để xem món ăn.
            </p>
            <Link
              to="/"
              className="btn-editorial-primary inline-flex"
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Render category-specific page (like "MÓN CHAY" page)
  if (isCategoryPage) {
    const categoryName = decodeURIComponent(params.name || '');

    return (
      <div className="min-h-screen bg-paper-light dark:bg-ink-800">
        {/* Hero Editorial */}
        <section className="relative pt-32 md:pt-40 pb-12 md:pb-16">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center space-y-5">
              <span className="eyebrow-tag inline-flex">Phân loại</span>
              <h1 className="text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
                {categoryName}
              </h1>
              <p className="text-lg md:text-xl text-ink-secondary text-pretty">
                Khám phá các món ăn thuộc phân loại {categoryName}
              </p>
            </div>
          </div>
        </section>

        {/* Breadcrumb */}
        <div className="container py-4 border-y border-ink-200/40 dark:border-ink-700/40">
          <nav className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-ink-secondary">
            <Link to="/" className="hover:text-ink-primary dark:hover:text-paper-light transition-colors link-underline">
              Trang chủ
            </Link>
            <span>/</span>
            <Link to="/categories" className="hover:text-ink-primary dark:hover:text-paper-light transition-colors link-underline">
              Phân loại
            </Link>
            <span>/</span>
            <span className="text-ink-primary dark:text-paper-light">{categoryName}</span>
          </nav>
        </div>

        {/* Recipes Section */}
        <div className="container py-12 md:py-16">
          {recipesLoading ? (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-ink-700 border-t-transparent mx-auto mb-4"></div>
              <p className="text-ink-secondary text-sm uppercase tracking-[0.2em]">Đang tải...</p>
            </div>
          ) : recipes.length > 0 ? (
            <>
              <div className="mb-10 flex items-end justify-between">
                <h2 className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light">
                  <span className="text-[#ff4f00]">{totalRecipes}</span> món ăn
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {recipes.map((recipe) => (
                  <Link key={recipe.id} to={`/recipes/${recipe.id}`} className="group block relative">
                    <article className="card-bezel h-full">
                      <div className="card-bezel-inner p-0 overflow-hidden h-full flex flex-col">
                        <div className="relative h-48 overflow-hidden">
                          {recipe.imageUrl ? (
                            <img
                              src={recipe.imageUrl}
                              alt={recipe.recipeName}
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.onerror = null
                                target.src = `https://source.unsplash.com/400x300/?${encodeURIComponent(recipe.recipeName)},food`
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                              <span className="text-4xl">🍳</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-ink-700/30 to-transparent" />

                          <div
                            className="absolute top-3 right-3 z-10"
                            onClick={(e) => e.preventDefault()}
                          >
                            <FavoriteButton
                              recipeId={recipe.id}
                              initialFavoriteCount={0}
                              initialIsFavorited={false}
                              userId={user?.id}
                              size="sm"
                              showCount={false}
                              showTooltip={false}
                            />
                          </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light mb-2 line-clamp-2 group-hover:text-[#ff4f00] transition-colors">{recipe.recipeName}</h3>
                          <p className="text-sm text-ink-secondary mb-4 line-clamp-2 flex-1">
                            {recipe.description || 'Món ăn ngon miệng, dễ làm tại nhà'}
                          </p>

                          <div className="flex items-center gap-1 mb-3">
                            {Array.from({ length: 5 }).map((_, i) => {
                              const rating = recipe.averageRating ?? 0;
                              const filled = i < Math.round(rating);
                              return (
                                <svg
                                  key={i}
                                  className={`w-3.5 h-3.5 ${filled ? 'text-[#ff4f00] fill-current' : 'text-ink-200'}`}
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                  />
                                </svg>
                              );
                            })}
                            <span className="text-xs font-semibold text-ink-primary dark:text-paper-light ml-1">
                              {(recipe.averageRating ?? 0).toFixed(1)}
                            </span>
                            <span className="text-xs text-ink-muted ml-1">
                              ({recipe.reviewCount ?? 0})
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-ink-200/40 dark:border-ink-700/40">
                            <div className="flex items-center gap-3 text-xs text-ink-secondary">
                              <span>{(recipe.prepTime || 0) + (recipe.cookTime || 0)}p</span>
                              <span>{recipe.servings || 0} người</span>
                            </div>
                            <span className={`eyebrow-tag ${
                              recipe.difficulty === 'easy'
                                ? 'bg-[#EDF3EC] text-[#346538]'
                                : recipe.difficulty === 'medium'
                                ? 'bg-[#FBF3DB] text-[#956400]'
                                : 'bg-[#FDEBEC] text-[#9F2F2D]'
                            }`}>
                              {recipe.difficulty === 'easy' ? 'Dễ' : recipe.difficulty === 'medium' ? 'Vừa' : 'Khó'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state py-20">
              <p className="text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light mb-3">
                Chưa có món nào.
              </p>
              <p className="text-ink-secondary mb-8 max-w-md mx-auto text-pretty">
                Chưa có món ăn nào thuộc phân loại {categoryName}.
              </p>
              <Link to="/recipes" className="btn-editorial-primary inline-flex">
                Xem tất cả
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default CategoriesPage;

