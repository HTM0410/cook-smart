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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container py-12">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">Phân loại món ăn</h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Vui lòng chọn một phân loại từ menu "Phân loại" ở trên để xem món ăn
            </p>
            <Link
              to="/"
              className="inline-block px-6 py-3 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
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
      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800 py-16 md:py-24">
          <div className="container">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-4">
                {categoryName.toUpperCase()}
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300">
                Khám phá các món ăn thuộc phân loại {categoryName}
              </p>
            </div>
          </div>
        </section>

        {/* Breadcrumb */}
        <div className="container py-4 border-b border-gray-200 dark:border-gray-700">
          <nav className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Link to="/" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              Trang chủ
            </Link>
            <span>/</span>
            <Link to="/categories" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              Phân loại
            </Link>
            <span>/</span>
            <span className="text-gray-900 dark:text-white">{categoryName}</span>
          </nav>
        </div>

        {/* Recipes Section */}
        <div className="container py-8">
          {recipesLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Đang tải món ăn...</p>
            </div>
          ) : recipes.length > 0 ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Tìm thấy {totalRecipes} món ăn
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipes.map((recipe) => (
                  <div key={recipe.id} className="block relative">
                    <Link to={`/recipes/${recipe.id}`}>
                      <div className="card p-0 hover:shadow-lg transition-shadow overflow-hidden h-full">
                        <div className="relative h-48">
                          {recipe.imageUrl ? (
                            <img 
                              src={recipe.imageUrl} 
                              alt={recipe.recipeName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.onerror = null
                                target.src = `https://source.unsplash.com/400x300/?${encodeURIComponent(recipe.recipeName)},food`
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30 flex items-center justify-center">
                              <span className="text-4xl">🍳</span>
                            </div>
                          )}
                          {/* Favorite Button */}
                          <div 
                            className="absolute top-3 right-3 z-10"
                            onClick={(e) => e.preventDefault()}
                          >
                            <FavoriteButton
                              recipeId={recipe.id}
                              initialFavoriteCount={0}
                              initialIsFavorited={false}
                              userId={user?.id}
                              size="md"
                              showCount={false}
                              showTooltip={true}
                            />
                          </div>
                        </div>
                        <div className="p-6">
                          <h3 className="text-lg font-semibold mb-2 line-clamp-1">{recipe.recipeName}</h3>
                          <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                            {recipe.description || 'Món ăn ngon miệng, dễ làm tại nhà'}
                          </p>
                          
                          {/* Rating - Luôn hiển thị */}
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex items-center gap-1">
                              {Array.from({ length: 5 }).map((_, i) => {
                                const rating = recipe.averageRating ?? 0;
                                const filled = i < Math.round(rating);
                                return (
                                  <svg
                                    key={i}
                                    className={`w-4 h-4 ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300 dark:text-gray-600'}`}
                                    viewBox="0 0 24 24"
                                    stroke={filled ? 'none' : 'currentColor'}
                                    strokeWidth={filled ? 0 : 1.5}
                                    fill={filled ? 'currentColor' : 'none'}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                    />
                                  </svg>
                                );
                              })}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {(recipe.averageRating ?? 0).toFixed(1)}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({(recipe.reviewCount ?? 0)})
                            </span>
                          </div>

                          {/* Categories */}
                          {recipe.categories && recipe.categories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {recipe.categories.slice(0, 2).map((category: any) => (
                                <span
                                  key={category.id}
                                  className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2.5 py-1 text-xs font-medium text-orange-700 dark:text-orange-400"
                                >
                                  {category.categoryName}
                                </span>
                              ))}
                              {recipe.categories.length > 2 && (
                                <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                                  +{recipe.categories.length - 2}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Meta Info */}
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-4 text-muted-foreground">
                              <span>{(recipe.prepTime || 0) + (recipe.cookTime || 0)} phút</span>
                              <span>{recipe.servings || 0} người</span>
                            </div>
                            <span
                              className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${
                                recipe.difficulty === 'easy'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : recipe.difficulty === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              {recipe.difficulty === 'easy'
                                ? 'Dễ'
                                : recipe.difficulty === 'medium'
                                ? 'Trung bình'
                                : 'Khó'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 dark:text-gray-400 mb-4 text-lg">
                Chưa có món ăn nào thuộc phân loại {categoryName}
              </p>
              <Link
                to="/categories"
                className="inline-block px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
              >
                Xem tất cả phân loại
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

