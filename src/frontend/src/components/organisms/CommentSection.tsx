import React, { useState, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import commentService, { Comment } from '../../services/commentService';
import CommentItem from '../molecules/CommentItem';
import showToast from '../../utils/toast';

interface CommentSectionProps {
  recipeId: number;
  currentUserId?: number;
  initialCommentsCount?: number;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  recipeId,
  currentUserId,
  initialCommentsCount: _initialCommentsCount = 0
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'popular'>('newest');

  // Load comments
  const loadComments = async (pageNum = 1) => {
    try {
      setIsLoading(true);
      const response = await commentService.getComments(recipeId, {
        page: pageNum,
        limit: 20,
        sortBy,
        includeReplies: true,
        maxDepth: 3
      });

      setComments(response.data.comments);
      setTotalPages(response.data.pagination.pages);
      setPage(pageNum);
    } catch (error) {
      console.error('Error loading comments:', error);
      showToast.error('Không thể tải bình luận. Vui lòng thử lại');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadComments(1);
  }, [recipeId, sortBy]);

  // Handle create comment
  const handleCreateComment = async () => {
    if (!currentUserId) {
      showToast.warning('Vui lòng đăng nhập để bình luận');
      return;
    }

    if (!newComment.trim()) {
      showToast.warning('Vui lòng nhập nội dung bình luận');
      return;
    }

    // Prevent double submit
    if (isSubmitting) {
      console.log('Already submitting, ignoring duplicate request');
      return;
    }

    const commentContent = newComment.trim();
    
    try {
      setIsSubmitting(true);
      await commentService.createComment(recipeId, commentContent);
      setNewComment('');
      showToast.success('Đã thêm bình luận');
      // Reload comments to get the new one
      await loadComments(1);
    } catch (error: any) {
      console.error('Error creating comment:', error);
      
      // Handle specific error cases
      if (error.response?.status === 409) {
        const errorMessage = error.response?.data?.message || 'Bình luận này đã tồn tại hoặc đang được xử lý';
        showToast.error(errorMessage);
      } else if (error.response?.status === 422) {
        const errorMessage = error.response?.data?.message || 'Nội dung bình luận không hợp lệ';
        showToast.error(errorMessage);
      } else {
        showToast.error('Không thể thêm bình luận. Vui lòng thử lại');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reply
  const handleReply = async (parentId: number) => {
    if (!currentUserId) {
      showToast.warning('Vui lòng đăng nhập để trả lời');
      return;
    }

    if (!replyContent.trim()) {
      showToast.warning('Vui lòng nhập nội dung trả lời');
      return;
    }

    try {
      setIsSubmitting(true);
      await commentService.createComment(recipeId, replyContent.trim(), parentId);
      setReplyContent('');
      setReplyingTo(null);
      showToast.success('Đã thêm trả lời');
      // Reload comments
      await loadComments(page);
    } catch (error) {
      console.error('Error replying to comment:', error);
      showToast.error('Không thể thêm trả lời. Vui lòng thử lại');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = async (commentId: number, content: string) => {
    try {
      await commentService.updateComment(commentId, content);
      showToast.success('Đã cập nhật bình luận');
      // Reload comments
      await loadComments(page);
    } catch (error) {
      console.error('Error editing comment:', error);
      showToast.error('Không thể cập nhật bình luận. Vui lòng thử lại');
    }
  };

  // Handle delete
  const handleDelete = async (commentId: number) => {
    try {
      await commentService.deleteComment(commentId);
      showToast.success('Đã xóa bình luận');
      // Reload comments
      await loadComments(page);
    } catch (error) {
      console.error('Error deleting comment:', error);
      showToast.error('Không thể xóa bình luận. Vui lòng thử lại');
    }
  };

  // Handle like
  const handleLike = async (commentId: number) => {
    if (!currentUserId) {
      showToast.warning('Vui lòng đăng nhập để thích bình luận');
      return;
    }

    try {
      await commentService.toggleLike(commentId);
      // Reload comments to update like status
      await loadComments(page);
    } catch (error) {
      console.error('Error liking comment:', error);
      showToast.error('Không thể thích bình luận. Vui lòng thử lại');
    }
  };

  return (
    <div className="comment-section mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bình luận ({comments.length})
        </h3>

        {/* Sort options */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          <option value="newest">Mới nhất</option>
          <option value="oldest">Cũ nhất</option>
          <option value="popular">Phổ biến</option>
        </select>
      </div>

      {/* New Comment Form */}
      <div className="mb-8">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-semibold">
              {currentUserId ? 'U' : '?'}
            </div>
          </div>
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={currentUserId ? 'Viết bình luận của bạn...' : 'Đăng nhập để bình luận'}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
              rows={3}
              maxLength={2000}
              disabled={!currentUserId}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-500">
                {newComment.length}/2000
              </span>
              <button
                onClick={handleCreateComment}
                disabled={!currentUserId || !newComment.trim() || isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>Gửi</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            Chưa có bình luận nào. Hãy là người đầu tiên bình luận!
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id}>
                <CommentItem
                  comment={comment}
                  currentUserId={currentUserId}
                  onReply={(commentId) => setReplyingTo(commentId)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onLike={handleLike}
                />

                {/* Reply Form */}
                {replyingTo === comment.id && (
                  <div className="ml-14 mt-2">
                    <div className="flex gap-2">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Viết trả lời của bạn..."
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-800 dark:text-white"
                        rows={2}
                        maxLength={2000}
                      />
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleReply(comment.id)}
                        disabled={!replyContent.trim() || isSubmitting}
                        className="px-4 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 text-sm"
                      >
                        {isSubmitting ? 'Đang gửi...' : 'Gửi'}
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyContent('');
                        }}
                        className="px-4 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => loadComments(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
                Trang {page} / {totalPages}
              </span>
              <button
                onClick={() => loadComments(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CommentSection;

