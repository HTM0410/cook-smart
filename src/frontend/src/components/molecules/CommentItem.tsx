import React, { useState } from 'react';
import { Heart, MessageCircle, Edit2, Trash2, MoreVertical } from 'lucide-react';
import { Comment } from '../../services/commentService';
import showToast from '../../utils/toast';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: number;
  onReply?: (commentId: number) => void;
  onEdit?: (commentId: number, content: string) => void;
  onDelete?: (commentId: number) => void;
  onLike?: (commentId: number) => void;
  depth?: number;
  maxDepth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  onReply,
  onEdit,
  onDelete,
  onLike,
  depth = 0,
  maxDepth = 3
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(comment.content);
  const [showMenu, setShowMenu] = useState(false);

  const isOwner = currentUserId === comment.userId;
  const canReply = depth < maxDepth;

  const handleEdit = () => {
    if (editedContent.trim() && editedContent !== comment.content) {
      onEdit?.(comment.id, editedContent);
      setIsEditing(false);
    } else {
      showToast.warning('Nội dung không được thay đổi hoặc để trống');
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(comment.content);
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    // Thêm 'Z' nếu không có timezone indicator để parse đúng UTC
    const normalizedDateString = dateString.includes('Z') || dateString.includes('+') 
      ? dateString 
      : dateString + 'Z';
    const date = new Date(normalizedDateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 7) {
      return date.toLocaleDateString('vi-VN');
    } else if (days > 0) {
      return `${days} ngày trước`;
    } else if (hours > 0) {
      return `${hours} giờ trước`;
    } else if (minutes > 0) {
      return `${minutes} phút trước`;
    } else {
      return 'Vừa xong';
    }
  };

  return (
    <div className={`comment-item ${depth > 0 ? 'ml-8 mt-4' : 'mt-4'}`}>
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-semibold">
            {comment.user?.fullName?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">
                  {comment.user?.fullName || 'Anonymous'}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(comment.createdAt)}
                  {comment.isEdited && ' (đã chỉnh sửa)'}
                </span>
              </div>

              {/* Menu */}
              {isOwner && (
                <div className="relative">
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-500" />
                  </button>

                  {showMenu && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowMenu(false)}
                      />
                      {/* Menu */}
                      <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                        <button
                          onClick={() => {
                            setIsEditing(true);
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                        >
                          <Edit2 className="w-4 h-4" />
                          Chỉnh sửa
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Bạn có chắc muốn xóa bình luận này?')) {
                              onDelete?.(comment.id);
                            }
                            setShowMenu(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Xóa
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Content */}
            {isEditing ? (
              <div className="mt-2">
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:text-white"
                  rows={3}
                  maxLength={2000}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleEdit}
                    className="px-4 py-1 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
                  >
                    Lưu
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-white rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors text-sm"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 mt-2 px-2">
            <button
              onClick={() => onLike?.(comment.id)}
              className={`flex items-center gap-1 text-sm transition-colors ${
                comment.isLiked
                  ? 'text-red-500 font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-red-500'
              }`}
            >
              <Heart className={`w-4 h-4 ${comment.isLiked ? 'fill-current' : ''}`} />
              {comment.likeCount > 0 && <span>{comment.likeCount}</span>}
              <span>{comment.isLiked ? 'Đã thích' : 'Thích'}</span>
            </button>

            {canReply && (
              <button
                onClick={() => onReply?.(comment.id)}
                className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-orange-500 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Trả lời</span>
                {comment.replyCount > 0 && <span>({comment.replyCount})</span>}
              </button>
            )}
          </div>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onReply={onReply}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onLike={onLike}
                  depth={depth + 1}
                  maxDepth={maxDepth}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CommentItem;

