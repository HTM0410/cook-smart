import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { splitRevealLeft, cardReveal, staggerGrid, easeFluid } from '../lib/motion';
import {
  Loader2,
  Edit,
  Trash2,
  Plus,
  Tag,
  Package,
  Clock,
  Search,
  X,
} from 'lucide-react';

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

  const filteredCategories = categories.filter(cat =>
    cat.categoryName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <motion.div initial="hidden" animate="visible" variants={splitRevealLeft}>
          <EyebrowTag>Quản trị</EyebrowTag>
          <h1 className="mt-4 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
            Danh mục <span className="text-[#ff4f00]">nguyên liệu.</span>
          </h1>
          <p className="mt-4 text-ink-secondary text-pretty">
            Tổng số: <span className="font-semibold text-ink-primary dark:text-paper-light">{categories.length}</span> danh mục
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeFluid }}
          className="card-bezel"
        >
          <div className="card-bezel-inner p-5">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Tìm kiếm danh mục..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input-bezel-inner h-11 pl-11 pr-4 text-sm w-full"
                />
              </div>
              <button onClick={handleAdd} className="btn-editorial-primary justify-center">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Thêm danh mục
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
        ) : filteredCategories.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeFluid }}
            className="card-bezel max-w-2xl mx-auto"
          >
            <div className="card-bezel-inner p-12 md:p-16 text-center">
              <Tag className="w-16 h-16 mx-auto text-ink-muted mb-4" strokeWidth={1} />
              <p className="text-ink-secondary text-lg">
                {searchTerm ? 'Không tìm thấy danh mục nào' : 'Chưa có danh mục nào'}
              </p>
            </div>
          </motion.div>
        ) : (
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
                      {['Tên danh mục', 'Số nguyên liệu', 'Ngày tạo', 'Thao tác'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary ${i === 3 ? 'text-right' : 'text-left'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-200/40 dark:divide-ink-700/40">
                    {filteredCategories.map((category, idx) => (
                      <motion.tr
                        key={category.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, ease: easeFluid, delay: idx * 0.04 }}
                        className="hover:bg-paper-light dark:hover:bg-ink-700/30 transition-colors duration-500 ease-[var(--ease-fluid)]"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#E5EDF6] dark:bg-[#3D5A80]/15 ring-1 ring-[#3D5A80]/30 flex items-center justify-center flex-shrink-0">
                              <Tag className="h-4 w-4 text-[#3D5A80]" strokeWidth={1.5} />
                            </div>
                            <p className="text-sm font-semibold text-ink-primary dark:text-paper-light">
                              {category.categoryName}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="eyebrow-tag text-[10px] bg-[#EDF3EC] text-[#346538]">
                            {category.ingredientCount || 0} nguyên liệu
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-ink-secondary">
                            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {getTimeAgo(category.createdAt)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleEdit(category)}
                              className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700/40 hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                              title="Chỉnh sửa"
                            >
                              <Edit className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                            <button
                              onClick={() => handleDelete(category.id, category.categoryName)}
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
        )}

        {/* Modals */}
        <AnimatePresence>
          {(showAddModal || showEditModal) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink-700/40 backdrop-blur-sm p-4"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.96 }}
                transition={{ duration: 0.5, ease: easeFluid }}
                onClick={(e) => e.stopPropagation()}
                className="card-bezel w-full max-w-md"
              >
                <div className="card-bezel-inner p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-display text-2xl text-ink-primary dark:text-paper-light">
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
                      className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700/40 hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit}>
                    <div className="mb-5">
                      <label className="block text-xs uppercase tracking-[0.2em] text-ink-secondary mb-2 font-semibold">
                        Tên danh mục
                      </label>
                      <input
                        type="text"
                        value={formData.categoryName}
                        onChange={(e) => setFormData({ categoryName: e.target.value })}
                        className="input-bezel-inner h-11 px-4 text-sm w-full"
                        placeholder="Nhập tên danh mục..."
                        required
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddModal(false);
                          setShowEditModal(false);
                          setEditingCategory(null);
                          setFormData({ categoryName: '' });
                        }}
                        className="flex-1 h-11 rounded-full text-sm font-medium ring-1 ring-ink-200/40 dark:ring-ink-700/40 text-ink-primary dark:text-paper-light hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 btn-editorial-primary justify-center disabled:opacity-50"
                      >
                        {submitting ? 'Đang lưu...' : showEditModal ? 'Cập nhật' : 'Thêm'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminLayout>
  );
};

export default AdminIngredientCategories;