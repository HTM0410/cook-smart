import axios from 'axios';
import requestCache from '../utils/requestCache';

import { API_BASE_URL } from '../config/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Comment {
  id: number;
  recipeId: number;
  userId: number;
  parentId?: number | null;
  content: string;
  isEdited: boolean;
  editedAt?: string | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  likeCount: number;
  replyCount: number;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
  user?: {
    id: number;
    fullName: string;
    avatar?: string;
  };
  isLiked?: boolean;
}

export interface CommentsResponse {
  success: boolean;
  message: string;
  data: {
    comments: Comment[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface CommentResponse {
  success: boolean;
  message: string;
  data: {
    comment: Comment;
  };
}

export interface CommentLikeResponse {
  success: boolean;
  message: string;
  data: {
    commentId: number;
    isLiked: boolean;
    likeCount: number;
  };
}

export const commentService = {
  // Get comments for a recipe (with caching)
  async getComments(
    recipeId: number,
    params?: {
      page?: number;
      limit?: number;
      sortBy?: 'newest' | 'oldest' | 'popular';
      includeReplies?: boolean;
      maxDepth?: number;
    }
  ): Promise<CommentsResponse> {
    const cacheKey = `comments:${recipeId}:${JSON.stringify(params || {})}`;
    
    return requestCache.getOrFetch(
      cacheKey,
      async () => {
        const response = await api.get(`/api/recipes/${recipeId}/comments`, { params });
        return response.data;
      },
      20000 // Cache 20 seconds
    );
  },

  // Create a new comment
  async createComment(
    recipeId: number,
    content: string,
    parentId?: number
  ): Promise<CommentResponse> {
    const response = await api.post(`/api/recipes/${recipeId}/comments`, {
      content,
      parentId
    });
    
    // Invalidate comment cache for this recipe
    requestCache.invalidate(new RegExp(`^comments:${recipeId}:`));
    
    return response.data;
  },

  // Update a comment
  async updateComment(
    commentId: number,
    content: string
  ): Promise<CommentResponse> {
    const response = await api.put(`/api/comments/${commentId}`, { content });
    
    // Invalidate all comment caches (we don't know which recipe)
    requestCache.invalidate(/^comments:/);
    
    return response.data;
  },

  // Delete a comment
  async deleteComment(commentId: number): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/api/comments/${commentId}`);
    
    // Invalidate all comment caches
    requestCache.invalidate(/^comments:/);
    
    return response.data;
  },

  // Toggle like on a comment
  async toggleLike(commentId: number): Promise<CommentLikeResponse> {
    const response = await api.post(`/api/comments/${commentId}/like`);
    
    // Invalidate comment caches
    requestCache.invalidate(/^comments:/);
    
    return response.data;
  }
};

export default commentService;

