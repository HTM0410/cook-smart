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
  Filter,
  Package,
  Carrot,
  Tag,
  Plus,
  MoreVertical
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
      // Mock data for pending ingredients - Replace with actual API call
      // const response = await adminService.getPendingIngredients();
      setPendingIngredients([
        {
          id: 1,
          ingredientName: 'Bột mì nguyên cám',
          requestedBy: 36,
          status: 'pending',
          createdAt: new Date().toISOString(),
          user: { id: 36, fullName: 'Lê Văn An', email: 'user@example.com' }
        },
        {
          id: 2,
          ingredientName: 'Nước tương Nhật',
          requestedBy: 36,
          status: 'pending',
          createdAt: new Date().toISOString(),
          user: { id: 36, fullName: 'Trần Thị Bình', email: 'user2@example.com' }
        },
        {
          id: 3,
          ingredientName: 'Miso paste',
          requestedBy: 37,
          status: 'pending',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          user: { id: 37, fullName: 'Nguyễn Minh Cường', email: 'user3@example.com' }
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
      // await adminService.approvePendingIngredient(id);
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
      // await adminService.rejectPendingIngredient(id, reason);
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

  const getCategoryColor = (categoryId?: number) => {
    if (!categoryId) return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    const colors = [
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    ];
    return colors[(categoryId - 1) % colors.length];
  };

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Quản lý nguyên liệu
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Tổng số: <span className="font-semibold text-gray-900 dark:text-gray-100">{total}</span> {activeTab === 'ingredients' ? 'nguyên liệu' : 'yêu cầu chờ duyệt'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              setActiveTab('ingredients');
              setPage(1);
            }}
            className={`px-6 py-3 font-semibold border-b-2 transition-colors relative ${
              activeTab === 'ingredients'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Carrot className="h-5 w-5" />
              <span>Nguyên liệu</span>
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab('pending');
              setPage(1);
            }}
            className={`px-6 py-3 font-semibold border-b-2 transition-colors relative ${
              activeTab === 'pending'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Chờ duyệt</span>
              {pendingIngredients.filter(p => p.status === 'pending').length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingIngredients.filter(p => p.status === 'pending').length}
                </span>
              )}
            </div>
          </button>
        </div>

        {/* Search and Filter Bar */}
        {activeTab === 'ingredients' && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm nguyên liệu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Filter className="h-5 w-5 text-gray-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]"
                >
                  <option value="">Tất cả danh mục</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.categoryName}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center space-x-2 font-medium"
              >
                <Search className="h-5 w-5" />
                <span>Tìm kiếm</span>
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-2xl shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Đang tải...</span>
          </div>
        ) : activeTab === 'ingredients' ? (
          /* Ingredients Table */
          ingredients.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center">
              <Carrot className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">Không tìm thấy nguyên liệu nào</p>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b dark:border-gray-600">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Tên nguyên liệu
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Đơn vị
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Danh mục
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Ngày tạo
                        </th>
                        <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Thao tác
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {ingredients.map((ingredient) => (
                        <tr 
                          key={ingredient.id} 
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-md">
                                <Carrot className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                  {ingredient.ingredientName}
                                </p>
                                {ingredient.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {ingredient.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {ingredient.unit || '-'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {ingredient.category ? (
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(ingredient.category.id)}`}>
                                <Tag className="h-3 w-3 mr-1" />
                                {ingredient.category.categoryName}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                Chưa phân loại
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                            <div className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{getTimeAgo(ingredient.createdAt)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                title="Chỉnh sửa"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Xóa"
                              >
                                <Trash2 className="h-4 w-4" />
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
              {total > limit && (
                <div className="flex items-center justify-between bg-white dark:bg-gray-800 px-6 py-4 rounded-2xl shadow-sm">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Hiển thị <span className="font-semibold">{(page - 1) * limit + 1}</span> đến{' '}
                    <span className="font-semibold">{Math.min(page * limit, total)}</span> trong tổng số{' '}
                    <span className="font-semibold">{total}</span> kết quả
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Trước
                    </button>
                    <span className="px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg font-medium">
                      Trang {page} / {Math.ceil(total / limit)}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * limit >= total}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Sau
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        ) : (
          /* Pending Ingredients List */
          pendingIngredients.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-12 text-center">
              <Clock className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-lg">Không có yêu cầu chờ duyệt</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingIngredients.map((pending) => (
                <div
                  key={pending.id}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
                          <Carrot className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                            {pending.ingredientName}
                          </h3>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center space-x-1">
                              <Package className="h-4 w-4" />
                              <span>Yêu cầu bởi: <span className="font-medium text-gray-700 dark:text-gray-300">{pending.user?.fullName || 'N/A'}</span></span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Clock className="h-4 w-4" />
                              <span>{getTimeAgo(pending.createdAt)}</span>
                            </span>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs font-semibold">
                          Chờ duyệt
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-6">
                      <button
                        onClick={() => handleApprovePending(pending.id, pending.ingredientName)}
                        className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center gap-2 font-medium transition-colors shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Duyệt
                      </button>
                      <button
                        onClick={() => handleRejectPending(pending.id, pending.ingredientName)}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 flex items-center gap-2 font-medium transition-colors shadow-sm"
                      >
                        <XCircle className="w-4 h-4" />
                        Từ chối
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminIngredients;
