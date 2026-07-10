import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import {
  Loader2,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Carrot,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Ingredient {
  id: number;
  ingredientName: string;
  unit?: string;
  categoryId?: number;
  category?: {
    id: number;
    categoryName: string;
  };
  description?: string;
  createdAt: string;
  updatedAt: string;
}

interface PendingIngredient {
  id: number;
  ingredientName: string;
  requestedBy: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
}

interface IngredientCategory {
  id: number;
  categoryName: string;
}

const AdminIngredients: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ingredients' | 'pending'>('ingredients');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [pendingIngredients, setPendingIngredients] = useState<PendingIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [categories, setCategories] = useState<IngredientCategory[]>([]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'ingredients') {
      fetchIngredients();
    } else {
      fetchPendingIngredients();
    }
  }, [activeTab, page, selectedCategory]);

  const fetchCategories = async () => {
    try {
      const response = await adminService.getIngredientCategories();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchIngredients = async () => {
    try {
      setLoading(true);
      const response = await adminService.getIngredients({
        page,
        limit,
        search: searchTerm,
        category: selectedCategory || undefined,
      });
      setIngredients(response.data.ingredients);
      setTotal(response.data.pagination.total);
    } catch (error) {
      console.error('Error fetching ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingIngredients = async () => {
    try {
      setLoading(true);
      setPendingIngredients([
        {
          id: 1,
          ingredientName: 'Bột mì nguyên cám',
          requestedBy: 36,
          status: 'pending',
          createdAt: new Date().toISOString(),
          user: { id: 36, fullName: 'Lê Văn An', email: 'user@example.com' },
        },
        {
          id: 2,
          ingredientName: 'Nước tương Nhật',
          requestedBy: 36,
          status: 'pending',
          createdAt: new Date().toISOString(),
          user: { id: 36, fullName: 'Trần Thị Bình', email: 'user2@example.com' },
        },
        {
          id: 3,
          ingredientName: 'Miso paste',
          requestedBy: 37,
          status: 'pending',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          user: { id: 37, fullName: 'Nguyễn Minh Cường', email: 'user3@example.com' },
        },
      ]);
      setTotal(3);
    } catch (error) {
      console.error('Error fetching pending ingredients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchIngredients();
  };

  const handleApprovePending = async (id: number, ingredientName: string) => {
    if (!confirm(`Bạn có chắc muốn duyệt nguyên liệu "${ingredientName}"?`)) return;

    try {
      alert('Chức năng đang được phát triển');
      fetchPendingIngredients();
    } catch (error) {
      console.error('Error approving ingredient:', error);
      alert('Có lỗi xảy ra khi duyệt nguyên liệu');
    }
  };

  const handleRejectPending = async (id: number, ingredientName: string) => {
    const reason = prompt(`Lý do từ chối nguyên liệu "${ingredientName}"?`);
    if (!reason) return;

    try {
      alert('Chức năng đang được phát triển');
      fetchPendingIngredients();
    } catch (error) {
      console.error('Error rejecting ingredient:', error);
      alert('Có lỗi xảy ra khi từ chối nguyên liệu');
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

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Nguyên liệu</h1>
          <p className="admin-page-subtitle">
            Quản lý nguyên liệu và duyệt các yêu cầu thêm mới — tổng cộng{' '}
            <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
              {total}
            </span>{' '}
            {activeTab === 'ingredients' ? 'nguyên liệu' : 'yêu cầu chờ duyệt'}.
          </p>
        </div>

        {/* Tabs */}
        <div className="admin-card">
          <div className="admin-tabs" style={{ padding: '0 12px' }}>
            <button
              onClick={() => {
                setActiveTab('ingredients');
                setPage(1);
              }}
              className={`admin-tab ${activeTab === 'ingredients' ? 'active' : ''}`}
            >
              <Carrot className="w-4 h-4" strokeWidth={2} />
              Nguyên liệu
            </button>
            <button
              onClick={() => {
                setActiveTab('pending');
                setPage(1);
              }}
              className={`admin-tab ${activeTab === 'pending' ? 'active' : ''}`}
            >
              <Clock className="w-4 h-4" strokeWidth={2} />
              Chờ duyệt
              {pendingIngredients.filter((p) => p.status === 'pending').length > 0 && (
                <span
                  className="admin-badge admin-badge-danger"
                  style={{ marginLeft: 4 }}
                >
                  {pendingIngredients.filter((p) => p.status === 'pending').length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        {activeTab === 'ingredients' && (
          <div className="admin-card">
            <div className="admin-card-body">
              <div className="admin-toolbar">
                <input
                  type="text"
                  placeholder="Tìm kiếm nguyên liệu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  style={{ flex: 1, minWidth: 240 }}
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Tất cả danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.categoryName}
                    </option>
                  ))}
                </select>
                <button onClick={handleSearch}>
                  <Search className="w-4 h-4" strokeWidth={2} />
                  Tìm kiếm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="admin-card">
            <div className="admin-loading">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
              <span>Đang tải...</span>
            </div>
          </div>
        ) : activeTab === 'ingredients' ? (
          ingredients.length === 0 ? (
            <div className="admin-card">
              <div className="admin-empty">
                <Carrot className="w-10 h-10" style={{ color: 'var(--admin-text-muted)' }} strokeWidth={1.5} />
                <span>Không tìm thấy nguyên liệu nào</span>
              </div>
            </div>
          ) : (
            <>
              <div className="admin-card">
                <div className="overflow-x-auto">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Tên nguyên liệu</th>
                        <th>Đơn vị</th>
                        <th>Danh mục</th>
                        <th>Ngày tạo</th>
                        <th className="text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ingredients.map((ingredient) => (
                        <tr key={ingredient.id}>
                          <td>
                            <div className="flex items-center gap-3">
                              <div
                                className="admin-avatar admin-avatar-success"
                                style={{ width: 32, height: 32 }}
                              >
                                <Carrot className="w-4 h-4" strokeWidth={2} />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="text-sm font-semibold"
                                  style={{ color: 'var(--admin-text)' }}
                                >
                                  {ingredient.ingredientName}
                                </p>
                                {ingredient.description && (
                                  <p
                                    className="text-xs truncate max-w-xs"
                                    style={{ color: 'var(--admin-text-muted)' }}
                                  >
                                    {ingredient.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="admin-badge admin-badge-neutral">
                              {ingredient.unit || '—'}
                            </span>
                          </td>
                          <td>
                            {ingredient.category ? (
                              <span className="admin-badge admin-badge-info">
                                {ingredient.category.categoryName}
                              </span>
                            ) : (
                              <span className="admin-badge admin-badge-neutral">Chưa phân loại</span>
                            )}
                          </td>
                          <td className="text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                              {getTimeAgo(ingredient.createdAt)}
                            </span>
                          </td>
                          <td className="text-right">
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button className="admin-action" title="Chỉnh sửa">
                                <Edit className="w-4 h-4" strokeWidth={2} />
                              </button>
                              <button className="admin-action admin-action-danger" title="Xóa">
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

              {total > limit && (
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
                    <span style={{ color: 'var(--admin-text-secondary)' }}>
                      Trang {page} / {Math.ceil(total / limit)}
                    </span>
                    <button onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}>
                      Sau
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        ) : pendingIngredients.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">
              <Clock className="w-10 h-10" style={{ color: 'var(--admin-text-muted)' }} strokeWidth={1.5} />
              <span>Không có yêu cầu chờ duyệt</span>
            </div>
          </div>
        ) : (
          <div className="admin-card">
            <ul style={{ borderColor: 'var(--admin-border)' }}>
              {pendingIngredients.map((pending, idx) => (
                <li
                  key={pending.id}
                  style={{
                    borderTop: idx === 0 ? 'none' : '1px solid var(--admin-border)',
                    padding: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    className="admin-avatar admin-avatar-warning"
                    style={{ width: 40, height: 40 }}
                  >
                    <Carrot className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <h3 className="text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
                      {pending.ingredientName}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                      <span>
                        Yêu cầu bởi:{' '}
                        <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
                          {pending.user?.fullName || 'N/A'}
                        </span>
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" strokeWidth={2} />
                        {getTimeAgo(pending.createdAt)}
                      </span>
                    </div>
                  </div>
                  <span className="admin-badge admin-badge-warning">Chờ duyệt</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => handleApprovePending(pending.id, pending.ingredientName)}
                      style={{
                        height: 36,
                        padding: '0 14px',
                        background: 'var(--admin-success)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 'var(--admin-radius-sm)',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <CheckCircle className="w-4 h-4" strokeWidth={2} />
                      Duyệt
                    </button>
                    <button
                      onClick={() => handleRejectPending(pending.id, pending.ingredientName)}
                      className="admin-action admin-action-danger"
                      style={{ width: 'auto', padding: '0 14px', height: 36 }}
                    >
                      <XCircle className="w-4 h-4" strokeWidth={2} />
                      <span style={{ marginLeft: 4, fontSize: 13, fontWeight: 600 }}>Từ chối</span>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminIngredients;