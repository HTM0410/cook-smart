import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
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
  const editedCount = comments.filter((c) => c.isEdited).length;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-7xl">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Bình luận</h1>
          <p className="admin-page-subtitle">
            Tổng cộng{' '}
            <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
              {total}
            </span>{' '}
            bình luận trong hệ thống.
          </p>
        </div>

        {/* Search */}
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
                  placeholder="Tìm kiếm theo nội dung, người dùng, hoặc công thức..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  style={{ width: '100%', paddingLeft: 36 }}
                />
              </div>
              <button onClick={handleSearch}>
                <Search className="w-4 h-4" strokeWidth={2} />
                Tìm kiếm
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="admin-alert admin-alert-danger">
            <AlertCircle className="w-4 h-4" strokeWidth={2} />
            <span>{error}</span>
            <button
              onClick={fetchComments}
              style={{
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="admin-stat">
            <span className="admin-stat-label">Tổng bình luận</span>
            <span className="admin-stat-value">{total}</span>
          </div>
          <div className="admin-stat">
            <span className="admin-stat-label">Đã chỉnh sửa (trang này)</span>
            <span className="admin-stat-value">{editedCount}</span>
          </div>
        </div>

        {loading ? (
          <div className="admin-card">
            <div className="admin-loading">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
              <span>Đang tải...</span>
            </div>
          </div>
        ) : comments.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">
              <MessageSquare className="w-10 h-10" style={{ color: 'var(--admin-text-muted)' }} strokeWidth={1.5} />
              <span>Không tìm thấy bình luận nào</span>
              {searchTerm && (
                <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                  Thử từ khóa khác
                </span>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="admin-card">
              <ul className="divide-y" style={{ borderColor: 'var(--admin-border)' }}>
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    style={{ borderTop: '1px solid var(--admin-border)' }}
                    className="flex items-start gap-4 p-4"
                  >
                    <div className="admin-avatar admin-avatar-success" style={{ flexShrink: 0 }}>
                      {comment.user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
                          {comment.user?.fullName || 'Người dùng'}
                        </p>
                        {comment.isEdited && (
                          <span className="admin-badge admin-badge-warning">đã chỉnh sửa</span>
                        )}
                      </div>
                      <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                        {comment.user?.email || 'N/A'}
                      </p>
                      <p
                        className="mt-2 text-sm leading-relaxed"
                        style={{ color: 'var(--admin-text)' }}
                      >
                        {comment.content}
                      </p>
                      <div
                        className="mt-2 flex items-center gap-2 flex-wrap text-xs"
                        style={{ color: 'var(--admin-text-muted)' }}
                      >
                        <Link
                          to={`/recipes/${comment.recipeId}`}
                          className="flex items-center gap-1 font-medium"
                          style={{ color: 'var(--admin-info)' }}
                        >
                          <MessageSquare className="w-3 h-3" strokeWidth={2} />
                          {comment.recipe?.recipeName || `Công thức #${comment.recipeId}`}
                        </Link>
                        <span>·</span>
                        <span>{getTimeAgo(comment.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Link
                        to={`/recipes/${comment.recipeId}`}
                        className="admin-action"
                        title="Xem công thức"
                      >
                        <Eye className="w-4 h-4" strokeWidth={2} />
                      </Link>
                      <button
                        onClick={() => handleDelete(comment.id, comment.content)}
                        className="admin-action admin-action-danger"
                        title="Xóa bình luận"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={2} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
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
                    Trang {page} / {totalPages}
                  </span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}>
                    Sau
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminComments;