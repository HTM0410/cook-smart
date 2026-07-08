import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { splitRevealLeft, cardReveal, staggerGrid, easeFluid } from '../lib/motion';
import { Loader2, Trash2, Eye, MessageSquare, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Comment {
  id: number;
  content: string;
  userId: number;
  recipeId: number;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  user?: { id: number; fullName: string; email: string };
  recipe?: { id: number; recipeName: string };
}

const AdminComments: React.FC = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);

  useEffect(() => {
    fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getComments({
        page,
        limit,
        search: searchTerm || undefined,
      });
      setComments(response.data.comments || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setError('Không thể tải danh sách bình luận. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchComments();
  };

  const handleDelete = async (commentId: number, content: string) => {
    const truncated = content.length > 50 ? content.substring(0, 50) + '...' : content;
    if (!confirm(`Bạn có chắc muốn xóa bình luận: "${truncated}"?`)) return;
    try {
      await adminService.deleteComment(commentId);
      alert('Đã xóa bình luận thành công!');
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Có lỗi xảy ra khi xóa bình luận');
    }
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
    if (seconds < 60) return 'vài giây trước';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
    return `${Math.floor(seconds / 86400)} ngày trước`;
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const editedCount = comments.filter(c => c.isEdited).length;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <motion.div initial="hidden" animate="visible" variants={splitRevealLeft}>
          <EyebrowTag>Quản trị</EyebrowTag>
          <h1 className="mt-4 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
            Bình luận.
          </h1>
          <p className="mt-4 text-ink-secondary text-pretty">
            Tổng số: <span className="font-semibold text-ink-primary dark:text-paper-light">{total}</span> bình luận
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: easeFluid }}
          className="card-bezel"
        >
          <div className="card-bezel-inner p-5">
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-secondary pointer-events-none" strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="Tìm kiếm bình luận theo nội dung, người dùng, hoặc công thức..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="input-bezel-inner h-11 pl-11 pr-4 text-sm w-full"
                />
              </div>
              <button onClick={handleSearch} className="btn-editorial-primary justify-center">
                <Search className="w-4 h-4" strokeWidth={1.5} />
                Tìm kiếm
              </button>
            </div>
          </div>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="card-bezel"
          >
            <div className="card-bezel-inner p-4 bg-[#FDEBEC] dark:bg-[#9F2F2D]/15 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-[#9F2F2D]" strokeWidth={1.5} />
                <p className="text-sm font-medium text-[#9F2F2D]">{error}</p>
              </div>
              <button onClick={fetchComments} className="link-underline text-sm font-semibold text-[#9F2F2D]">
                Thử lại
              </button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="card-bezel">
            <div className="card-bezel-inner p-12 flex items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-[#ff4f00]" strokeWidth={1.5} />
              <span className="text-sm uppercase tracking-[0.2em] text-ink-secondary">Đang tải...</span>
            </div>
          </div>
        ) : comments.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: easeFluid }}
            className="card-bezel max-w-2xl mx-auto"
          >
            <div className="card-bezel-inner p-12 md:p-16 text-center">
              <MessageSquare className="w-16 h-16 mx-auto text-ink-muted mb-4" strokeWidth={1} />
              <p className="text-ink-secondary text-lg mb-2">Không tìm thấy bình luận nào</p>
              {searchTerm && (
                <p className="text-ink-muted text-sm">Thử tìm kiếm với từ khóa khác</p>
              )}
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerGrid}
              className="space-y-4"
            >
              {comments.map((comment, idx) => (
                <motion.div key={comment.id} custom={idx} variants={cardReveal}>
                  <div className="card-bezel">
                    <div className="card-bezel-inner p-5 md:p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-ink-700 dark:bg-paper-light flex items-center justify-center flex-shrink-0 ring-1 ring-ink-700 dark:ring-paper-light">
                              <span className="text-paper-light dark:text-ink-700 font-semibold text-sm">
                                {comment.user?.fullName?.charAt(0) || 'U'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-ink-primary dark:text-paper-light">
                                  {comment.user?.fullName || 'Người dùng'}
                                </p>
                                {comment.isEdited && (
                                  <span className="eyebrow-tag text-[9px] bg-[#FBF3DB] text-[#956400]">
                                    đã chỉnh sửa
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-ink-muted mt-0.5">
                                {comment.user?.email || 'N/A'}
                              </p>
                            </div>
                          </div>

                          <p className="text-ink-primary dark:text-paper-light mb-3 leading-relaxed text-pretty">
                            {comment.content}
                          </p>

                          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.15em] text-ink-muted flex-wrap">
                            <span className="flex items-center gap-1.5">
                              <MessageSquare className="w-3 h-3" strokeWidth={1.5} />
                              <Link
                                to={`/recipes/${comment.recipeId}`}
                                className="link-underline text-ink-primary dark:text-paper-light"
                              >
                                {comment.recipe?.recipeName || `Công thức #${comment.recipeId}`}
                              </Link>
                            </span>
                            <span>·</span>
                            <span>{getTimeAgo(comment.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex gap-1.5 flex-shrink-0">
                          <Link
                            to={`/recipes/${comment.recipeId}`}
                            className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-ink-secondary hover:bg-paper-light dark:hover:bg-ink-700/40 hover:ring-ink-primary/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                            title="Xem công thức"
                          >
                            <Eye className="w-4 h-4" strokeWidth={1.5} />
                          </Link>
                          <button
                            onClick={() => handleDelete(comment.id, comment.content)}
                            className="w-9 h-9 rounded-full ring-1 ring-ink-200/40 dark:ring-ink-700/40 flex items-center justify-center text-[#9F2F2D] hover:bg-[#FDEBEC] dark:hover:bg-[#9F2F2D]/15 hover:ring-[#9F2F2D]/30 transition-all duration-500 ease-[var(--ease-fluid)]"
                            title="Xóa bình luận"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Stats */}
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerGrid}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {[
                {
                  label: 'Tổng bình luận',
                  value: total,
                  icon: MessageSquare,
                  accent: 'bg-[#E5EDF6] text-[#3D5A80]',
                },
                {
                  label: 'Đã chỉnh sửa',
                  value: editedCount,
                  icon: AlertCircle,
                  accent: 'bg-[#FBF3DB] text-[#956400]',
                },
              ].map((stat, idx) => (
                <motion.div key={idx} custom={idx} variants={cardReveal}>
                  <div className="card-bezel">
                    <div className="card-bezel-inner p-5 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-ink-secondary font-semibold">
                          {stat.label}
                        </p>
                        <p className="text-display text-3xl text-ink-primary dark:text-paper-light mt-1.5">
                          {stat.value}
                        </p>
                      </div>
                      <div className={`w-11 h-11 rounded-full ${stat.accent} flex items-center justify-center`}>
                        <stat.icon className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>

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
                      Trang {page} / {totalPages}
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
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminComments;