import React, { useState, useEffect } from 'react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';
import { Loader2, Trash2, Eye, MessageSquare, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Comment {
  id: number;
  content: string;
  userId: number;
  recipeId: number;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
  recipe?: {
    id: number;
    recipeName: string;
  };
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
  }, [page]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📥 Fetching comments from API...');
      
      const response = await adminService.getComments({
        page,
        limit,
        search: searchTerm || undefined,
      });
      
      console.log('📦 Comments response:', response);
      setComments(response.data.comments || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('❌ Error fetching comments:', error);
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
    if (!confirm(`Bạn có chắc muốn xóa bình luận: "${truncated}"?\n\nHành động này không thể hoàn tác!`)) return;
    
    try {
      await adminService.deleteComment(commentId);
      alert('✅ Đã xóa bình luận thành công!');
      fetchComments();
    } catch (error) {
      console.error('❌ Error deleting comment:', error);
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quản lý bình luận</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Tổng số: {total} bình luận
          </p>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Tìm kiếm bình luận theo nội dung, người dùng, hoặc công thức..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔍 Tìm kiếm
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p className="font-medium">{error}</p>
            </div>
            <button onClick={fetchComments} className="text-sm font-semibold underline">Thử lại</button>
          </div>
        )}

        {/* Comments List */}
        {loading ? (
          <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-800 rounded-xl">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            <span className="ml-3 text-gray-600 dark:text-gray-400">Đang tải...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
            <MessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500 text-lg mb-2">Không tìm thấy bình luận nào</p>
            {searchTerm && (
              <p className="text-gray-400 text-sm">Thử tìm kiếm với từ khóa khác</p>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Comment content */}
                    <div className="flex-1 min-w-0">
                      {/* User info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">
                            {comment.user?.fullName?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {comment.user?.fullName || 'Người dùng'}
                            </p>
                            {comment.isEdited && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">(đã chỉnh sửa)</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {comment.user?.email || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Comment text */}
                      <p className="text-gray-700 dark:text-gray-300 mb-3">
                        {comment.content}
                      </p>

                      {/* Meta info */}
                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-4 h-4" />
                          Bình luận cho:{' '}
                          <Link
                            to={`/recipes/${comment.recipeId}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                          >
                            {comment.recipe?.recipeName || `Công thức #${comment.recipeId}`}
                          </Link>
                        </span>
                        <span>•</span>
                        <span>{getTimeAgo(comment.createdAt)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <Link
                        to={`/recipes/${comment.recipeId}`}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Xem công thức"
                      >
                        <Eye className="w-5 h-5" />
                      </Link>
                      <button
                        onClick={() => handleDelete(comment.id, comment.content)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Xóa bình luận"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tổng bình luận</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Đã chỉnh sửa</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {comments.filter(c => c.isEdited).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                    ✏️
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Đã xóa</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">0</p>
                  </div>
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    🗑️
                  </div>
                </div>
              </div>
            </div>

            {/* Pagination */}
            {total > limit && (
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
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminComments;
