import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import recipeService from '../services/recipeService';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { splitRevealLeft, cardReveal, easeFluid } from '../lib/motion';
import { Loader2, Edit, Trash2, Eye, EyeOff, Plus, ChevronLeft, ChevronRight, X, ArrowUp, ArrowDown, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Recipe {
  id: number;
  recipeName: string;
  description: string;
  status: 'visible' | 'hidden' | 'pending';
  difficulty: 'easy' | 'medium' | 'hard';
  prepTime: number;
  cookTime: number;
  servings: number;
  averageRating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  ingredients?: RecipeIngredientItem[];
  steps?: RecipeStepItem[];
}

interface RecipeIngredientItem {
  id?: number;
  ingredientName: string;
  quantity: number | string;
  unit: string;
}

interface RecipeStepItem {
  id?: number;
  stepNumber: number;
  instruction: string;
}

const AdminRecipes: React.FC = () => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [modalTab, setModalTab] = useState<'basic' | 'ingredients' | 'steps'>('basic');

  useEffect(() => {
    fetchRecipes();
  }, [page, statusFilter, difficultyFilter]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const response = await adminService.getRecipes({
        page,
        limit,
        search: searchTerm,
        status: statusFilter || undefined,
        difficulty: difficultyFilter || undefined,
      });
      setRecipes(response.data.recipes);
      setTotal(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchRecipes();
  };

  const handleStatusChange = async (recipeId: number, newStatus: 'visible' | 'hidden' | 'pending') => {
    if (!confirm(`Bạn có chắc muốn đổi trạng thái công thức này?`)) return;
    
    try {
      await adminService.updateRecipeStatus(recipeId, newStatus);
      fetchRecipes();
    } catch (error) {
      console.error('Error updating recipe status:', error);
      alert('Có lỗi xảy ra khi cập nhật trạng thái');
    }
  };

  const handleDelete = async (recipeId: number, recipeName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa công thức "${recipeName}"? Hành động này không thể hoàn tác!`)) return;
    
    try {
      await adminService.deleteRecipe(recipeId);
      fetchRecipes();
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Có lỗi xảy ra khi xóa công thức');
    }
  };

  const handleEdit = async (recipe: Recipe) => {
    try {
      setLoading(true);
      console.log('📥 Fetching recipe details for ID:', recipe.id);
      
      // Fetch full recipe details from API
      const response = await recipeService.getRecipeById(recipe.id);
      console.log('📦 API Response:', response);
      
      // Extract recipe data from response
      const responseData = response.data as any;
      const recipeData = responseData?.recipe || responseData?.data?.recipe || responseData;
      console.log('🔍 Recipe data:', recipeData);
      
      // Parse ingredients with proper format
      const ingredients: RecipeIngredientItem[] = (recipeData.ingredients || []).map((ing: any) => {
        // Handle both formats: direct or nested through RecipeIngredient
        const quantity = ing.RecipeIngredient?.quantity || ing.quantity || 0;
        const unit = ing.RecipeIngredient?.unit || ing.unit || '';
        const name = ing.ingredientName || ing.ingredient?.ingredientName || ing.name || '';
        
        return {
          id: ing.id,
          ingredientName: name,
          quantity: quantity,
          unit: unit
        };
      });
      
      // Parse steps with proper format
      const steps: RecipeStepItem[] = (recipeData.steps || []).map((step: any) => ({
        id: step.id,
        stepNumber: step.stepNumber,
        instruction: step.instruction || step.description || ''
      })).sort((a: RecipeStepItem, b: RecipeStepItem) => a.stepNumber - b.stepNumber);
      
      console.log('✅ Parsed ingredients:', ingredients);
      console.log('✅ Parsed steps:', steps);
      
      // Set full recipe with parsed data
      const fullRecipe: Recipe = {
        ...recipe,
        ...recipeData,
        ingredients,
        steps
      };
      
      setEditingRecipe(fullRecipe);
      setShowEditModal(true);
      setModalTab('basic');
    } catch (error) {
      console.error('❌ Error loading recipe details:', error);
      alert('Có lỗi khi tải chi tiết công thức. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const addIngredient = () => {
    if (!editingRecipe) return;
    const newIngredient: RecipeIngredientItem = {
      ingredientName: '',
      quantity: 0,
      unit: 'gram'
    };
    setEditingRecipe({
      ...editingRecipe,
      ingredients: [...(editingRecipe.ingredients || []), newIngredient]
    });
  };

  const updateIngredient = (index: number, field: keyof RecipeIngredientItem, value: any) => {
    if (!editingRecipe) return;
    const updated = [...(editingRecipe.ingredients || [])];
    updated[index] = { ...updated[index], [field]: value };
    setEditingRecipe({ ...editingRecipe, ingredients: updated });
  };

  const removeIngredient = (index: number) => {
    if (!editingRecipe) return;
    const updated = editingRecipe.ingredients?.filter((_, i) => i !== index) || [];
    setEditingRecipe({ ...editingRecipe, ingredients: updated });
  };

  const addStep = () => {
    if (!editingRecipe) return;
    const newStep: RecipeStepItem = {
      stepNumber: (editingRecipe.steps?.length || 0) + 1,
      instruction: ''
    };
    setEditingRecipe({
      ...editingRecipe,
      steps: [...(editingRecipe.steps || []), newStep]
    });
  };

  const updateStep = (index: number, instruction: string) => {
    if (!editingRecipe) return;
    const updated = [...(editingRecipe.steps || [])];
    updated[index] = { ...updated[index], instruction };
    setEditingRecipe({ ...editingRecipe, steps: updated });
  };

  const removeStep = (index: number) => {
    if (!editingRecipe) return;
    const updated = editingRecipe.steps?.filter((_, i) => i !== index).map((step, i) => ({
      ...step,
      stepNumber: i + 1
    })) || [];
    setEditingRecipe({ ...editingRecipe, steps: updated });
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (!editingRecipe?.steps) return;
    const steps = [...editingRecipe.steps];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= steps.length) return;
    
    [steps[index], steps[newIndex]] = [steps[newIndex], steps[index]];
    const reordered = steps.map((step, i) => ({ ...step, stepNumber: i + 1 }));
    setEditingRecipe({ ...editingRecipe, steps: reordered });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe) return;

    try {
      setLoading(true);
      console.log('💾 Saving recipe:', editingRecipe);
      
      // Prepare data for API
      const updateData = {
        recipeName: editingRecipe.recipeName,
        description: editingRecipe.description,
        difficulty: editingRecipe.difficulty,
        status: editingRecipe.status,
        prepTime: editingRecipe.prepTime,
        cookTime: editingRecipe.cookTime,
        servings: editingRecipe.servings,
        ingredients: editingRecipe.ingredients?.map(ing => ({
          ingredientName: ing.ingredientName,
          quantity: ing.quantity,
          unit: ing.unit
        })),
        steps: editingRecipe.steps?.map(step => ({
          stepNumber: step.stepNumber,
          instruction: step.instruction
        }))
      };

      await adminService.updateRecipe(editingRecipe.id, updateData);
      alert('✅ Cập nhật công thức thành công!');
      setShowEditModal(false);
      fetchRecipes();
    } catch (error) {
      console.error('❌ Error updating recipe:', error);
      alert('Có lỗi xảy ra khi cập nhật công thức. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'visible':
        return 'bg-[#EDF3EC] text-[#346538]';
      case 'pending':
        return 'bg-[#FBF3DB] text-[#956400]';
      case 'hidden':
        return 'bg-paper-light text-ink-secondary';
      default:
        return 'bg-paper-light text-ink-secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'visible': return 'Hiển thị';
      case 'pending': return 'Chờ duyệt';
      case 'hidden': return 'Ẩn';
      default: return status;
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Dễ';
      case 'medium': return 'Trung bình';
      case 'hard': return 'Khó';
      default: return difficulty;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <motion.div initial="hidden" animate="visible" variants={splitRevealLeft}>
          <EyebrowTag>Quản trị</EyebrowTag>
          <h1 className="mt-4 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
            Công thức.
          </h1>
          <p className="mt-4 text-ink-secondary text-pretty">
            Tổng số: <span className="font-semibold text-ink-primary dark:text-paper-light">{total}</span> công thức
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeFluid }}
          className="card-bezel"
        >
          <div className="card-bezel-inner p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Tìm kiếm công thức..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="input-bezel-inner h-11 px-4 text-sm w-full"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 px-4 text-sm rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-500 ease-[var(--ease-fluid)] cursor-pointer"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="visible">Hiển thị</option>
                <option value="pending">Chờ duyệt</option>
                <option value="hidden">Ẩn</option>
              </select>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="h-11 px-4 text-sm rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light focus:outline-none focus:ring-2 focus:ring-[#ff4f00] transition-all duration-500 ease-[var(--ease-fluid)] cursor-pointer"
              >
                <option value="">Tất cả độ khó</option>
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
              <button onClick={handleSearch} className="btn-editorial-primary justify-center">
                Tìm kiếm
              </button>
            </div>
          </div>
        </motion.div>

        {loading ? (
          <div className="card-bezel">
            <div className="card-bezel-inner p-12 flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#ff4f00]" strokeWidth={1.5} />
              <span className="text-sm uppercase tracking-[0.2em] text-ink-secondary">Đang tải...</span>
            </div>
          </div>
        ) : recipes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeFluid }}
            className="card-bezel"
          >
            <div className="card-bezel-inner p-12 text-center">
              <p className="text-ink-secondary">Không tìm thấy công thức nào</p>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeFluid }}
              className="card-bezel"
            >
              <div className="card-bezel-inner p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-paper-light dark:bg-ink-700/40 border-b border-ink-200/40 dark:border-ink-700/40">
                      <tr>
                        {['Công thức', 'Độ khó', 'Thời gian', 'Trạng thái', 'Đánh giá', 'Thao tác'].map(h => (
                          <th key={h} className="px-6 py-3.5 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-200/40 dark:divide-ink-700/40">
                      {recipes.map((recipe, idx) => (
                        <motion.tr
                          key={recipe.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.4, ease: easeFluid, delay: idx * 0.03 }}
                          className="hover:bg-paper-light dark:hover:bg-ink-700/30 transition-colors duration-500 ease-[var(--ease-fluid)]"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#fff4ed] dark:bg-[#ff4f00]/15 ring-1 ring-[#ff4f00]/30 flex items-center justify-center flex-shrink-0 text-base">
                                🍳
                              </div>
                              <div className="min-w-0 max-w-xs">
                                <p className="text-sm font-semibold text-ink-primary dark:text-paper-light truncate">
                                  {recipe.recipeName}
                                </p>
                                <p className="text-xs text-ink-muted truncate mt-0.5">
                                  {recipe.description}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-secondary">
                            {getDifficultyText(recipe.difficulty)}
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-secondary tabular-nums">
                            {recipe.prepTime + recipe.cookTime}p
                          </td>
                          <td className="px-6 py-4">
                            <span className={`eyebrow-tag text-[10px] ${getStatusColor(recipe.status)}`}>
                              {getStatusText(recipe.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-ink-secondary">
                            {recipe.averageRating > 0 ? `${recipe.averageRating.toFixed(1)} ★ (${recipe.reviewCount})` : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1">
                              <Link
                                to={`/recipes/${recipe.id}`}
                                className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700/40 hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                                title="Xem chi tiết"
                              >
                                <Eye className="w-4 h-4" strokeWidth={1.5} />
                              </Link>
                              <button
                                onClick={() => handleEdit(recipe)}
                                className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-[#ff4f00] hover:bg-[#fff4ed] dark:hover:bg-[#ff4f00]/15 hover:ring-[#ff4f00]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                                title="Chỉnh sửa"
                              >
                                <Edit className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                              {recipe.status === 'visible' ? (
                                <button
                                  onClick={() => handleStatusChange(recipe.id, 'hidden')}
                                  className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700/40 hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                                  title="Ẩn công thức"
                                >
                                  <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStatusChange(recipe.id, 'visible')}
                                  className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-[#346538] hover:bg-[#EDF3EC] dark:hover:bg-[#346538]/15 hover:ring-[#346538]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                                  title="Hiển thị công thức"
                                >
                                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(recipe.id, recipe.recipeName)}
                                className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-[#9F2F2D] hover:bg-[#FDEBEC] dark:hover:bg-[#9F2F2D]/15 hover:ring-[#9F2F2D]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                                title="Xóa công thức"
                              >
                                <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>

            {/* Pagination */}
            <motion.div
              variants={cardReveal}
              initial="hidden"
              animate="visible"
              className="card-bezel"
            >
              <div className="card-bezel-inner p-4 flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-ink-secondary">
                  Hiển thị <span className="font-semibold text-ink-primary dark:text-paper-light">{(page - 1) * limit + 1}</span> đến{' '}
                  <span className="font-semibold text-ink-primary dark:text-paper-light">{Math.min(page * limit, total)}</span> trong tổng số{' '}
                  <span className="font-semibold text-ink-primary dark:text-paper-light">{total}</span> kết quả
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-10 px-4 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light disabled:opacity-30 disabled:cursor-not-allowed hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)] flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
                    Trước
                  </button>
                  <span className="px-4 text-xs uppercase tracking-[0.2em] text-ink-secondary">
                    Trang {page}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={page * limit >= total}
                    className="h-10 px-4 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light disabled:opacity-30 disabled:cursor-not-allowed hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)] flex items-center gap-2"
                  >
                    Sau <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Edit Modal - Full screen với tabs */}
        <AnimatePresence>
        {showEditModal && editingRecipe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-ink-700/40 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.97 }}
              transition={{ duration: 0.5, ease: easeFluid }}
              className="card-bezel max-w-5xl w-full max-h-[95vh] flex flex-col"
            >
              <form onSubmit={handleSaveEdit} className="flex flex-col h-full">
                {/* Modal Header */}
                <div className="border-b border-ink-200/40 dark:border-ink-700/40 px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-xl font-bold text-ink-primary dark:text-paper-light text-display">
                    Chỉnh sửa công thức: {editingRecipe.recipeName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700/40 hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                  >
                    ✕
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 px-6 pt-4 border-b dark:border-gray-700 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setModalTab('basic')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                      modalTab === 'basic'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    📝 Thông tin cơ bản
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('ingredients')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                      modalTab === 'ingredients'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    🥕 Nguyên liệu ({editingRecipe.ingredients?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('steps')}
                    className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                      modalTab === 'steps'
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
                    }`}
                  >
                    👨‍🍳 Các bước ({editingRecipe.steps?.length || 0})
                  </button>
                </div>

                {/* Modal Body - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {/* Tab: Basic Info */}
                  {modalTab === 'basic' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tên công thức *
                        </label>
                        <input
                          type="text"
                          value={editingRecipe.recipeName}
                          onChange={(e) => setEditingRecipe({ ...editingRecipe, recipeName: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Mô tả
                        </label>
                        <textarea
                          value={editingRecipe.description}
                          onChange={(e) => setEditingRecipe({ ...editingRecipe, description: e.target.value })}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Độ khó *
                          </label>
                          <select
                            value={editingRecipe.difficulty}
                            onChange={(e) => setEditingRecipe({ ...editingRecipe, difficulty: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                            required
                          >
                            <option value="easy">Dễ</option>
                            <option value="medium">Trung bình</option>
                            <option value="hard">Khó</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Trạng thái *
                          </label>
                          <select
                            value={editingRecipe.status}
                            onChange={(e) => setEditingRecipe({ ...editingRecipe, status: e.target.value as any })}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                            required
                          >
                            <option value="visible">Hiển thị</option>
                            <option value="hidden">Ẩn</option>
                            <option value="pending">Chờ duyệt</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Chuẩn bị (phút) *
                          </label>
                          <input
                            type="number"
                            value={editingRecipe.prepTime}
                            onChange={(e) => setEditingRecipe({ ...editingRecipe, prepTime: parseInt(e.target.value) || 0 })}
                            min="0"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nấu (phút) *
                          </label>
                          <input
                            type="number"
                            value={editingRecipe.cookTime}
                            onChange={(e) => setEditingRecipe({ ...editingRecipe, cookTime: parseInt(e.target.value) || 0 })}
                            min="0"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Khẩu phần *
                          </label>
                          <input
                            type="number"
                            value={editingRecipe.servings}
                            onChange={(e) => setEditingRecipe({ ...editingRecipe, servings: parseInt(e.target.value) || 1 })}
                            min="1"
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab: Ingredients */}
                  {modalTab === 'ingredients' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Danh sách nguyên liệu
                        </h3>
                        <button
                          type="button"
                          onClick={addIngredient}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm nguyên liệu
                        </button>
                      </div>

                      {editingRecipe.ingredients && editingRecipe.ingredients.length > 0 ? (
                        <div className="space-y-3">
                          {editingRecipe.ingredients.map((ing, index) => (
                            <div key={index} className="flex gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <input
                                type="text"
                                placeholder="Tên nguyên liệu"
                                value={ing.ingredientName}
                                onChange={(e) => updateIngredient(index, 'ingredientName', e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded"
                                required
                              />
                              <input
                                type="number"
                                placeholder="Số lượng"
                                value={ing.quantity}
                                onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded"
                                required
                              />
                              <input
                                type="text"
                                placeholder="Đơn vị"
                                value={ing.unit}
                                onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                                className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded"
                                required
                              />
                              <button
                                type="button"
                                onClick={() => removeIngredient(index)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center py-8 text-gray-500">
                          Chưa có nguyên liệu nào. Click "Thêm nguyên liệu" để bắt đầu.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tab: Steps */}
                  {modalTab === 'steps' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          Các bước nấu
                        </h3>
                        <button
                          type="button"
                          onClick={addStep}
                          className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm bước
                        </button>
                      </div>

                      {editingRecipe.steps && editingRecipe.steps.length > 0 ? (
                        <div className="space-y-3">
                          {editingRecipe.steps.map((step, index) => (
                            <div key={index} className="flex gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex-shrink-0 w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold">
                                {step.stepNumber}
                              </div>
                              <textarea
                                placeholder="Mô tả bước làm..."
                                value={step.instruction}
                                onChange={(e) => updateStep(index, e.target.value)}
                                rows={2}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded"
                                required
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveStep(index, 'up')}
                                  disabled={index === 0}
                                  className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                                  title="Di chuyển lên"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveStep(index, 'down')}
                                  disabled={index === editingRecipe.steps!.length - 1}
                                  className="p-1 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded disabled:opacity-30"
                                  title="Di chuyển xuống"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeStep(index)}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded self-start"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center py-8 text-gray-500">
                          Chưa có bước nấu nào. Click "Thêm bước" để bắt đầu.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="border-t border-ink-200/40 dark:border-ink-700/40 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0 bg-paper-light dark:bg-ink-700/40">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="h-11 px-5 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="btn-editorial-primary"
                  >
                    <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
                    Lưu toàn bộ thay đổi
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
};

export default AdminRecipes;
