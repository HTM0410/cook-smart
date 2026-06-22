import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import recipeService from '../services/recipeService';
import { Loader2, Edit, Trash2, Eye, EyeOff, CheckCircle, Plus, ArrowUp, ArrowDown, X } from 'lucide-react';
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
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'hidden':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700';
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quản lý công thức</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Tổng số: {total} công thức
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <input
              type="text"
              placeholder="Tìm kiếm công thức..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="visible">Hiển thị</option>
              <option value="pending">Chờ duyệt</option>
              <option value="hidden">Ẩn</option>
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tất cả độ khó</option>
              <option value="easy">Dễ</option>
              <option value="medium">Trung bình</option>
              <option value="hard">Khó</option>
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              🔍 Tìm kiếm
            </button>
          </div>
        </div>

        {/* Recipes Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Đang tải...</span>
          </div>
        ) : recipes.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <p className="text-gray-500">Không tìm thấy công thức nào</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Công thức
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Độ khó
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Thời gian
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Trạng thái
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Đánh giá
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {recipes.map((recipe) => (
                      <tr key={recipe.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                              <span className="text-orange-600 dark:text-orange-400 text-lg">🍳</span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{recipe.recipeName}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{recipe.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {getDifficultyText(recipe.difficulty)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {recipe.prepTime + recipe.cookTime}p
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(recipe.status)}`}>
                            {getStatusText(recipe.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                          {recipe.averageRating > 0 ? `${recipe.averageRating.toFixed(1)} ⭐ (${recipe.reviewCount})` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Link
                              to={`/recipes/${recipe.id}`}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" />
                            </Link>
                            <button
                              onClick={() => handleEdit(recipe)}
                              className="p-1.5 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded"
                              title="Chỉnh sửa"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {recipe.status === 'pending' && (
                              <button
                                onClick={() => handleStatusChange(recipe.id, 'visible')}
                                className="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                                title="Duyệt công thức"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            {recipe.status === 'visible' ? (
                              <button
                                onClick={() => handleStatusChange(recipe.id, 'hidden')}
                                className="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                                title="Ẩn công thức"
                              >
                                <EyeOff className="w-4 h-4" />
                              </button>
                            ) : recipe.status === 'hidden' && (
                              <button
                                onClick={() => handleStatusChange(recipe.id, 'visible')}
                                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                title="Hiển thị công thức"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(recipe.id, recipe.recipeName)}
                              className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                              title="Xóa công thức"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 px-6 py-4 rounded-xl shadow-sm">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Hiển thị <span className="font-medium">{(page - 1) * limit + 1}</span> đến{' '}
                <span className="font-medium">{Math.min(page * limit, total)}</span> trong tổng số{' '}
                <span className="font-medium">{total}</span> kết quả
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trước
                </button>
                <span className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                  Trang {page}
                </span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * limit >= total}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
              </div>
            </div>
          </>
        )}

        {/* Edit Modal - Full screen với tabs */}
        {showEditModal && editingRecipe && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] flex flex-col">
              <form onSubmit={handleSaveEdit} className="flex flex-col h-full">
                {/* Modal Header */}
                <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Chỉnh sửa công thức: {editingRecipe.recipeName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-2xl"
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
                <div className="bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Lưu toàn bộ thay đổi
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminRecipes;
