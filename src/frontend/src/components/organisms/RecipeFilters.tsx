import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import recipeService from '../../services/recipeService';
import categoryService, { RecipeCategory } from '../../services/categoryService';
import { Check, Search, X } from 'lucide-react';
import { EyebrowTag } from '../atoms/EyebrowTag';
import { easeFluid } from '../../lib/motion';

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
    { value: 'easy', label: 'Dễ', color: 'bg-[#EDF3EC] text-[#346538]' },
    { value: 'medium', label: 'Trung bình', color: 'bg-[#FBF3DB] text-[#956400]' },
    { value: 'hard', label: 'Khó', color: 'bg-[#FDEBEC] text-[#9F2F2D]' }
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
    <div className={`card-bezel ${className}`}>
      <div className="card-bezel-inner p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 text-base font-semibold text-ink-primary dark:text-paper-light hover:text-[#ff4f00] transition-colors duration-700 ease-[var(--ease-fluid)] group"
        >
          <span>Bộ lọc nâng cao</span>
          <motion.svg
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.5, ease: easeFluid }}
            className="w-4 h-4"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </motion.svg>
        </button>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-xs uppercase tracking-[0.2em] text-[#9F2F2D] hover:text-[#9F2F2D]/70 link-underline"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Filters */}
      <AnimatePresence initial={false}>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.6, ease: easeFluid }}
          className="overflow-hidden"
        >
        <div className="space-y-6">
          <div className="space-y-4">
            {/* Input thêm nguyên liệu + hiển thị danh sách */}
            <div className="relative">
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                Hiển thị các món với nguyên liệu
              </label>
              <div className="flex gap-2">
                <div className="input-bezel flex-1">
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
                    className="input-bezel-inner h-11 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addIngredientToken('include')}
                  className="btn-editorial-ghost"
                >
                  Thêm
                </button>
              </div>

              {/* Autocomplete dropdown cho include */}
              {includeSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 card-bezel">
                  <div className="card-bezel-inner py-1 max-h-48 overflow-y-auto bg-white dark:bg-ink-800">
                    {includeSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => addIngredientToken('include', suggestion)}
                        className="w-full px-4 py-2 text-left hover:bg-paper-light dark:hover:bg-ink-700 transition-colors duration-300 text-sm flex items-center gap-2 border-b border-ink-200/40 dark:border-ink-700/40 last:border-b-0 text-ink-primary dark:text-paper-light"
                      >
                        <Search className="w-3.5 h-3.5 text-ink-secondary" strokeWidth={1.5} />
                        <span className="font-medium">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

              {/* Nút Tìm kiếm - luôn hiển thị nếu có callback */}
              {onSearch && (
                <button
                  type="button"
                  onClick={() => {
                    const pendingValue = includeIngredient.trim();
                    if (pendingValue) {
                      addIngredientToken('include', pendingValue);
                    }
                    onSearch(pendingValue || undefined);
                  }}
                  disabled={
                    !hasQuery &&
                    primaryIngredients.length === 0 &&
                    (!filters.ingredients || filters.ingredients.length === 0) &&
                    !includeIngredient.trim()
                  }
                  className="w-full mt-3 btn-editorial-primary justify-between disabled:opacity-30"
                >
                  Tìm kiếm món ăn
                </button>
              )}
              {/* Hiển thị TẤT CẢ nguyên liệu */}
              {(primaryIngredients.length > 0 || (filters.ingredients && filters.ingredients.length > 0)) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {/* Nguyên liệu từ search bar chính */}
                  {primaryIngredients.map((item) => (
                    <span key={`primary-${item}`} className="chip chip-active">
                      {item}
                      {onPrimaryIngredientRemove && (
                        <button
                          type="button"
                          className="ml-1"
                          onClick={() => onPrimaryIngredientRemove(item)}
                          aria-label={`Xóa ${item}`}
                        >
                          <X className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      )}
                    </span>
                  ))}
                  {/* Nguyên liệu thêm từ bộ lọc nâng cao */}
                  {filters.ingredients?.map((item) => (
                    <span key={`filter-${item}`} className="chip">
                      {item}
                      <button
                        type="button"
                        className="ml-1"
                        onClick={() => removeIngredientToken('include', item)}
                      >
                        <X className="w-3 h-3" strokeWidth={1.5} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                Ẩn các món có nguyên liệu
              </label>
              <div className="flex gap-2">
                <div className="input-bezel flex-1">
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
                    className="input-bezel-inner h-11 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addIngredientToken('exclude')}
                  className="btn-editorial-ghost"
                >
                  Thêm
                </button>
              </div>

              {/* Autocomplete dropdown cho exclude */}
              {excludeSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 z-50 mt-1 card-bezel">
                  <div className="card-bezel-inner py-1 max-h-48 overflow-y-auto bg-white dark:bg-ink-800">
                    {excludeSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => addIngredientToken('exclude', suggestion)}
                        className="w-full px-4 py-2 text-left hover:bg-paper-light dark:hover:bg-ink-700 transition-colors duration-300 text-sm flex items-center gap-2 border-b border-ink-200/40 dark:border-ink-700/40 last:border-b-0 text-ink-primary dark:text-paper-light"
                      >
                        <Search className="w-3.5 h-3.5 text-ink-secondary" strokeWidth={1.5} />
                        <span className="font-medium">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filters.excludeIngredients && filters.excludeIngredients.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {filters.excludeIngredients.map((item) => (
                    <span key={item} className="chip">
                      {item}
                      <button
                        type="button"
                        className="ml-1"
                        onClick={() => removeIngredientToken('exclude', item)}
                      >
                        <X className="w-3 h-3" strokeWidth={1.5} />
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
                <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                  Ẩm thực
                </label>
                <div className="relative">
                  <select
                    value={filters.cuisine || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilters(prev => ({
                        ...prev,
                        cuisine: value || undefined
                      }));
                    }}
                    className="w-full h-11 pl-4 pr-10 text-sm rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-700 ease-[var(--ease-fluid)] font-medium"
                  >
                    <option value="">Tất cả ẩm thực</option>
                    {categories.cuisines.map(category => (
                      <option key={category.id} value={category.categoryName}>
                        {category.categoryName}
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Course */}
            {categories.courses.length > 0 && (
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                  Loại món
                </label>
                <div className="relative">
                  <select
                    value={filters.course || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFilters(prev => ({
                        ...prev,
                        course: value || undefined
                      }));
                    }}
                    className="w-full h-11 pl-4 pr-10 text-sm rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-700 ease-[var(--ease-fluid)] font-medium"
                  >
                    <option value="">Tất cả loại món</option>
                    {categories.courses.map(category => (
                      <option key={category.id} value={category.categoryName}>
                        {category.categoryName}
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            )}

            {/* Tags */}
            {categories.tags.length > 0 && (
              <div>
                <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                  Tags
                </label>

                {/* Search box for tags */}
                <div className="relative mb-3">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary" strokeWidth={1.5} />
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={(e) => setTagSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm tags..."
                    className="w-full h-11 pl-11 pr-4 text-sm rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-700 ease-[var(--ease-fluid)]"
                  />
                </div>

                {/* Tags checkbox list */}
                <div className="max-h-[200px] overflow-y-auto rounded-2xl p-3 bg-paper-light dark:bg-ink-700/40 ring-1 ring-ink-200/40 dark:ring-ink-700/40">
                  {filteredTags.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {filteredTags.map(category => {
                        const isSelected = filters.tags?.includes(category.categoryName) || false;
                        return (
                          <label
                            key={category.id}
                            className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all duration-300 ease-[var(--ease-fluid)] ring-1 ${isSelected ? 'bg-[#fff4ed] dark:bg-primary-900/30 ring-[#ff4f00] text-[#ff4f00]' : 'ring-transparent hover:ring-ink-200 dark:hover:ring-ink-700 text-ink-primary dark:text-paper-light'}`}
                          >
                            <div className="relative flex-shrink-0">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleCategory('tag', category.categoryName)}
                                className="sr-only"
                              />
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-[#ff4f00] border-[#ff4f00]' : 'bg-white dark:bg-ink-800 border-ink-200 dark:border-ink-600'}`}>
                                {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                              </div>
                            </div>
                            <span className={`text-sm font-medium flex-1 truncate ${isSelected ? 'text-[#ff4f00]' : ''}`}>
                              {category.categoryName}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-ink-secondary text-sm">
                      Không tìm thấy tag nào
                    </div>
                  )}
                </div>

                {filters.tags && filters.tags.length > 0 && (
                  <p className="mt-2 text-xs text-ink-secondary">
                    Đã chọn: {filters.tags.length} tag{filters.tags.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Difficulty */}
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-3 font-medium">
              Độ khó
            </label>
            <div className="flex flex-wrap gap-2">
              {difficultyOptions.map(option => (
                <button
                  key={option.value}
                  onClick={() => toggleDifficulty(option.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-500 ease-[var(--ease-fluid)] ${
                    filters.difficulty?.includes(option.value)
                      ? `${option.color} ring-2 ring-[#ff4f00]`
                      : 'ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-secondary hover:ring-ink-primary/30 hover:text-ink-primary dark:hover:text-paper-light'
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
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                Chuẩn bị tối đa (phút)
              </label>
              <div className="input-bezel">
                <input
                  type="number"
                  value={filters.prepTimeMax || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    prepTimeMax: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  placeholder="VD: 30"
                  min="0"
                  className="input-bezel-inner h-11 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                Nấu tối đa (phút)
              </label>
              <div className="input-bezel">
                <input
                  type="number"
                  value={filters.cookTimeMax || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    cookTimeMax: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  placeholder="VD: 60"
                  min="0"
                  className="input-bezel-inner h-11 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Servings Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                Khẩu phần tối thiểu
              </label>
              <div className="input-bezel">
                <input
                  type="number"
                  value={filters.servingsMin || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    servingsMin: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  placeholder="VD: 2"
                  min="1"
                  className="input-bezel-inner h-11 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-medium">
                Khẩu phần tối đa
              </label>
              <div className="input-bezel">
                <input
                  type="number"
                  value={filters.servingsMax || ''}
                  onChange={(e) => setFilters(prev => ({
                    ...prev,
                    servingsMax: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  placeholder="VD: 6"
                  min="1"
                  className="input-bezel-inner h-11 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Rating */}
          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-3 font-medium">
              Đánh giá tối thiểu
            </label>
            <div className="flex items-center gap-3">
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
                className="flex-1 accent-[#ff4f00]"
              />
              <span className="text-sm font-medium text-ink-primary dark:text-paper-light min-w-[60px] text-center">
                {filters.ratingMin ? `⭐ ${filters.ratingMin}+` : 'Tất cả'}
              </span>
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="pt-4 border-t border-ink-200/40 dark:border-ink-700/40">
              <p className="text-xs uppercase tracking-[0.2em] text-ink-secondary mb-3 font-medium">
                Bộ lọc đang áp dụng
              </p>
              <div className="flex flex-wrap gap-2">
                {filters.difficulty && filters.difficulty.length > 0 && (
                  <span className="chip">Độ khó: {filters.difficulty.join(', ')}</span>
                )}
                {filters.prepTimeMax && (
                  <span className="chip">Chuẩn bị ≤ {filters.prepTimeMax}p</span>
                )}
                {filters.cookTimeMax && (
                  <span className="chip">Nấu ≤ {filters.cookTimeMax}p</span>
                )}
                {filters.servingsMin && (
                  <span className="chip">Khẩu phần ≥ {filters.servingsMin}</span>
                )}
                {filters.servingsMax && (
                  <span className="chip">Khẩu phần ≤ {filters.servingsMax}</span>
                )}
                {filters.ratingMin && (
                  <span className="chip">⭐ {filters.ratingMin}+</span>
                )}
                {filters.cuisine && (
                  <span className="chip">Ẩm thực: {filters.cuisine}</span>
                )}
                {filters.course && (
                  <span className="chip">Loại: {filters.course}</span>
                )}
                {filters.tags && filters.tags.length > 0 && (
                  <span className="chip">Tags: {filters.tags.join(', ')}</span>
                )}
              </div>
            </div>
          )}
        </div>
        </motion.div>
      )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default RecipeFilters;

