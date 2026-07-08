import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import RecipeFilters, { FilterState } from './RecipeFilters'
import recipeService from '../../services/recipeService'
import { IngredientMatchRecipe, Recipe as RecipeType } from '../../types/recipe'
import FavoriteButton from '../atoms/FavoriteButton'
import { useAuth } from '../../contexts/AuthContext'
import { EyebrowTag } from '../atoms/EyebrowTag'
import { splitRevealLeft, splitRevealRight, viewportOnce, cardReveal, staggerGrid } from '../../lib/motion'

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
        return 'bg-[#EDF3EC] text-[#346538]'
      case 'medium':
        return 'bg-[#FBF3DB] text-[#956400]'
      case 'hard':
        return 'bg-[#FDEBEC] text-[#9F2F2D]'
      default:
        return 'bg-paper-light text-ink-secondary'
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
    <section id={sectionId} className="bg-paper-light dark:bg-ink-800 pt-32 md:pt-40 pb-24 section-lg">
      <div className="container">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-end mb-12"
        >
          <motion.div variants={splitRevealLeft} className="lg:col-span-7">
            <EyebrowTag>Tìm kiếm tức thì</EyebrowTag>
            <h1 className="mt-6 text-display text-5xl md:text-6xl lg:text-7xl text-ink-primary dark:text-paper-light text-balance">
              Nhập nguyên liệu.
              <br />
              <span className="text-ink-muted">Nhận công thức.</span>
            </h1>
            <p className="mt-6 text-ink-secondary text-lg leading-relaxed max-w-xl text-pretty">
              Kết hợp bộ lọc nâng cao và danh sách nguyên liệu để tìm món chính xác như mong muốn.
            </p>
          </motion.div>
          <motion.div variants={splitRevealRight} className="lg:col-span-5 lg:pb-3">
            {results.length > 0 && (
              <button onClick={shareURL} className="btn-editorial-ghost">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.59 13.51l6.83 3.98" />
                  <path d="M15.41 6.51l-6.82 3.98" />
                </svg>
                Chia sẻ tìm kiếm
              </button>
            )}
          </motion.div>
        </motion.div>

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
            <div className="card-bezel mb-4">
              <div className="card-bezel-inner p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs uppercase tracking-[0.2em] text-ink-secondary font-medium">Nguyên liệu đang lọc</p>
                {excludedIngredientIds.size > 0 && (
                  <button
                    onClick={() => {
                      setExcludedIngredientIds(new Set());
                      setFilters(prev => ({ ...prev, excludeIngredients: [] }));
                      setTimeout(() => searchRecipes({ updateUrl: true, force: true }), 100);
                    }}
                    className="link-underline text-xs uppercase tracking-[0.2em] text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light"
                  >
                    Hiển thị tất cả ({excludedIngredientIds.size} đã ẩn)
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {(allMatchedIngredients.length > 0 ? allMatchedIngredients : matchedIngredients)
                  .filter(item => !excludedIngredientIds.has(item.id))
                  .map((item) => (
                  <span
                    key={item.id}
                    className="chip"
                  >
                    {item.name}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExcludedIngredientIds(prev => new Set([...prev, item.id]));
                        setFilters(prev => ({
                          ...prev,
                          excludeIngredients: [...(prev.excludeIngredients || []), item.name]
                        }));
                      }}
                      className="ml-0.5 w-4 h-4 flex items-center justify-center rounded-full hover:bg-ink-700/10 dark:hover:bg-paper-light/10 transition-colors"
                      title={`Bỏ ${item.name} khỏi bộ lọc`}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              </div>
            </div>
          )}

          {missingIngredients.length > 0 && (
            <div className="card-bezel mb-4">
              <div className="card-bezel-inner p-5 bg-[#FBF3DB]/30 dark:bg-[#956400]/10 text-[#956400] dark:text-[#FBF3DB]">
                <p className="text-xs uppercase tracking-[0.2em] font-medium mb-1">Chưa có trong kho nguyên liệu</p>
                <p className="text-sm">
                  {missingIngredients.join(', ')}{' '}
                  <span className="opacity-70">
                    (đã gửi admin duyệt, bạn có thể thử lại sau hoặc bổ sung từ khóa khác)
                  </span>
                </p>
              </div>
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
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={staggerGrid}
                  className="space-y-4"
                >
                  {results.map((recipe, idx) => {
                    const allSearchedIngredients = [
                      ...ingredients,
                      ...(filters.ingredients || []),
                      ...(matchedIngredients.map(i => i.name) || [])
                    ].filter(Boolean);
                    const uniqueIngredients = [...new Set(allSearchedIngredients)];
                    const searchedParam = uniqueIngredients.length > 0
                      ? `?searched=${encodeURIComponent(uniqueIngredients.join(','))}`
                      : '';

                    return (
                      <motion.div key={recipe.id} custom={idx} variants={cardReveal}>
                        <Link
                          to={`/recipes/${recipe.id}${searchedParam}`}
                          className="block group"
                        >
                          <article className="card-bezel">
                            <div className="card-bezel-inner flex flex-col sm:flex-row overflow-hidden p-0">
                              <div className="relative w-full sm:w-56 md:w-64 h-48 sm:h-auto flex-shrink-0 overflow-hidden">
                                {recipe.imageUrl ? (
                                  <img
                                    src={recipe.imageUrl}
                                    alt={recipe.recipeName}
                                    loading="lazy"
                                    className="w-full h-full object-cover transition-transform duration-[1100ms] ease-[var(--ease-fluid)] group-hover:scale-105"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.onerror = null;
                                      target.src = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80`;
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-paper-light to-ink-200 dark:from-ink-700 dark:to-ink-800 flex items-center justify-center">
                                    <span className="text-display text-5xl text-ink-300">
                                      {recipe.recipeName.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-ink-700/20 to-transparent" />
                                <div className="absolute top-3 left-3">
                                  <span className={`eyebrow-tag ${getDifficultyColor(recipe.difficulty)}`}>
                                    {getDifficultyText(recipe.difficulty)}
                                  </span>
                                </div>
                                <div className="absolute top-3 right-3" onClick={(e) => e.preventDefault()}>
                                  <FavoriteButton
                                    recipeId={recipe.id}
                                    initialFavoriteCount={0}
                                    initialIsFavorited={false}
                                    userId={user?.id}
                                    size="sm"
                                    showCount={false}
                                    showTooltip={true}
                                  />
                                </div>
                              </div>

                              <div className="flex-1 p-5 md:p-6 flex flex-col">
                                <div className="flex-1">
                                  <h4 className="text-xl font-semibold text-ink-primary dark:text-paper-light group-hover:text-[#ff4f00] transition-colors duration-700 ease-[var(--ease-fluid)] line-clamp-1">
                                    {recipe.recipeName}
                                  </h4>
                                  <p className="text-sm text-ink-secondary mt-2 line-clamp-2 leading-relaxed">
                                    {recipe.description || 'Món ăn ngon miệng, dễ làm, phù hợp cho cả gia đình.'}
                                  </p>
                                </div>

                                {(recipe as any).categories && (recipe as any).categories.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {(recipe as any).categories.slice(0, 2).map((category: any) => (
                                      <span key={category.id} className="eyebrow-tag">
                                        {category.categoryName}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                <div className="flex flex-wrap items-center gap-2 mt-4">
                                  {recipe.matchPercent > 0 && (
                                    <span className="eyebrow-tag bg-[#EDF3EC] text-[#346538]">
                                      {recipe.matchPercent}% phù hợp
                                    </span>
                                  )}
                                  <span className="eyebrow-tag bg-[#FBF3DB] text-[#956400]">
                                    {typeof recipe.averageRating === 'number' ? recipe.averageRating.toFixed(1) : '0.0'} ({recipe.reviewCount || 0})
                                  </span>
                                </div>

                                <div className="flex items-center justify-between mt-auto pt-4 border-t border-ink-200/40 dark:border-ink-700/40">
                                  <div className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-ink-secondary">
                                    <span>{recipe.prepTime + recipe.cookTime}p</span>
                                    <span>·</span>
                                    <span>{recipe.servings} người</span>
                                  </div>
                                  <span className="inline-flex items-center gap-2 text-sm font-medium text-ink-primary dark:text-paper-light group-hover:text-[#ff4f00] transition-colors duration-700 ease-[var(--ease-fluid)]">
                                    Xem
                                    <span className="w-7 h-7 rounded-full bg-paper-light dark:bg-ink-700 ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center group-hover:bg-[#ff4f00] group-hover:text-paper-light group-hover:ring-[#ff4f00] transition-all duration-700 ease-[var(--ease-fluid)]">
                                      →
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </article>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            )}

            {!loading && results.length === 0 && (ingredients.length > 0 || query) && !error && (
              <div className="card-bezel">
                <div className="card-bezel-inner p-10 text-center">
                  <p className="text-ink-secondary text-lg mb-2">
                    {query
                      ? `Không tìm thấy công thức nào có tên "${query}".`
                      : 'Không tìm thấy công thức nào phù hợp với bộ nguyên liệu hiện tại.'}
                  </p>
                  <p className="text-sm text-ink-muted mb-6">
                    {query
                      ? 'Hãy thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc nâng cao.'
                      : 'Hãy thử bỏ bớt một nguyên liệu hoặc điều chỉnh bộ lọc nâng cao.'}
                  </p>

                  {query && searchType === 'keyword' && (
                    <div className="space-y-4">
                      <p className="text-sm text-ink-secondary">
                        <span className="font-semibold">"{query}"</span> có thể là nguyên liệu?
                      </p>
                      <button
                        onClick={() => {
                          const newIngredients = query.split(',').map(s => s.trim()).filter(Boolean);
                          setIngredients(prev => [...new Set([...prev, ...newIngredients])]);
                          setQuery('');
                          setTimeout(() => {
                            searchRecipes({ updateUrl: true, force: true, extraIngredients: newIngredients });
                          }, 100);
                        }}
                        className="btn-editorial-ghost"
                      >
                        Tìm món có nguyên liệu "{query}"
                      </button>
                    </div>
                  )}

                  {suggestedRecipes.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-ink-200/40 dark:border-ink-700/40">
                      <p className="text-xs uppercase tracking-[0.2em] text-ink-secondary mb-4">Gợi ý dành cho bạn</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {suggestedRecipes.map((recipe) => (
                          <Link
                            key={recipe.id}
                            to={`/recipes/${recipe.id}`}
                            className="chip"
                          >
                            {recipe.recipeName}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
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

