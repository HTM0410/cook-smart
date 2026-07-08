import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { splitRevealLeft, cardReveal, easeFluid } from '../lib/motion';
import {
  Loader2,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  Carrot,
  Tag,
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
    if (!categoryId) return 'bg-paper-light text-ink-secondary';
    const colors = [
      'bg-[#E5EDF6] text-[#3D5A80]',
      'bg-[#EDF3EC] text-[#346538]',
      'bg-[#FBF3DB] text-[#956400]',
      'bg-[#fff4ed] text-[#ff4f00]',
      'bg-[#FDEBEC] text-[#9F2F2D]',
      'bg-[#FBF3DB] text-[#956400]',
    ];
    return colors[(categoryId - 1) % colors.length];
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <motion.div initial="hidden" animate="visible" variants={splitRevealLeft}>
          <EyebrowTag>Quản trị</EyebrowTag>
          <h1 className="mt-4 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
            Nguyên liệu.
          </h1>
          <p className="mt-4 text-ink-secondary text-pretty">
            Tổng số: <span className="font-semibold text-ink-primary dark:text-paper-light">{total}</span> {activeTab === 'ingredients' ? 'nguyên liệu' : 'yêu cầu chờ duyệt'}
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="card-bezel">
          <div className="card-bezel-inner p-0">
            <div className="flex w-full overflow-x-auto">
              {[
                { id: 'ingredients' as const, label: 'Nguyên liệu', Icon: Carrot },
                { id: 'pending' as const, label: 'Chờ duyệt', Icon: Clock, count: pendingIngredients.filter(p => p.status === 'pending').length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setPage(1);
                  }}
                  className={`relative flex h-12 min-w-max items-center gap-2 px-5 text-xs font-bold uppercase tracking-[0.15em] transition-colors duration-500 ease-[var(--ease-fluid)] ${
                    activeTab === tab.id
                      ? 'text-[#ff4f00]'
                      : 'text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light'
                  }`}
                >
                  <tab.Icon className="h-4 w-4" strokeWidth={1.5} />
                  {tab.label}
                  {tab.count && tab.count > 0 && (
                    <span className="ml-1 bg-[#9F2F2D] text-white text-[10px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center font-semibold">
                      {tab.count}
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <motion.span
                      layoutId="admin-ingredients-active"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff4f00]"
                      transition={{ duration: 0.4, ease: easeFluid }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Filter Bar */}
        {activeTab === 'ingredients' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeFluid }}
            className="card-bezel"
          >
            <div className="card-bezel-inner p-5">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-ink-secondary pointer-events-none" strokeWidth={1.5} />
                  <input
                    type="text"
                    placeholder="Tìm kiếm nguyên liệu..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    className="input-bezel-inner h-11 pl-11 pr-4 text-sm w-full"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-ink-secondary" strokeWidth={1.5} />
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setPage(1);
                    }}
                    className="h-11 px-4 text-sm rounded-2xl ring-1 ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700 text-ink-primary dark:text-paper-light focus:outline-none focus:ring-2 focus:ring-[#ff4f00] min-w-[180px] transition-all duration-500 ease-[var(--ease-fluid)] cursor-pointer"
                  >
                    <option value="">Tất cả danh mục</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.categoryName}
                      </option>
                    ))}
                  </select>
                </div>
                <button onClick={handleSearch} className="btn-editorial-primary justify-center">
                  <Search className="h-4 w-4" strokeWidth={1.5} />
                  Tìm kiếm
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Content */}
        {loading ? (
          <div className="card-bezel">
            <div className="card-bezel-inner p-12 flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#ff4f00]" strokeWidth={1.5} />
              <span className="text-sm uppercase tracking-[0.2em] text-ink-secondary">Đang tải...</span>
            </div>
          </div>
        ) : activeTab === 'ingredients' ? (
          ingredients.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeFluid }}
              className="card-bezel max-w-2xl mx-auto"
            >
              <div className="card-bezel-inner p-12 md:p-16 text-center">
                <Carrot className="w-16 h-16 mx-auto text-ink-muted mb-4" strokeWidth={1} />
                <p className="text-ink-secondary text-lg">Không tìm thấy nguyên liệu nào</p>
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
                          {['Tên nguyên liệu', 'Đơn vị', 'Danh mục', 'Ngày tạo', 'Thao tác'].map((h, i) => (
                            <th
                              key={h}
                              className={`px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary ${i === 4 ? 'text-right' : 'text-left'}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-200/40 dark:divide-ink-700/40">
                        {ingredients.map((ingredient, idx) => (
                          <motion.tr
                            key={ingredient.id}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, ease: easeFluid, delay: idx * 0.03 }}
                            className="hover:bg-paper-light dark:hover:bg-ink-700/30 transition-colors duration-500 ease-[var(--ease-fluid)]"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#EDF3EC] dark:bg-[#346538]/15 ring-1 ring-[#346538]/30 flex items-center justify-center flex-shrink-0">
                                  <Carrot className="h-4 w-4 text-[#346538]" strokeWidth={1.5} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-ink-primary dark:text-paper-light">
                                    {ingredient.ingredientName}
                                  </p>
                                  {ingredient.description && (
                                    <p className="text-xs text-ink-muted mt-0.5 truncate max-w-xs">
                                      {ingredient.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="eyebrow-tag text-[10px] bg-paper-light text-ink-secondary">
                                {ingredient.unit || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {ingredient.category ? (
                                <span className={`eyebrow-tag text-[10px] ${getCategoryColor(ingredient.category.id)}`}>
                                  {ingredient.category.categoryName}
                                </span>
                              ) : (
                                <span className="eyebrow-tag text-[10px] bg-paper-light text-ink-muted">
                                  Chưa phân loại
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-ink-secondary">
                                <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                                {getTimeAgo(ingredient.createdAt)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700/40 hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                                  title="Chỉnh sửa"
                                >
                                  <Edit className="h-4 w-4" strokeWidth={1.5} />
                                </button>
                                <button
                                  className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-[#9F2F2D] hover:bg-[#FDEBEC] dark:hover:bg-[#9F2F2D]/15 hover:ring-[#9F2F2D]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                                  title="Xóa"
                                >
                                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
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
              {total > limit && (
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
                        Trang {page} / {Math.ceil(total / limit)}
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
              )}
            </>
          )
        ) : (
          pendingIngredients.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: easeFluid }}
              className="card-bezel max-w-2xl mx-auto"
            >
              <div className="card-bezel-inner p-12 md:p-16 text-center">
                <Clock className="w-16 h-16 mx-auto text-ink-muted mb-4" strokeWidth={1} />
                <p className="text-ink-secondary text-lg">Không có yêu cầu chờ duyệt</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              className="space-y-4"
            >
              {pendingIngredients.map((pending, idx) => (
                <motion.div
                  key={pending.id}
                  custom={idx}
                  variants={cardReveal}
                >
                  <div className="card-bezel">
                    <div className="card-bezel-inner p-5 md:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-3 flex-wrap">
                            <div className="w-12 h-12 rounded-full bg-[#FBF3DB] ring-1 ring-[#956400]/30 flex items-center justify-center flex-shrink-0">
                              <Carrot className="h-5 w-5 text-[#956400]" strokeWidth={1.5} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-semibold text-ink-primary dark:text-paper-light text-display">
                                {pending.ingredientName}
                              </h3>
                              <div className="flex items-center gap-3 mt-1 text-xs uppercase tracking-[0.15em] text-ink-muted flex-wrap">
                                <span>
                                  Yêu cầu bởi: <span className="font-semibold text-ink-primary dark:text-paper-light normal-case">{pending.user?.fullName || 'N/A'}</span>
                                </span>
                                <span>·</span>
                                <span className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3" strokeWidth={1.5} />
                                  {getTimeAgo(pending.createdAt)}
                                </span>
                              </div>
                            </div>
                            <span className="eyebrow-tag text-[10px] bg-[#FBF3DB] text-[#956400]">
                              Chờ duyệt
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleApprovePending(pending.id, pending.ingredientName)}
                            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-[#346538] text-white text-sm font-medium hover:bg-[#2a5430] transition-colors duration-500 ease-[var(--ease-fluid)]"
                          >
                            <CheckCircle className="w-4 h-4" strokeWidth={1.5} />
                            Duyệt
                          </button>
                          <button
                            onClick={() => handleRejectPending(pending.id, pending.ingredientName)}
                            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium text-[#9F2F2D] ring-1 ring-ink-200/40 dark:ring-ink-700/40 hover:bg-[#FDEBEC] dark:hover:bg-[#9F2F2D]/15 hover:ring-[#9F2F2D]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                          >
                            <XCircle className="w-4 h-4" strokeWidth={1.5} />
                            Từ chối
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminIngredients;
