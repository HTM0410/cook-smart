import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import RecipeFilters, { FilterState } from './RecipeFilters'
import recipeService from '../../services/recipeService'
import { IngredientMatchRecipe, Recipe as RecipeType } from '../../types/recipe'
import FavoriteButton from '../atoms/FavoriteButton'
import { useAuth } from '../../contexts/AuthContext'

interface HomeSearchSectionProps {
  sectionId?: string
}

// Hàm decode an toàn, thử decode nhiều lần nếu cần
const safeDecode = (value: string | null): string | undefined => {
  if (!value) return undefined
  try {
    // URLSearchParams đã decode một lần, nhưng nếu bị double encode thì cần decode thêm
    let decoded = value
    // Thử decode tối đa 3 lần để xử lý double/triple encoding
    for (let i = 0; i < 3; i++) {
      const prev = decoded
      decoded = decodeURIComponent(decoded)
      // Nếu không thay đổi sau khi decode, dừng lại
      if (prev === decoded) break
    }
    return decoded
  } catch {
    // Nếu decode lỗi, trả về giá trị gốc
    return value
  }
}

const parseFilters = (search: string): { ingredients: string[]; query?: string; filters: FilterState; sortBy: string } => {
  const params = new URLSearchParams(search)
  const urlFilters: FilterState = {}

  const ingredientsParam = params.get('ingredients')
  const ingredients = ingredientsParam ? ingredientsParam.split(',').map((value) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }) : []
  const queryParam = params.get('query') || params.get('keyword')
  const query = safeDecode(queryParam)
  const sortBy = params.get('sortBy') || 'relevance'

  if (params.get('difficulty')) urlFilters.difficulty = params.get('difficulty')!.split(',')
  if (params.get('prepTimeMax')) urlFilters.prepTimeMax = parseInt(params.get('prepTimeMax')!)
  if (params.get('cookTimeMax')) urlFilters.cookTimeMax = parseInt(params.get('cookTimeMax')!)
  if (params.get('servingsMin')) urlFilters.servingsMin = parseInt(params.get('servingsMin')!)
  if (params.get('servingsMax')) urlFilters.servingsMax = parseInt(params.get('servingsMax')!)
  if (params.get('ratingMin')) urlFilters.ratingMin = parseFloat(params.get('ratingMin')!)
  // dietary filter removed - not in FilterState
  if (params.get('include')) urlFilters.ingredients = params.get('include')!.split(',').map((value) => decodeURIComponent(value))
  if (params.get('exclude')) urlFilters.excludeIngredients = params.get('exclude')!.split(',').map((value) => decodeURIComponent(value))
  if (params.get('cuisine')) urlFilters.cuisine = decodeURIComponent(params.get('cuisine')!)
  if (params.get('course')) urlFilters.course = decodeURIComponent(params.get('course')!)
  if (params.get('tags')) urlFilters.tags = params.get('tags')!.split(',').map((value) => decodeURIComponent(value))

  return { ingredients, query, filters: urlFilters, sortBy }
}

