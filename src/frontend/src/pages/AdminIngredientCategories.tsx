import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import { Loader2, Edit, Trash2, Plus, Tag, Search, X } from 'lucide-react';

interface IngredientCategory {
  id: number;
  categoryName: string;
  createdAt: string;
  updatedAt: string;
  ingredientCount?: number;
}

const AdminIngredientCategories: React.FC = () => {
  const [categories, setCategories] = useState<IngredientCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<IngredientCategory | null>(null);
  const [formData, setFormData] = useState({ categoryName: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await adminService.getIngredientCategories();
      const categoriesData = response.data || [];

      const categoriesWithCount = await Promise.all(
        categoriesData.map(async (cat: IngredientCategory) => {
          try {
            const ingredientsResponse = await adminService.getIngredients({
              category: cat.id.toString(),
              limit: 1,
            });
            return {
              ...cat,
              ingredientCount: ingredientsResponse.data.pagination.total,
            };
          } catch {
            return { ...cat, ingredientCount: 0 };
          }
        })
      );

      setCategories(categoriesWithCount);
    } catch (error) {
      console.error('Error fetching categories:', error);
      alert('Có lỗi xảy ra khi tải danh mục');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setFormData({ categoryName: '' });
    setShowAddModal(true);
  };

  const handleEdit = (category: IngredientCategory) => {
    setEditingCategory(category);
    setFormData({ categoryName: category.categoryName });
    setShowEditModal(true);
  };

  const handleDelete = async (id: number, categoryName: string) => {
    if (!confirm(`Bạn có chắc muốn xóa danh mục "${categoryName}"?`)) return;
    try {
      await adminService.deleteIngredientCategory(id);
      alert('Xóa danh mục thành công!');
      fetchCategories();
    } catch (error: any) {
      console.error('Error deleting category:', error);
      const message = error.response?.data?.message || 'Có lỗi xảy ra khi xóa danh mục';
      alert(message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryName.trim()) {
      alert('Vui lòng nhập tên danh mục');
      return;
    }

    setSubmitting(true);
    try {
      if (editingCategory) {
        await adminService.updateIngredientCategory(editingCategory.id, formData);
        alert('Cập nhật danh mục thành công!');
        setShowEditModal(false);
      } else {
        await adminService.createIngredientCategory(formData);
        alert('Tạo danh mục thành công!');
        setShowAddModal(false);
      }
      setFormData({ categoryName: '' });
      setEditingCategory(null);
      fetchCategories();
    } catch (error: any) {
      console.error('Error saving category:', error);
      const message = error.response?.data?.message || 'Có lỗi xảy ra khi lưu danh mục';
      alert(message);
    } finally {
      setSubmitting(false);
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (seconds < 60) return 'vài giây trước';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;
    if (seconds < 2592000) return `${Math.floor(seconds / 604800)} tuần trước`;
    return `${Math.floor(seconds / 2592000)} tháng trước`;
  };

  const filteredCategories = categories.filter((cat) =>
    cat.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Danh mục nguyên liệu</h1>
          <p className="admin-page-subtitle">
            Quản lý các danh mục nguyên liệu — tổng cộng{' '}
            <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
              {categories.length}
            </span>{' '}
            danh mục.
          </p>
        </div>

        <div className="admin-card">
          <div className="admin-card-body">
            <div className="admin-toolbar">
              <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
                <Search
                  className="w-4 h-4"
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--admin-text-muted)',
                    pointerEvents: 'none',
                  }}
                  strokeWidth={2}
                />
                <input
                  type="text"
                  placeholder="Tìm kiếm danh mục..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', paddingLeft: 36 }}
                />
              </div>
              <button onClick={handleAdd}>
                <Plus className="w-4 h-4" strokeWidth={2} />
                Thêm danh mục
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
        ) : filteredCategories.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">
              <Tag className="w-10 h-10" style={{ color: 'var(--admin-text-muted)' }} strokeWidth={1.5} />
              <span>{searchTerm ? 'Không tìm thấy danh mục nào' : 'Chưa có danh mục nào'}</span>
            </div>
          </div>
        ) : (
          <div className="admin-card">
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Tên danh mục</th>
                    <th>Số nguyên liệu</th>
                    <th>Ngày tạo</th>
                    <th className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div
                            className="admin-avatar"
                            style={{
                              background: 'var(--admin-info-bg)',
                              color: 'var(--admin-info)',
                              width: 32,
                              height: 32,
                            }}
                          >
                            <Tag className="w-4 h-4" strokeWidth={2} />
                          </div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
                            {category.categoryName}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="admin-badge admin-badge-success">
                          {category.ingredientCount || 0} nguyên liệu
                        </span>
                      </td>
                      <td className="text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
                        {getTimeAgo(category.createdAt)}
                      </td>
                      <td className="text-right">
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            onClick={() => handleEdit(category)}
                            className="admin-action admin-action-primary"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-4 h-4" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => handleDelete(category.id, category.categoryName)}
                            className="admin-action admin-action-danger"
                            title="Xóa"
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
        )}

        {/* Modals */}
        {(showAddModal || showEditModal) && (
          <div
            className="admin-modal-backdrop"
            onClick={() => {
              setShowAddModal(false);
              setShowEditModal(false);
              setEditingCategory(null);
              setFormData({ categoryName: '' });
            }}
          >
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">
                  {showEditModal ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                    setEditingCategory(null);
                    setFormData({ categoryName: '' });
                  }}
                  className="admin-action"
                >
                  <X className="w-4 h-4" strokeWidth={2} />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="admin-modal-body">
                  <div className="admin-field">
                    <label className="admin-label">Tên danh mục</label>
                    <input
                      type="text"
                      value={formData.categoryName}
                      onChange={(e) => setFormData({ categoryName: e.target.value })}
                      className="admin-input"
                      placeholder="Nhập tên danh mục..."
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="admin-modal-footer">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingCategory(null);
                      setFormData({ categoryName: '' });
                    }}
                    className="admin-toolbar-ghost"
                    style={{
                      height: 38,
                      padding: '0 16px',
                      background: 'var(--admin-surface)',
                      color: 'var(--admin-text)',
                      border: '1px solid var(--admin-border-strong)',
                      borderRadius: 'var(--admin-radius-sm)',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      height: 38,
                      padding: '0 16px',
                      background: 'var(--admin-accent)',
                      color: '#fff',
                      border: '1px solid var(--admin-accent)',
                      borderRadius: 'var(--admin-radius-sm)',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? 'Đang lưu...' : showEditModal ? 'Cập nhật' : 'Thêm'}
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

export default AdminIngredientCategories;