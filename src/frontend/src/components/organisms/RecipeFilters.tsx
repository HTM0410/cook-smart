import React, { useEffect, useState, useMemo } from 'react';
import recipeService from '../../services/recipeService';
import categoryService, { RecipeCategory } from '../../services/categoryService';
import { Check, Search } from 'lucide-react';

export interface FilterState {
  categories?: string[];
  cuisine?: string;
  course?: string;
  tags?: string[];
  difficulty?: string[];
  prepTimeMax?: number;
  cookTimeMax?: number;
  servingsMin?: number;
  servingsMax?: number;
  ratingMin?: number;
  ingredients?: string[];
  excludeIngredients?: string[];
}

interface RecipeFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
  defaultExpanded?: boolean;
  className?: string;
  primaryIngredients?: string[];
  onPrimaryIngredientRemove?: (ingredient: string) => void;
  onSearch?: (pendingIngredient?: string) => void; // Truyền ingredient đang nhập nếu có
  hasQuery?: boolean; // Có query (tên món) từ search bar
}

const RecipeFilters: React.FC<RecipeFiltersProps> = ({
  onFilterChange,
  initialFilters = {},
  defaultExpanded = false,
  className = '',
  primaryIngredients = [],
  onPrimaryIngredientRemove,
  onSearch,
  hasQuery = false
}) => {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [includeIngredient, setIncludeIngredient] = useState('');
  const [excludeIngredient, setExcludeIngredient] = useState('');
  const [includeSuggestions, setIncludeSuggestions] = useState<string[]>([]);
  const [excludeSuggestions, setExcludeSuggestions] = useState<string[]>([]);
  const [categories, setCategories] = useState<{
    cuisines: RecipeCategory[];
    courses: RecipeCategory[];
    tags: RecipeCategory[];
  }>({
    cuisines: [],
    courses: [],
    tags: []
  });
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  // Fetch categories from backend
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const [cuisinesRes, coursesRes, tagsRes] = await Promise.all([
          categoryService.getAllCategories('cuisine'),
          categoryService.getAllCategories('course'),
          categoryService.getAllCategories('tag')
        ]);
        
        setCategories({
          cuisines: cuisinesRes.data?.categories || [],
          courses: coursesRes.data?.categories || [],
          tags: tagsRes.data?.categories || []
        });
      } catch (err) {
        console.error('Error fetching categories:', err);
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  // Autocomplete cho nguyên liệu "include"
  useEffect(() => {
    const fetchSuggestions = async () => {
      const query = includeIngredient.trim();
      console.log('🔍 Include autocomplete:', query, 'length:', query.length);
      
      if (query.length < 1) {
        setIncludeSuggestions([]);
        return;
      }

      try {
        console.log('📡 Fetching autocomplete for:', query);
        const response = await recipeService.autocompleteIngredients(query);
        console.log('✅ Autocomplete response:', response);
        
        // Response structure: { success, message, data: { suggestions: [{id, text, score}] } }
        if (response?.data?.suggestions && Array.isArray(response.data.suggestions)) {
          const suggestions = response.data.suggestions.map((item: any) => item.text || item.name);
          console.log('📝 Suggestions:', suggestions);
          setIncludeSuggestions(suggestions);
        } else {
          console.warn('⚠️ No suggestions in response:', response);
          setIncludeSuggestions([]);
        }
      } catch (err) {
        console.error('❌ Autocomplete error:', err);
        setIncludeSuggestions([]);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timeoutId);
  }, [includeIngredient]);

  // Autocomplete cho nguyên liệu "exclude"
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (excludeIngredient.trim().length < 1) {
        setExcludeSuggestions([]);
        return;
      }

      try {
        const response = await recipeService.autocompleteIngredients(excludeIngredient);
        
        // Response structure: { success, message, data: { suggestions: [{id, text, score}] } }
        if (response?.data?.suggestions && Array.isArray(response.data.suggestions)) {
          const suggestions = response.data.suggestions.map((item: any) => item.text || item.name);
          setExcludeSuggestions(suggestions);
        } else {
          setExcludeSuggestions([]);
        }
      } catch (err) {
        console.error('❌ Autocomplete error:', err);
        setExcludeSuggestions([]);
      }
    };

    const timeoutId = setTimeout(fetchSuggestions, 150);
    return () => clearTimeout(timeoutId);
  }, [excludeIngredient]);

  // Difficulty options
  const difficultyOptions = [
    { value: 'easy', label: 'Dễ', color: 'bg-green-100 text-green-800' },
    { value: 'medium', label: 'Trung bình', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'hard', label: 'Khó', color: 'bg-red-100 text-red-800' }
  ];


  // Update parent when filters change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFilterChange(filters);
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [filters, onFilterChange]);

  // Toggle difficulty
  const toggleDifficulty = (value: string) => {
    setFilters(prev => {
      const current = prev.difficulty || [];
      const updated = current.includes(value)
        ? current.filter(d => d !== value)
        : [...current, value];
      return { ...prev, difficulty: updated.length > 0 ? updated : undefined };
    });
  };

  // Toggle category (cuisine, course, tag)
  const toggleCategory = (type: 'cuisine' | 'course' | 'tag', categoryName: string) => {
    setFilters(prev => {
      if (type === 'cuisine' || type === 'course') {
        // Single selection for cuisine and course
        return { 
          ...prev, 
          [type]: prev[type] === categoryName ? undefined : categoryName 
        };
      } else {
        // Multiple selection for tags
        const current = prev.tags || [];
        const updated = current.includes(categoryName)
          ? current.filter(t => t !== categoryName)
          : [...current, categoryName];
        return { ...prev, tags: updated.length > 0 ? updated : undefined };
      }
    });
  };


  // Reset all filters
  const resetFilters = () => {
    setFilters({});
    setTagSearchQuery('');
  };

  // Check if any filter is active
  const hasActiveFilters = Object.keys(filters).length > 0;

  // Filter tags based on search query
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) {
      return categories.tags;
    }
    const query = tagSearchQuery.toLowerCase();
    return categories.tags.filter(tag => 
      tag.categoryName.toLowerCase().includes(query)
    );
  }, [categories.tags, tagSearchQuery]);

  const addIngredientToken = (type: 'include' | 'exclude', value?: string) => {
    const rawValue = value || (type === 'include' ? includeIngredient : excludeIngredient).trim();
    if (!rawValue) return;

    // Tách theo dấu phẩy nếu có nhiều nguyên liệu
    // VD: "gà, hành, tỏi" → ["gà", "hành", "tỏi"]
    const ingredientValues = rawValue.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (ingredientValues.length === 0) return;

    setFilters(prev => {
      const key = type === 'include' ? 'ingredients' : 'excludeIngredients';
      const current = prev[key] || [];
      // Lọc các nguyên liệu chưa có
      const newIngredients = ingredientValues.filter(v => !current.includes(v));
      if (newIngredients.length === 0) {
        return prev;
      }
      return { ...prev, [key]: [...current, ...newIngredients] };
    });

    if (type === 'include') {
      setIncludeIngredient('');
      setIncludeSuggestions([]);
    } else {
      setExcludeIngredient('');
      setExcludeSuggestions([]);
    }
  };

  const removeIngredientToken = (type: 'include' | 'exclude', value: string) => {
    const key = type === 'include' ? 'ingredients' : 'excludeIngredients';
    setFilters(prev => {
      const nextValues = (prev[key] || []).filter(item => item !== value);
      return { ...prev, [key]: nextValues.length > 0 ? nextValues : undefined };
    });
  };

  return (
    <div className={`card p-4 mb-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-lg font-semibold text-foreground hover:text-primary transition-colors"
        >
          <span>🔍 Bộ lọc nâng cao</span>
          <svg
            className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Filters */}
      {isExpanded && (
        <div className="space-y-6">
          <div className="space-y-4">
            {/* Input thêm nguyên liệu + hiển thị danh sách */}
            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-2">
                Hiển thị các món với nguyên liệu:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={includeIngredient}
                  onChange={event => setIncludeIngredient(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addIngredientToken('include');
                    }
                  }}
                  placeholder="VD: hành, tỏi, tiêu..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                />
                <button
                  type="button"
                  onClick={() => addIngredientToken('include')}
                  className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
                >
                  Thêm
                </button>
              </div>
              
              {/* Autocomplete dropdown cho include */}
              {includeSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border-2 border-primary/20 dark:border-primary/40 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                  {includeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => addIngredientToken('include', suggestion)}
                      className="w-full px-4 py-2.5 text-left hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors text-sm flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
              
              {/* Nút Tìm kiếm - luôn hiển thị nếu có callback */}
              {onSearch && (
                <button
                  type="button"
                  onClick={() => {
                    // Nếu có text trong input, tự động add vào filter trước khi search
                    const pendingValue = includeIngredient.trim();
                    if (pendingValue) {
                      addIngredientToken('include', pendingValue);
                    }
                    // Gọi onSearch với pending ingredient để xử lý ngay
                    onSearch(pendingValue || undefined);
                  }}
                  disabled={
                    !hasQuery && 
                    primaryIngredients.length === 0 && 
                    (!filters.ingredients || filters.ingredients.length === 0) &&
                    !includeIngredient.trim() // Cho phép search nếu có text trong input
                  }
                  className="w-full mt-3 px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Tìm kiếm món ăn
                </button>
              )}
              {/* Hiển thị TẤT CẢ nguyên liệu (từ search bar + từ bộ lọc) */}
              {(primaryIngredients.length > 0 || (filters.ingredients && filters.ingredients.length > 0)) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {/* Nguyên liệu từ search bar chính */}
                  {primaryIngredients.map((item) => (
                    <span key={`primary-${item}`} className="inline-flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                      {item}
                      {onPrimaryIngredientRemove && (
                        <button
                          type="button"
                          className="ml-2 hover:text-primary/70"
                          onClick={() => onPrimaryIngredientRemove(item)}
                          aria-label={`Xóa ${item}`}
                        >
                          ×
                        </button>
                      )}
                    </span>
                  ))}
                  {/* Nguyên liệu thêm từ bộ lọc nâng cao */}
                  {filters.ingredients?.map((item) => (
                    <span key={`filter-${item}`} className="inline-flex items-center bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                      {item}
                      <button
                        type="button"
                        className="ml-2 hover:text-primary/70"
                        onClick={() => removeIngredientToken('include', item)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-foreground mb-2">
                Ẩn các món có nguyên liệu:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={excludeIngredient}
                  onChange={event => setExcludeIngredient(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addIngredientToken('exclude');
                    }
                  }}
                  placeholder="VD: đậu phộng, gluten..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                />
                <button
                  type="button"
                  onClick={() => addIngredientToken('exclude')}
                  className="px-4 py-2 bg-muted text-foreground rounded-lg font-medium hover:bg-muted/80 transition-colors"
                >
                  Thêm
                </button>
              </div>
              
              {/* Autocomplete dropdown cho exclude */}
              {excludeSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-[9999] mt-1 bg-white dark:bg-gray-800 border-2 border-red-200 dark:border-red-800/40 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
                  {excludeSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => addIngredientToken('exclude', suggestion)}
                      className="w-full px-4 py-2.5 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-sm flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                    >
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="font-medium text-gray-700 dark:text-gray-200">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {filters.excludeIngredients && filters.excludeIngredients.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {filters.excludeIngredients.map((item) => (
                    <span key={item} className="inline-flex items-center bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                      {item}
                      <button
                        type="button"
                        className="ml-2 hover:text-gray-500"
                        onClick={() => removeIngredientToken('exclude', item)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

          {/* Categories */}
          <div className="space-y-4">
            {/* Cuisine */}
            {categories.cuisines.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Ẩm thực
                </label>
                <select
                  value={filters.cuisine || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters(prev => ({
                      ...prev,
                      cuisine: value || undefined
                    }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                >
                  <option value="">Tất cả ẩm thực</option>
                  {categories.cuisines.map(category => (
                    <option key={category.id} value={category.categoryName}>
                      {category.categoryName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Course */}
            {categories.courses.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Loại món
                </label>
                <select
                  value={filters.course || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilters(prev => ({
                      ...prev,
                      course: value || undefined
                    }));
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
                >
                  <option value="">Tất cả loại món</option>
                  {categories.courses.map(category => (
                    <option key={category.id} value={category.categoryName}>
                      {category.categoryName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Tags */}
            {categories.tags.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Tags
                </label>
                
                {/* Search box for tags */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm tags..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 text-sm"
                  />
                </div>

                {/* Tags checkbox list */}
                <div className="max-h-[200px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-800/50">
                  {filteredTags.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredTags.map(category => {
                        const isSelected = filters.tags?.includes(category.categoryName) || false;
                        return (
                          <label
                            key={category.id}
                            className={`
                              flex items-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer transition-all duration-200
                              ${isSelected
                                ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-600'
                                : 'bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600 hover:border-orange-300 dark:hover:border-orange-600'
                              }
                            `}
                          >
                            {/* Custom Checkbox */}
                            <div className="relative flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCategory('tag', category.categoryName)}
                                className="sr-only"
                              />
                              <div
                                className={`
                                  w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200
                                  ${isSelected
                                    ? 'bg-orange-500 border-orange-500'
                                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
                                  }
                                `}
                              >
                                {isSelected && (
                                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                )}
                              </div>
                            </div>

                            {/* Tag Name */}
                            <span className={`
                              text-sm font-medium flex-1
                              ${isSelected
                                ? 'text-orange-700 dark:text-orange-300'
                                : 'text-gray-700 dark:text-gray-300'
                              }
                            `}>
                              {category.categoryName}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                      Không tìm thấy tag nào
                    </div>
                  )}
                </div>

                {/* Selected tags count */}
                {filters.tags && filters.tags.length > 0 && (
                  <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Đã chọn: {filters.tags.length} tag{filters.tags.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Độ khó
            </label>
            <div className="flex flex-wrap gap-2">
              {difficultyOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleDifficulty(option.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    filters.difficulty?.includes(option.value)
                      ? option.color + ' ring-2 ring-offset-2 ring-primary'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Thời gian chuẩn bị tối đa (phút)
              </label>
              <input
                type="number"
                value={filters.prepTimeMax || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  prepTimeMax: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                placeholder="VD: 30"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Thời gian nấu tối đa (phút)
              </label>
              <input
                type="number"
                value={filters.cookTimeMax || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  cookTimeMax: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                placeholder="VD: 60"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Servings Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Số khẩu phần tối thiểu
              </label>
              <input
                type="number"
                value={filters.servingsMin || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  servingsMin: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                placeholder="VD: 2"
                min="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Số khẩu phần tối đa
              </label>
              <input
                type="number"
                value={filters.servingsMax || ''}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  servingsMax: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                placeholder="VD: 6"
                min="1"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Đánh giá tối thiểu
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={filters.ratingMin || 0}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  ratingMin: parseFloat(e.target.value) || undefined
                }))}
                className="flex-1"
              />
              <span className="text-sm font-medium text-foreground min-w-[60px] text-center">
                {filters.ratingMin ? `⭐ ${filters.ratingMin}+` : 'Tất cả'}
              </span>
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="pt-4 border-t border-border">
              <p className="text-sm font-medium text-foreground mb-2">
                Bộ lọc đang áp dụng:
              </p>
              <div className="flex flex-wrap gap-2">
                {filters.difficulty && filters.difficulty.length > 0 && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    Độ khó: {filters.difficulty.join(', ')}
                  </span>
                )}
                {filters.prepTimeMax && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                    Chuẩn bị ≤ {filters.prepTimeMax} phút
                  </span>
                )}
                {filters.cookTimeMax && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                    Nấu ≤ {filters.cookTimeMax} phút
                  </span>
                )}
                {filters.servingsMin && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    Khẩu phần ≥ {filters.servingsMin}
                  </span>
                )}
                {filters.servingsMax && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                    Khẩu phần ≤ {filters.servingsMax}
                  </span>
                )}
                {filters.ratingMin && (
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                    ⭐ {filters.ratingMin}+
                  </span>
                )}
                {filters.cuisine && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                    Ẩm thực: {filters.cuisine}
                  </span>
                )}
                {filters.course && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                    Loại món: {filters.course}
                  </span>
                )}
                {filters.tags && filters.tags.length > 0 && (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                    Tags: {filters.tags.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecipeFilters;