const HomeSearchSection: React.FC<HomeSearchSectionProps> = ({ sectionId = 'search-section' }) => {
  const { user } = useAuth()
  const location = useLocation()
  const initialDataRef = useRef(parseFilters(location.search))

  const [ingredients, setIngredients] = useState<string[]>(initialDataRef.current.ingredients)
  const [query, setQuery] = useState<string | undefined>(initialDataRef.current.query)
  const [currentIngredient, setCurrentIngredient] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [results, setResults] = useState<IngredientMatchRecipe[]>([])
  const [missingIngredients, setMissingIngredients] = useState<string[]>([])
  const [matchedIngredients, setMatchedIngredients] = useState<Array<{ id: number; name: string }>>([])
  const [allMatchedIngredients, setAllMatchedIngredients] = useState<Array<{ id: number; name: string }>>([]) // Lưu tất cả nguyên liệu gốc
  const [excludedIngredientIds, setExcludedIngredientIds] = useState<Set<number>>(new Set())
  const [suggestedRecipes, setSuggestedRecipes] = useState<RecipeType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchType, setSearchType] = useState<'keyword' | 'ingredients' | null>(null) // Track loại tìm kiếm
  const [sortBy, setSortBy] = useState<string>(initialDataRef.current.sortBy)
  const [filters, setFilters] = useState<FilterState>({
    ...initialDataRef.current.filters
  })
  const [autoSearchQueued, setAutoSearchQueued] = useState(
    initialDataRef.current.ingredients.length > 0 || !!initialDataRef.current.query
  )
  
  // Ref để track lần search cuối cùng và tránh duplicate requests
  const lastSearchRef = useRef<string>('')
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLoadingRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Key để lưu search results vào sessionStorage
  const SEARCH_RESULTS_KEY = 'cooksmart_search_results'
  const SEARCH_PARAMS_KEY = 'cooksmart_search_params'

  useEffect(() => {
    const paramsData = parseFilters(location.search)
    setIngredients(paramsData.ingredients)
    setQuery(paramsData.query)
    setSortBy(paramsData.sortBy)
    setFilters(paramsData.filters)
    
    // Thử restore search results từ sessionStorage trước
    try {
      const savedParams = sessionStorage.getItem(SEARCH_PARAMS_KEY)
      const savedResults = sessionStorage.getItem(SEARCH_RESULTS_KEY)
      
      if (savedParams && savedResults) {
        const params = JSON.parse(savedParams)
        // Normalize URLs để so sánh (loại bỏ trailing slash, normalize search params)
        const normalizeUrl = (url: string) => {
          // Nếu là full URL, chỉ lấy search params
          if (url.includes('?')) {
            return url.split('?')[1] || ''
          }
          // Nếu là search params (bắt đầu bằng ?), loại bỏ ?
          return url.startsWith('?') ? url.substring(1) : url
        }
        
        const savedUrl = normalizeUrl(params.url || '')
        const currentUrl = normalizeUrl(location.search)
        
        console.log('🔍 Checking restore:', { savedUrl, currentUrl, match: savedUrl === currentUrl })
        
        // Nếu URL params khớp với params đã lưu, restore results và KHÔNG trigger auto search
        if (savedUrl === currentUrl && savedUrl.length > 0) {
          const results = JSON.parse(savedResults)
          setResults(results.recipes || [])
          setMissingIngredients(results.missingIngredients || [])
          setMatchedIngredients(results.matchedIngredients || [])
          setAllMatchedIngredients(results.allMatchedIngredients || [])
          setSuggestedRecipes(results.suggestedRecipes || [])
          setAutoSearchQueued(false) // Không trigger auto search nếu đã restore
          console.log('✅ Restored search results from sessionStorage', results.recipes?.length || 0, 'recipes')
          lastSearchRef.current = '' // Reset để có thể search lại nếu cần
          return // Dừng ở đây, không trigger auto search
        }
      }
    } catch (error) {
      console.error('Error restoring search results:', error)
    }
    
    // Nếu không restore được, trigger auto search như bình thường
    setAutoSearchQueued(paramsData.ingredients.length > 0 || !!paramsData.query)
    // Reset last search khi URL thay đổi
    lastSearchRef.current = ''
  }, [location.search])

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (currentIngredient.trim().length < 2) {
        setSuggestions([])
        return
      }

      try {
        const response = await recipeService.autocompleteIngredients(currentIngredient)
        const payload = response.data as any
        if (payload?.data?.suggestions) {
          setSuggestions(payload.data.suggestions.map((item: any) => item.text || item.name))
        }
      } catch (err) {
        console.error('Autocomplete error:', err)
      }
    }

    const timeoutId = setTimeout(fetchSuggestions, 250)
    return () => clearTimeout(timeoutId)
  }, [currentIngredient])

  const addIngredient = (ingredient: string) => {
    // Tách theo dấu phẩy nếu người dùng nhập nhiều nguyên liệu
    // VD: "hành, tỏi, tiêu" → ["hành", "tỏi", "tiêu"]
    const parts = ingredient.split(',').map(s => s.trim()).filter(s => s.length > 0)
    
    // Lọc các nguyên liệu chưa có trong danh sách
    const newIngredients = parts.filter(part => !ingredients.includes(part))
    
    if (newIngredients.length > 0) {
      setIngredients((prev) => [...prev, ...newIngredients])
      setCurrentIngredient('')
      setSuggestions([])
    }
  }

  const removeIngredient = (ingredient: string) => {
    setIngredients((prev) => prev.filter((item) => item !== ingredient))
  }

  const buildURLFromState = () => {
    const params = new URLSearchParams()

    if (query) {
      // Đảm bảo query đã được decode trước khi encode lại
      const cleanQuery = query.trim()
      // URLSearchParams.set() tự động encode, không cần encodeURIComponent
      params.set('query', cleanQuery)
    } else if (ingredients.length > 0) {
      params.set(
        'ingredients',
        ingredients
          .map((value) => value.trim())
          .filter(Boolean)
          .join(',')
      )
    }

    if (sortBy !== 'relevance') params.set('sortBy', sortBy)
    if (filters.difficulty?.length) params.set('difficulty', filters.difficulty.join(','))
    if (filters.prepTimeMax) params.set('prepTimeMax', filters.prepTimeMax.toString())
    if (filters.cookTimeMax) params.set('cookTimeMax', filters.cookTimeMax.toString())
    if (filters.servingsMin) params.set('servingsMin', filters.servingsMin.toString())
    if (filters.servingsMax) params.set('servingsMax', filters.servingsMax.toString())
    if (filters.ratingMin) params.set('ratingMin', filters.ratingMin.toString())
    if (filters.cuisine) params.set('cuisine', filters.cuisine)
    if (filters.course) params.set('course', filters.course)
    if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','))
    // dietary filter removed - not in FilterState
    if (filters.ingredients?.length) {
      // URLSearchParams.set() tự động encode
      params.set(
        'include',
        filters.ingredients
          .map((value) => value.trim())
          .filter(Boolean)
          .join(',')
      )
    }
    if (filters.excludeIngredients?.length) {
      // URLSearchParams.set() tự động encode
      params.set(
        'exclude',
        filters.excludeIngredients
          .map((value) => value.trim())
          .filter(Boolean)
          .join(',')
      )
    }

    return params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname
  }

  const sortRecipes = (list: IngredientMatchRecipe[], mode: string) => {
    const sorted = [...list]
    switch (mode) {
      case 'rating':
        return sorted.sort((a, b) => {
          const ratingA = typeof a.averageRating === 'number' ? a.averageRating : Number(a.averageRating) || 0;
          const ratingB = typeof b.averageRating === 'number' ? b.averageRating : Number(b.averageRating) || 0;
          return ratingB - ratingA;
        })
      case 'popularity':
        return sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
      case 'recency':
        return sorted.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
          return dateB - dateA
        })
      case 'difficulty':
        const order = ['easy', 'medium', 'hard']
        return sorted.sort((a, b) => order.indexOf(a.difficulty) - order.indexOf(b.difficulty))
      default:
        return list
    }
  }

  const searchRecipes = useCallback(
    async ({ updateUrl = true, force = false, extraIngredients = [] }: { updateUrl?: boolean; force?: boolean; extraIngredients?: string[] } = {}) => {
      // Tạo search key để tránh duplicate requests
      const searchKey = JSON.stringify({ query, ingredients, filters, sortBy, extraIngredients })
      
      // Chỉ skip nếu không force và đã search với cùng params (và không update URL)
      if (!force && lastSearchRef.current === searchKey && !updateUrl) {
        return // Đã search với cùng params rồi
      }
      
      // Nếu đang loading, cancel request cũ và tạo request mới
      if (isLoadingRef.current && abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      
      // Tạo AbortController mới cho request này
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      
      lastSearchRef.current = searchKey
      isLoadingRef.current = true
      
      // Track search keywords (async, không chờ) - TẠM TẮT
      // if (query && query.trim()) {
      //   recipeService.trackSearchKeyword(query.trim()).catch(err => {
      //     console.warn('Failed to track search keyword:', err)
      //   })
      // } else if (ingredients.length > 0) {
      //   // Track từng nguyên liệu
      //   ingredients.forEach(ing => {
      //     recipeService.trackSearchKeyword(ing).catch(err => {
      //       console.warn('Failed to track search keyword:', err)
      //     })
      //   })
      // }
      
      // Nếu có query (tên món), sử dụng tìm kiếm thông minh
      if (query && query.trim()) {
        setLoading(true)
        setError(null)

        try {
          const response = await recipeService.searchRecipesSmartly(query.trim(), {
            difficulty: filters.difficulty,
            prepTimeMax: filters.prepTimeMax,
            cookTimeMax: filters.cookTimeMax,
            servingsMin: filters.servingsMin,
            servingsMax: filters.servingsMax,
            cuisine: filters.cuisine,
            course: filters.course,
            tags: filters.tags,
            limit: 20,
            page: 1
          })
          
          // Kiểm tra lại sau khi API call
          if (abortController.signal.aborted) {
            return
          }

          // Chuyển đổi kết quả thành format IngredientMatchRecipe
          const fetched = response.recipes.map((recipe: any) => ({
            ...recipe,
            matchedCount: recipe.matchedCount || recipe.matchMetadata?.matchedIngredientsCount || 0,
            totalIngredients: recipe.totalIngredients || recipe.matchMetadata?.totalIngredientsCount || 0,
            matchPercent: recipe.matchPercent || recipe.matchMetadata?.matchPercentage || 0,
            // Đảm bảo averageRating là số
            averageRating: typeof recipe.averageRating === 'number' 
              ? recipe.averageRating 
              : recipe.averageRating != null 
                ? Number(recipe.averageRating) || 0 
                : 0,
            // Đảm bảo reviewCount là số
            reviewCount: typeof recipe.reviewCount === 'number' 
              ? recipe.reviewCount 
              : recipe.reviewCount != null 
                ? Number(recipe.reviewCount) || 0 
                : 0,
          })) as IngredientMatchRecipe[]

          const sorted = sortRecipes(fetched, sortBy)
          setResults(sorted)
          setMissingIngredients([])
          setMatchedIngredients([])
          setSuggestedRecipes([])
          setSearchType('keyword') // Đánh dấu là tìm theo tên món

          // Lưu search results vào sessionStorage
          try {
            const searchData = {
              recipes: sorted,
              missingIngredients: [],
              matchedIngredients: [],
              allMatchedIngredients: [],
              suggestedRecipes: [],
            }
            // Lưu search params (chỉ phần ?...)
            const searchParams = location.search.startsWith('?') ? location.search.substring(1) : location.search
            sessionStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(searchData))
            sessionStorage.setItem(SEARCH_PARAMS_KEY, JSON.stringify({ url: searchParams }))
            console.log('💾 Saved keyword search results to sessionStorage', searchParams)
          } catch (error) {
            console.error('Error saving search results:', error)
          }

          if (updateUrl) {
            const nextUrl = buildURLFromState()
            window.history.pushState({}, '', nextUrl)
          }
      } catch (err: any) {
        // Bỏ qua lỗi nếu request đã bị cancel
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          return
        }
        console.error('Smart search error:', err)
        setError(err.response?.data?.message || 'Có lỗi xảy ra khi tìm kiếm')
        setResults([])
        setMissingIngredients([])
        setMatchedIngredients([])
        setSuggestedRecipes([])
      } finally {
        // Chỉ reset loading nếu request này vẫn active
        if (!abortController.signal.aborted) {
          setLoading(false)
          isLoadingRef.current = false
          abortControllerRef.current = null
        }
      }
        return
      }

      // Gộp nguyên liệu từ URL + từ bộ lọc sidebar + extra ingredients (từ input chưa được add)
      const allIngredients = [...new Set([...ingredients, ...(filters.ingredients || []), ...extraIngredients])]
      
      if (allIngredients.length === 0) {
        setError('Vui lòng nhập tên món hoặc thêm ít nhất một nguyên liệu')
        return
      }

      setLoading(true)
      setError(null)

      try {
        const response = await recipeService.searchRecipesByIngredients({
          ingredients: allIngredients,
          excludeIngredients: filters.excludeIngredients || [],
          difficulty: filters.difficulty,
          prepTimeMax: filters.prepTimeMax,
          cookTimeMax: filters.cookTimeMax,
          servingsMin: filters.servingsMin,
          servingsMax: filters.servingsMax,
          cuisine: filters.cuisine,
          course: filters.course,
          tags: filters.tags,
          limit: 20,
          page: 1
        })

        const payload = response.data
        const fetched = payload?.recipes || []
        const sorted = sortRecipes(fetched, sortBy)
        setResults(sorted)
        setMissingIngredients(payload?.missingIngredients || [])
        const newMatchedIngredients = payload?.matchedIngredients || [];
        setMatchedIngredients(newMatchedIngredients)
        // Lưu tất cả nguyên liệu gốc nếu chưa có exclude (tìm kiếm mới)
        if (!filters.excludeIngredients || filters.excludeIngredients.length === 0) {
          setAllMatchedIngredients(newMatchedIngredients);
          setExcludedIngredientIds(new Set()); // Reset excluded khi tìm kiếm mới
        }
        setSuggestedRecipes(payload?.suggestions || [])
        setSearchType('ingredients') // Đánh dấu là tìm theo nguyên liệu

        // Lưu search results vào sessionStorage để restore khi quay lại
        try {
          const searchData = {
            recipes: sorted,
            missingIngredients: payload?.missingIngredients || [],
            matchedIngredients: newMatchedIngredients,
            allMatchedIngredients: newMatchedIngredients,
            suggestedRecipes: payload?.suggestions || [],
          }
          // Lưu search params (chỉ phần ?...)
          const urlToSave = updateUrl ? buildURLFromState() : window.location.search
          const searchParams = urlToSave.includes('?') ? urlToSave.split('?')[1] : urlToSave.replace(/^\?/, '')
          sessionStorage.setItem(SEARCH_RESULTS_KEY, JSON.stringify(searchData))
          sessionStorage.setItem(SEARCH_PARAMS_KEY, JSON.stringify({ url: searchParams }))
          console.log('💾 Saved ingredient search results to sessionStorage', searchParams)
        } catch (error) {
          console.error('Error saving search results:', error)
        }

        if (updateUrl) {
          const nextUrl = buildURLFromState()
          window.history.pushState({}, '', nextUrl)
          // Update sessionStorage với URL mới (chỉ phần search params)
          try {
            const searchParams = nextUrl.includes('?') ? nextUrl.split('?')[1] : nextUrl.replace(/^\?/, '')
            sessionStorage.setItem(SEARCH_PARAMS_KEY, JSON.stringify({ url: searchParams }))
          } catch (error) {
            console.error('Error updating search params:', error)
          }
        }
      } catch (err: any) {
        // Bỏ qua lỗi nếu request đã bị cancel
        if (err.name === 'AbortError' || abortController.signal.aborted) {
          return
        }
        console.error('Search error:', err)
        setError(err.response?.data?.message || 'Có lỗi xảy ra khi tìm kiếm')
        setResults([])
        setMissingIngredients([])
        setMatchedIngredients([])
        setSuggestedRecipes([])
      } finally {
        // Chỉ reset loading nếu request này vẫn active
        if (!abortController.signal.aborted) {
          setLoading(false)
          isLoadingRef.current = false
          abortControllerRef.current = null
        }
      }
    },
    [filters, ingredients, query, sortBy]
  )

  // Auto search khi có query/ingredients từ URL (chỉ chạy 1 lần khi mount)
  useEffect(() => {
    if (!autoSearchQueued || (ingredients.length === 0 && !query)) {
      setAutoSearchQueued(false)
      return
    }
    
    // Clear timeout trước đó nếu có
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Chỉ search nếu chưa có kết quả
    if (results.length === 0 && !loading) {
      searchTimeoutRef.current = setTimeout(() => {
        searchRecipes({ updateUrl: false })
        setAutoSearchQueued(false)
        searchTimeoutRef.current = null
      }, 500) // Tăng delay lên 500ms
    } else {
      setAutoSearchQueued(false)
    }
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [autoSearchQueued]) // Chỉ depend on autoSearchQueued

  // Auto search khi filters/sortBy thay đổi (debounced) - chỉ khi đã có query/ingredients
  useEffect(() => {
    // Không search nếu:
    // - Không có query và ingredients
    // - Đang trong quá trình auto search từ URL
    // - Đang loading
    if ((ingredients.length === 0 && !query) || autoSearchQueued || isLoadingRef.current) return
    
    // Clear timeout trước đó nếu có
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Debounce 1.5 giây để tránh spam
    searchTimeoutRef.current = setTimeout(() => {
      // Kiểm tra lại trước khi search
      if (!isLoadingRef.current) {
        searchRecipes({ updateUrl: true })
      }
      searchTimeoutRef.current = null
    }, 1500) // Tăng debounce time lên 1.5 giây

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
        searchTimeoutRef.current = null
      }
    }
  }, [filters, sortBy]) // Chỉ depend on filters và sortBy, không depend on query/ingredients để tránh trigger quá nhiều

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'hard':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy':
        return 'Dễ'
      case 'medium':
        return 'Trung bình'
      case 'hard':
        return 'Khó'
      default:
        return difficulty
    }
  }

  const shareURL = () => {
    const url = window.location.href
    navigator.clipboard
      .writeText(url)
      .then(() => alert('Đã copy link tìm kiếm vào clipboard!'))
      .catch(() => alert('Không thể copy link, vui lòng thực hiện thủ công.'))
  }

  return (
    <section id={sectionId} className="bg-background">
      <div className="container py-12">
        <div className="flex items-start justify-between mb-6 flex-col gap-4 lg:flex-row">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Tìm kiếm tức thì</p>
            <h2 className="text-3xl font-bold text-foreground mt-2">Nhập nguyên liệu – nhận công thức & bộ lọc nâng cao</h2>
            <p className="text-muted-foreground mt-2">
              Kết hợp bộ lọc nâng cao và danh sách nguyên liệu để tìm món chính xác như mong muốn, không cần rời khỏi trang chủ.
            </p>
          </div>
          {results.length > 0 && (
            <button
              onClick={shareURL}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Chia sẻ lượt tìm kiếm
            </button>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-6">
            {/* Đã xóa thanh tìm kiếm - chỉ giữ phần hiển thị kết quả */}
            <div className="hidden">
              <div className="card p-6 shadow-lg border border-border/60">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-foreground mb-2">Thêm nguyên liệu</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={currentIngredient}
                      onChange={(e) => setCurrentIngredient(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addIngredient(currentIngredient)
                        }
                      }}
                      placeholder="VD: ức gà, hành boaro..."
                      className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-lg"
                    />

                  {suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-2 bg-white border border-border rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                      {suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => addIngredient(suggestion)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-foreground mb-2">Sắp xếp theo</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="relevance">Độ phù hợp</option>
                    <option value="popularity">Phổ biến</option>
                    <option value="rating">Đánh giá</option>
                    <option value="recency">Mới nhất</option>
                    <option value="difficulty">Độ khó</option>
                  </select>
                </div>
                <button
                  onClick={() => searchRecipes({ updateUrl: true })}
                  disabled={loading || ingredients.length === 0}
                  className="w-full lg:w-auto px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Đang tìm kiếm...' : 'Hiển thị kết quả'}
                </button>
              </div>

              {error && <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>}
            </div>
          </div>

          {/* Hiển thị từ allMatchedIngredients để giữ nguyên liệu đã ẩn */}
          {(allMatchedIngredients.length > 0 || matchedIngredients.length > 0) && (
            <div className="card p-4 border border-dashed border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-primary">Nguyên liệu đang lọc</p>
                {excludedIngredientIds.size > 0 && (
                  <button
                    onClick={() => {
                      setExcludedIngredientIds(new Set());
                      // Clear excludeIngredients filter
                      setFilters(prev => ({ ...prev, excludeIngredients: [] }));
                      // Tìm kiếm lại với tất cả nguyên liệu
                      setTimeout(() => searchRecipes({ updateUrl: true, force: true }), 100);
                    }}
                    className="text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-400 transition-colors"
                  >
                    Hiển thị tất cả ({excludedIngredientIds.size} đã ẩn)
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Sử dụng allMatchedIngredients nếu có, để giữ nguyên liệu đã ẩn */}
                {(allMatchedIngredients.length > 0 ? allMatchedIngredients : matchedIngredients)
                  .filter(item => !excludedIngredientIds.has(item.id))
                  .map((item) => (
                  <span 
                    key={item.id} 
                    className="inline-flex items-center gap-1 px-3 py-1 bg-white dark:bg-gray-800 text-primary dark:text-primary-400 rounded-full text-xs border border-primary/40 dark:border-primary/60 hover:border-primary dark:hover:border-primary-400 transition-colors group"
                  >
                    {item.name}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Thêm vào danh sách exclude
                        setExcludedIngredientIds(prev => new Set([...prev, item.id]));
                        // Thêm vào filters.excludeIngredients để gửi lên backend
                        setFilters(prev => ({
                          ...prev,
                          excludeIngredients: [...(prev.excludeIngredients || []), item.name]
                        }));
                      }}
                      className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors opacity-50 group-hover:opacity-100"
                      title={`Bỏ ${item.name} khỏi bộ lọc`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              {excludedIngredientIds.size > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  💡 Tip: Click "Tìm kiếm món ăn" để áp dụng thay đổi
                </p>
              )}
            </div>
          )}

          {missingIngredients.length > 0 && (
            <div className="card p-4 bg-amber-50 border border-amber-200 text-amber-900">
              <p className="text-sm font-semibold mb-1">Chưa có trong kho nguyên liệu:</p>
              <p className="text-sm">
                {missingIngredients.join(', ')}{' '}
                <span className="text-amber-800/80">
                  (đã gửi admin duyệt, bạn có thể thử lại sau hoặc bổ sung từ khóa khác)
                </span>
              </p>
            </div>
          )}

            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-2xl font-bold text-foreground">Kết quả phù hợp</h3>
                  <p className="text-muted-foreground">
                    {query 
                      ? `Đã tìm thấy ${results.length} công thức cho "${query}".`
                      : `Đã tìm thấy ${results.length} công thức theo nguyên liệu ${
                          (allMatchedIngredients.length > 0 || matchedIngredients.length > 0)
                            ? (allMatchedIngredients.length > 0 ? allMatchedIngredients : matchedIngredients)
                                .filter(item => !excludedIngredientIds.has(item.id))
                                .map((item) => item.name).join(', ') 
                            : ingredients.join(', ')
                        }.`}
                  </p>
                </div>
                <div className="space-y-4">
                  {results.map((recipe) => {
                    // Get all searched ingredients from both sources
                    const allSearchedIngredients = [
                      ...ingredients, // From main search bar
                      ...(filters.ingredients || []), // From advanced filter
                      ...(matchedIngredients.map(i => i.name) || []) // From matched results
                    ].filter(Boolean);
                    
                    // Remove duplicates
                    const uniqueIngredients = [...new Set(allSearchedIngredients)];
                    
                    console.log('🔗 All searched ingredients:', {
                      fromMainSearch: ingredients,
                      fromFilters: filters.ingredients,
                      fromMatched: matchedIngredients.map(i => i.name),
                      final: uniqueIngredients
                    });
                    
                    const searchedParam = uniqueIngredients.length > 0 
                      ? `?searched=${encodeURIComponent(uniqueIngredients.join(','))}`
                      : '';
                    console.log('🔗 URL will be:', `/recipes/${recipe.id}${searchedParam}`);
                    
                    return (
                      <Link 
                        key={recipe.id} 
                        to={`/recipes/${recipe.id}${searchedParam}`}
                        className="block group"
                      >
                      <div className="relative overflow-hidden border border-border/50 rounded-2xl bg-white shadow-sm hover:shadow-2xl hover:border-primary/40 transition-all duration-300 cursor-pointer">
                        {/* Layout với ảnh lớn bên trái */}
                        <div className="flex flex-col sm:flex-row">
                          {/* Ảnh món ăn */}
                          <div className="relative w-full sm:w-56 md:w-64 h-48 sm:h-auto flex-shrink-0 overflow-hidden">
                            {recipe.imageUrl ? (
                              <img 
                                src={recipe.imageUrl} 
                                alt={recipe.recipeName}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80`;
                                }}
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-orange-400 via-amber-500 to-yellow-500 flex items-center justify-center">
                                <span className="text-6xl text-white/90 font-bold drop-shadow-lg">
                                  {recipe.recipeName.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            {/* Overlay gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            
                            {/* Badge độ khó góc trên */}
                            <div className="absolute top-3 left-3">
                              <span className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm ${
                                recipe.difficulty.toLowerCase() === 'easy' 
                                  ? 'bg-emerald-500/90 text-white' 
                                  : recipe.difficulty.toLowerCase() === 'medium'
                                  ? 'bg-amber-500/90 text-white'
                                  : 'bg-rose-500/90 text-white'
                              }`}>
                                {getDifficultyText(recipe.difficulty)}
                              </span>
                            </div>

                            {/* Nút yêu thích góc trên phải */}
                            <div className="absolute top-3 right-3" onClick={(e) => e.preventDefault()}>
                              <div className="bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-lg hover:bg-white transition-colors">
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
                          </div>

                          {/* Nội dung bên phải */}
                          <div className="flex-1 p-5 flex flex-col">
                            {/* Tiêu đề và mô tả */}
                            <div className="flex-1">
                              <h4 className="text-xl font-bold text-gray-800 group-hover:text-primary transition-colors line-clamp-1">
                                {recipe.recipeName}
                              </h4>
                              <p className="text-sm text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                                {recipe.description || 'Món ăn ngon miệng, dễ làm, phù hợp cho cả gia đình.'}
                              </p>
                            </div>

                            {/* Categories */}
                            {(recipe as any).categories && (recipe as any).categories.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {(recipe as any).categories.slice(0, 2).map((category: any) => (
                                  <span
                                    key={category.id}
                                    className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/30 px-2.5 py-1 text-xs font-medium text-orange-700 dark:text-orange-400"
                                  >
                                    {category.categoryName}
                                  </span>
                                ))}
                                {(recipe as any).categories.length > 2 && (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                                    +{(recipe as any).categories.length - 2}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Thông tin match */}
                            <div className="flex flex-wrap items-center gap-2 mt-4">
                              {recipe.matchPercent > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200">
                                  <span className="text-sm">🎯</span>
                                  {recipe.matchPercent}% phù hợp
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200">
                                <span className="text-sm">⭐</span>
                                {(() => {
                                  const rating = recipe.averageRating;
                                  if (rating == null) return '0.0';
                                  const numRating = typeof rating === 'number' ? rating : Number(rating);
                                  return isNaN(numRating) ? '0.0' : numRating.toFixed(1);
                                })()} ({recipe.reviewCount || 0})
                              </span>
                            </div>

                            {/* Hiển thị số từ khóa khớp (thay vì số nguyên liệu) */}
                            {(recipe as any).matchedGroupCount > 0 && (recipe as any).totalGroups > 0 && (
                              <div className="flex items-center gap-2 text-sm text-emerald-600 mt-3 font-medium">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                Khớp {(recipe as any).matchedGroupCount}/{(recipe as any).totalGroups} từ khóa bạn đã chọn
                                {(recipe as any).matchedGroups && (recipe as any).matchedGroups.length > 0 && (
                                  <span className="text-gray-500 ml-1">
                                    ({(recipe as any).matchedGroups.join(', ')})
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Thông tin thời gian */}
                            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{recipe.prepTime + recipe.cookTime}p</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                                <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                                </svg>
                                <span>Nấu {recipe.cookTime}p</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span>{recipe.servings} người</span>
                              </div>
                              
                              {/* Nút xem chi tiết */}
                              <div className="ml-auto">
                                <span className="inline-flex items-center gap-1 text-primary font-semibold text-sm group-hover:gap-2 transition-all">
                                  Xem chi tiết
                                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {!loading && results.length === 0 && (ingredients.length > 0 || query) && !error && (
              <div className="card p-8 text-center">
                <p className="text-muted-foreground">
                  {query 
                    ? `Không tìm thấy công thức nào có tên "${query}".`
                    : 'Không tìm thấy công thức nào phù hợp với bộ nguyên liệu hiện tại.'}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {query 
                    ? 'Hãy thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc nâng cao.'
                    : 'Hãy thử bỏ bớt một nguyên liệu hoặc điều chỉnh bộ lọc nâng cao.'}
                </p>
                
                {/* Gợi ý tìm theo nguyên liệu nếu đang tìm theo tên */}
                {query && searchType === 'keyword' && (
                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      💡 <strong>"{query}"</strong> có thể là nguyên liệu?
                    </p>
                    <button
                      onClick={() => {
                        // Chuyển query thành ingredients và tìm lại
                        const newIngredients = query.split(',').map(s => s.trim()).filter(Boolean);
                        setIngredients(prev => [...new Set([...prev, ...newIngredients])]);
                        setQuery('');
                        // Trigger search ngay
                        setTimeout(() => {
                          searchRecipes({ updateUrl: true, force: true, extraIngredients: newIngredients });
                        }, 100);
                      }}
                      className="px-6 py-2.5 bg-orange-500 text-white rounded-full font-medium hover:bg-orange-600 transition-colors"
                    >
                      🔍 Tìm các món có nguyên liệu "{query}"
                    </button>
                  </div>
                )}

              {suggestedRecipes.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-semibold text-foreground mb-2">Gợi ý dành cho bạn:</p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {suggestedRecipes.map((recipe) => (
                      <Link
                        key={recipe.id}
                        to={`/recipes/${recipe.id}`}
                        className="px-4 py-2 border border-border rounded-full text-sm hover:bg-gray-50 transition-colors"
                      >
                        {recipe.recipeName}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              </div>
            )}
          </div>

          <aside className="self-start lg:sticky lg:top-24">
            <RecipeFilters
              onFilterChange={(nextFilters) => setFilters(nextFilters)}
              initialFilters={filters}
              defaultExpanded
              className="shadow-lg border border-border/60"
              primaryIngredients={ingredients}
              onPrimaryIngredientRemove={removeIngredient}
              onSearch={(pendingIngredient) => {
                // Nếu có pending ingredient, thêm vào filter trước khi search
                if (pendingIngredient) {
                  const newFilters = {
                    ...filters,
                    ingredients: [...(filters.ingredients || []), pendingIngredient].filter(
                      (v, i, arr) => arr.indexOf(v) === i // Remove duplicates
                    )
                  };
                  setFilters(newFilters);
                  // Force search với extra ingredients (vì state chưa kịp update)
                  searchRecipes({ updateUrl: true, force: true, extraIngredients: [pendingIngredient] });
                } else {
                  // Force search ngay lập tức
                  searchRecipes({ updateUrl: true, force: true });
                }
              }}
              hasQuery={!!query}
            />
          </aside>
        </div>
      </div>
    </section>
  )
}

export default HomeSearchSection

