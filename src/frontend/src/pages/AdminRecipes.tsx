import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import recipeService from '../services/recipeService';
import { Loader2, Edit, Trash2, Eye, EyeOff, Plus, ChevronLeft, ChevronRight, X, ArrowUp, ArrowDown, CheckCircle, Search } from 'lucide-react';
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
      const response = await recipeService.getRecipeById(recipe.id);
      const responseData = response.data as any;
      const recipeData = responseData?.recipe || responseData?.data?.recipe || responseData;

      const ingredients: RecipeIngredientItem[] = (recipeData.ingredients || []).map((ing: any) => {
        const quantity = ing.RecipeIngredient?.quantity || ing.quantity || 0;
        const unit = ing.RecipeIngredient?.unit || ing.unit || '';
        const name = ing.ingredientName || ing.ingredient?.ingredientName || ing.name || '';
        return { id: ing.id, ingredientName: name, quantity, unit };
      });

      const steps: RecipeStepItem[] = (recipeData.steps || [])
        .map((step: any) => ({
          id: step.id,
          stepNumber: step.stepNumber,
          instruction: step.instruction || step.description || '',
        }))
        .sort((a: RecipeStepItem, b: RecipeStepItem) => a.stepNumber - b.stepNumber);

      setEditingRecipe({ ...recipe, ...recipeData, ingredients, steps });
      setShowEditModal(true);
      setModalTab('basic');
    } catch (error) {
      console.error('Error loading recipe details:', error);
      alert('Có lỗi khi tải chi tiết công thức. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const addIngredient = () => {
    if (!editingRecipe) return;
    setEditingRecipe({
      ...editingRecipe,
      ingredients: [...(editingRecipe.ingredients || []), { ingredientName: '', quantity: 0, unit: 'gram' }],
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
    setEditingRecipe({
      ...editingRecipe,
      steps: [...(editingRecipe.steps || []), { stepNumber: (editingRecipe.steps?.length || 0) + 1, instruction: '' }],
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
    const updated =
      editingRecipe.steps
        ?.filter((_, i) => i !== index)
        .map((step, i) => ({ ...step, stepNumber: i + 1 })) || [];
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

      const updateData = {
        recipeName: editingRecipe.recipeName,
        description: editingRecipe.description,
        difficulty: editingRecipe.difficulty,
        status: editingRecipe.status,
        prepTime: editingRecipe.prepTime,
        cookTime: editingRecipe.cookTime,
        servings: editingRecipe.servings,
        ingredients: editingRecipe.ingredients?.map((ing) => ({
          ingredientName: ing.ingredientName,
          quantity: ing.quantity,
          unit: ing.unit,
        })),
        steps: editingRecipe.steps?.map((step) => ({
          stepNumber: step.stepNumber,
          instruction: step.instruction,
        })),
      };

      await adminService.updateRecipe(editingRecipe.id, updateData);
      alert('Cập nhật công thức thành công!');
      setShowEditModal(false);
      fetchRecipes();
    } catch (error) {
      console.error('Error updating recipe:', error);
      alert('Có lỗi xảy ra khi cập nhật công thức. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'visible':
        return 'admin-badge-success';
      case 'pending':
        return 'admin-badge-warning';
      default:
        return 'admin-badge-neutral';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'visible':
        return 'Hiển thị';
      case 'pending':
        return 'Chờ duyệt';
      case 'hidden':
        return 'Ẩn';
      default:
        return status;
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'Dễ';
      case 'medium':
        return 'Trung bình';
      case 'hard':
        return 'Khó';
      default:
        return difficulty;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Công thức</h1>
          <p className="admin-page-subtitle">
            Quản lý các công thức nấu ăn — tổng cộng{' '}
            <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
              {total}
            </span>{' '}
            công thức.
          </p>
        </div>

        {/* Filters */}
        <div className="admin-card">
          <div className="admin-card-body">
            <div className="admin-toolbar">
              <input
                type="text"
                placeholder="Tìm kiếm công thức..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                style={{ flex: 1, minWidth: 240 }}
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="visible">Hiển thị</option>
                <option value="pending">Chờ duyệt</option>
                <option value="hidden">Ẩn</option>
              </select>
              <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)}>
                <option value="">Tất cả độ khó</option>
                <option value="easy">Dễ</option>
                <option value="medium">Trung bình</option>
                <option value="hard">Khó</option>
              </select>
              <button onClick={handleSearch}>
                <Search className="w-4 h-4" strokeWidth={2} />
                Tìm kiếm
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="admin-card">
            <div className="admin-loading">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
              <span>Đang tải...</span>
            </div>
          </div>
        ) : recipes.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">Không tìm thấy công thức nào</div>
          </div>
        ) : (
          <>
            <div className="admin-card">
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 260 }}>Công thức</th>
                      <th>Độ khó</th>
                      <th>Thời gian</th>
                      <th>Trạng thái</th>
                      <th>Đánh giá</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipes.map((recipe) => (
                      <tr key={recipe.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="admin-avatar"
                              style={{
                                background: 'rgba(249, 115, 22, 0.12)',
                                color: 'var(--admin-accent)',
                                fontSize: 18,
                              }}
                            >
                              🍳
                            </div>
                            <div className="min-w-0 max-w-xs">
                              <p
                                className="text-sm font-semibold truncate"
                                style={{ color: 'var(--admin-text)' }}
                              >
                                {recipe.recipeName}
                              </p>
                              <p
                                className="text-xs truncate"
                                style={{ color: 'var(--admin-text-muted)' }}
                              >
                                {recipe.description}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
                          {getDifficultyText(recipe.difficulty)}
                        </td>
                        <td
                          className="text-sm tabular-nums"
                          style={{ color: 'var(--admin-text-secondary)' }}
                        >
                          {recipe.prepTime + recipe.cookTime} phút
                        </td>
                        <td>
                          <span className={`admin-badge ${getStatusBadge(recipe.status)}`}>
                            {getStatusText(recipe.status)}
                          </span>
                        </td>
                        <td className="text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
                          {recipe.averageRating > 0
                            ? `${recipe.averageRating.toFixed(1)} ★ (${recipe.reviewCount})`
                            : '—'}
                        </td>
                        <td className="text-right">
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <Link
                              to={`/recipes/${recipe.id}`}
                              className="admin-action"
                              title="Xem chi tiết"
                            >
                              <Eye className="w-4 h-4" strokeWidth={2} />
                            </Link>
                            <button
                              onClick={() => handleEdit(recipe)}
                              className="admin-action admin-action-primary"
                              title="Chỉnh sửa"
                            >
                              <Edit className="w-4 h-4" strokeWidth={2} />
                            </button>
                            {recipe.status === 'visible' ? (
                              <button
                                onClick={() => handleStatusChange(recipe.id, 'hidden')}
                                className="admin-action"
                                title="Ẩn công thức"
                              >
                                <EyeOff className="w-4 h-4" strokeWidth={2} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(recipe.id, 'visible')}
                                className="admin-action admin-action-success"
                                title="Hiển thị công thức"
                              >
                                <Eye className="w-4 h-4" strokeWidth={2} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(recipe.id, recipe.recipeName)}
                              className="admin-action admin-action-danger"
                              title="Xóa công thức"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={2} />
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
            <div className="admin-pagination">
              <span>
                Hiển thị <strong style={{ color: 'var(--admin-text)' }}>{(page - 1) * limit + 1}</strong>–
                <strong style={{ color: 'var(--admin-text)' }}>{Math.min(page * limit, total)}</strong> trong tổng số{' '}
                <strong style={{ color: 'var(--admin-text)' }}>{total}</strong> kết quả
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                  Trước
                </button>
                <span style={{ color: 'var(--admin-text-secondary)' }}>Trang {page}</span>
                <button onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}>
                  Sau
                  <ChevronRight className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* Edit Modal */}
        {showEditModal && editingRecipe && (
          <div className="admin-modal-backdrop" onClick={() => setShowEditModal(false)}>
            <div
              className="admin-modal"
              style={{ maxWidth: 760 }}
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                {/* Modal Header */}
                <div className="admin-modal-header">
                  <h2 className="admin-modal-title">Chỉnh sửa: {editingRecipe.recipeName}</h2>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="admin-action"
                  >
                    <X className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>

                {/* Tabs */}
                <div className="admin-tabs" style={{ padding: '0 20px' }}>
                  <button
                    type="button"
                    onClick={() => setModalTab('basic')}
                    className={`admin-tab ${modalTab === 'basic' ? 'active' : ''}`}
                  >
                    Thông tin cơ bản
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('ingredients')}
                    className={`admin-tab ${modalTab === 'ingredients' ? 'active' : ''}`}
                  >
                    Nguyên liệu ({editingRecipe.ingredients?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('steps')}
                    className={`admin-tab ${modalTab === 'steps' ? 'active' : ''}`}
                  >
                    Các bước ({editingRecipe.steps?.length || 0})
                  </button>
                </div>

                {/* Modal Body */}
                <div className="admin-modal-body">
                  {modalTab === 'basic' && (
                    <div className="space-y-4">
                      <div className="admin-field">
                        <label className="admin-label">Tên công thức *</label>
                        <input
                          className="admin-input"
                          type="text"
                          value={editingRecipe.recipeName}
                          onChange={(e) => setEditingRecipe({ ...editingRecipe, recipeName: e.target.value })}
                          required
                        />
                      </div>

                      <div className="admin-field">
                        <label className="admin-label">Mô tả</label>
                        <textarea
                          className="admin-textarea"
                          value={editingRecipe.description}
                          onChange={(e) => setEditingRecipe({ ...editingRecipe, description: e.target.value })}
                          rows={4}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="admin-field">
                          <label className="admin-label">Độ khó *</label>
                          <select
                            className="admin-select"
                            value={editingRecipe.difficulty}
                            onChange={(e) =>
                              setEditingRecipe({ ...editingRecipe, difficulty: e.target.value as any })
                            }
                            required
                          >
                            <option value="easy">Dễ</option>
                            <option value="medium">Trung bình</option>
                            <option value="hard">Khó</option>
                          </select>
                        </div>

                        <div className="admin-field">
                          <label className="admin-label">Trạng thái *</label>
                          <select
                            className="admin-select"
                            value={editingRecipe.status}
                            onChange={(e) => setEditingRecipe({ ...editingRecipe, status: e.target.value as any })}
                            required
                          >
                            <option value="visible">Hiển thị</option>
                            <option value="hidden">Ẩn</option>
                            <option value="pending">Chờ duyệt</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="admin-field">
                          <label className="admin-label">Chuẩn bị (phút) *</label>
                          <input
                            type="number"
                            className="admin-input"
                            value={editingRecipe.prepTime}
                            onChange={(e) =>
                              setEditingRecipe({ ...editingRecipe, prepTime: parseInt(e.target.value) || 0 })
                            }
                            min="0"
                            required
                          />
                        </div>

                        <div className="admin-field">
                          <label className="admin-label">Nấu (phút) *</label>
                          <input
                            type="number"
                            className="admin-input"
                            value={editingRecipe.cookTime}
                            onChange={(e) =>
                              setEditingRecipe({ ...editingRecipe, cookTime: parseInt(e.target.value) || 0 })
                            }
                            min="0"
                            required
                          />
                        </div>

                        <div className="admin-field">
                          <label className="admin-label">Khẩu phần *</label>
                          <input
                            type="number"
                            className="admin-input"
                            value={editingRecipe.servings}
                            onChange={(e) =>
                              setEditingRecipe({ ...editingRecipe, servings: parseInt(e.target.value) || 1 })
                            }
                            min="1"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {modalTab === 'ingredients' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
                          Danh sách nguyên liệu
                        </h3>
                        <button type="button" onClick={addIngredient} className="admin-action admin-action-success" style={{ width: 'auto', padding: '6px 12px' }}>
                          <Plus className="w-4 h-4" strokeWidth={2} />
                          Thêm nguyên liệu
                        </button>
                      </div>

                      {editingRecipe.ingredients && editingRecipe.ingredients.length > 0 ? (
                        <div className="space-y-2">
                          {editingRecipe.ingredients.map((ing, index) => (
                            <div
                              key={index}
                              className="flex gap-2 p-3 rounded-md"
                              style={{ background: 'var(--admin-surface-alt)', border: '1px solid var(--admin-border)' }}
                            >
                              <input
                                type="text"
                                placeholder="Tên nguyên liệu"
                                value={ing.ingredientName}
                                onChange={(e) => updateIngredient(index, 'ingredientName', e.target.value)}
                                className="admin-input"
                                style={{ flex: 1 }}
                                required
                              />
                              <input
                                type="number"
                                placeholder="Số lượng"
                                value={ing.quantity}
                                onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                                className="admin-input"
                                style={{ width: 110 }}
                                required
                              />
                              <input
                                type="text"
                                placeholder="Đơn vị"
                                value={ing.unit}
                                onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                                className="admin-input"
                                style={{ width: 120 }}
                                required
                              />
                              <button
                                type="button"
                                onClick={() => removeIngredient(index)}
                                className="admin-action admin-action-danger"
                              >
                                <X className="w-4 h-4" strokeWidth={2} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="admin-empty">Chưa có nguyên liệu nào. Nhấn "Thêm nguyên liệu" để bắt đầu.</div>
                      )}
                    </div>
                  )}

                  {modalTab === 'steps' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
                          Các bước nấu
                        </h3>
                        <button type="button" onClick={addStep} className="admin-action admin-action-success" style={{ width: 'auto', padding: '6px 12px' }}>
                          <Plus className="w-4 h-4" strokeWidth={2} />
                          Thêm bước
                        </button>
                      </div>

                      {editingRecipe.steps && editingRecipe.steps.length > 0 ? (
                        <div className="space-y-2">
                          {editingRecipe.steps.map((step, index) => (
                            <div
                              key={index}
                              className="flex gap-2 p-3 rounded-md"
                              style={{ background: 'var(--admin-surface-alt)', border: '1px solid var(--admin-border)' }}
                            >
                              <div
                                className="flex-shrink-0"
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 999,
                                  background: 'var(--admin-accent)',
                                  color: '#fff',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 700,
                                  fontSize: 13,
                                }}
                              >
                                {step.stepNumber}
                              </div>
                              <textarea
                                placeholder="Mô tả bước làm..."
                                value={step.instruction}
                                onChange={(e) => updateStep(index, e.target.value)}
                                rows={2}
                                className="admin-textarea"
                                style={{ flex: 1, minHeight: 60 }}
                                required
                              />
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveStep(index, 'up')}
                                  disabled={index === 0}
                                  className="admin-action"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" strokeWidth={2} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveStep(index, 'down')}
                                  disabled={index === editingRecipe.steps!.length - 1}
                                  className="admin-action"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeStep(index)}
                                className="admin-action admin-action-danger"
                              >
                                <X className="w-4 h-4" strokeWidth={2} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="admin-empty">Chưa có bước nấu nào. Nhấn "Thêm bước" để bắt đầu.</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="admin-modal-footer">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="admin-action admin-toolbar-ghost"
                    style={{ width: 'auto', padding: '0 16px', height: 38 }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    style={{
                      height: 38,
                      padding: '0 16px',
                      background: 'var(--admin-accent)',
                      color: '#fff',
                      border: '1px solid var(--admin-accent)',
                      borderRadius: 'var(--admin-radius-sm)',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <CheckCircle className="w-4 h-4" strokeWidth={2} />
                    Lưu thay đổi
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