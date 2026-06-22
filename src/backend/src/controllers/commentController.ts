import { Request, Response, NextFunction } from 'express';
import Comment from '../models/Comment';
import CommentLike from '../models/CommentLike';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../utils/errors';
import { body, param, query, validationResult } from 'express-validator';
import commentCacheService from '../services/commentCacheService';
import { sequelize } from '../config/database-supabase';

/**
 * Get comments for a recipe with threading support
 * GET /api/recipes/:recipeId/comments
 */
export const getComments = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { recipeId } = req.params;
    const {
      page = 1,
      limit = 20,
      sortBy = 'newest',
      includeReplies = 'true',
      maxDepth = 3
    } = req.query;

    const userId = (req as any).user?.id;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const sortByStr = sortBy as string;

    // Try to get from cache first
    const cachedComments = await commentCacheService.getCommentsForRecipe(
      parseInt(recipeId),
      pageNum,
      sortByStr
    );

    let comments;
    if (cachedComments) {
      comments = cachedComments;
      res.setHeader('X-Cache', 'HIT');
      // Debug: Check if cached comments have user data
      if (comments.length > 0 && !comments[0].user) {
        console.log('⚠️  Cached comments missing user data, invalidating cache...');
        await commentCacheService.invalidateRecipeComments(parseInt(recipeId));
        // Fetch fresh data
        comments = await Comment.getCommentsByRecipe(parseInt(recipeId), {
          page: pageNum,
          limit: limitNum,
          sortBy: sortByStr as 'newest' | 'oldest' | 'popular',
          includeReplies: includeReplies === 'true',
          maxDepth: parseInt(maxDepth as string)
        });
        // Re-cache with user data
        await commentCacheService.setCommentsForRecipe(
          parseInt(recipeId),
          pageNum,
          sortByStr,
          comments
        );
        res.setHeader('X-Cache', 'MISS');
      }
    } else {
      comments = await Comment.getCommentsByRecipe(parseInt(recipeId), {
        page: pageNum,
        limit: limitNum,
        sortBy: sortByStr as 'newest' | 'oldest' | 'popular',
        includeReplies: includeReplies === 'true',
        maxDepth: parseInt(maxDepth as string)
      });

      // Debug: Log first comment to verify user data
      if (comments.length > 0) {
        console.log('📝 First comment user:', comments[0].user ? comments[0].user.fullName : 'MISSING');
        console.log('📝 First comment data:', JSON.stringify(comments[0], null, 2).substring(0, 500));
      }

      // Cache the results
      await commentCacheService.setCommentsForRecipe(
        parseInt(recipeId),
        pageNum,
        sortByStr,
        comments
      );
      res.setHeader('X-Cache', 'MISS');
    }

    // Get user likes for all comments
    if (userId) {
      const allCommentIds = getAllCommentIds(comments);
      const userLikes = await CommentLike.getUserLikes(userId, allCommentIds);
      
      // Add isLiked flag to comments
      addIsLikedFlag(comments, userLikes);
    }

    // Get total count for pagination
    const totalCount = await Comment.count({
      where: {
        recipeId: parseInt(recipeId),
        parentId: null,
        isDeleted: false
      }
    });

    res.json({
      success: true,
      message: 'Comments retrieved successfully',
      data: {
        comments,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new comment
 * POST /api/recipes/:recipeId/comments
 */
export const createComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { recipeId } = req.params;
    const { content, parentId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    // Validate parent comment exists if replying
    if (parentId) {
      const parentComment = await Comment.findOne({
        where: { id: parentId, recipeId: parseInt(recipeId), isDeleted: false }
      });
      
      if (!parentComment) {
        throw new NotFoundError('Parent comment not found');
      }
    }

    // Check for duplicate comment (same user, same recipe, same content, within last 5 seconds)
    // This prevents accidental double submissions
    const recentComment = await Comment.findOne({
      where: {
        recipeId: parseInt(recipeId),
        userId,
        parentId: parentId ? parseInt(parentId) : null,
        content: content.trim(),
        isDeleted: false
      },
      order: [['createdAt', 'DESC']],
      limit: 1
    });

    if (recentComment) {
      const timeDiff = Date.now() - new Date(recentComment.createdAt).getTime();
      // Nếu bình luận được tạo trong 5 giây gần nhất, coi như idempotent
      if (timeDiff < 5000) {
        const existingComment = await Comment.findByPk(recentComment.id);
        res.status(200).json({
          success: true,
          message: 'Comment already created',
          data: {
            comment: existingComment || recentComment,
          },
        });
        return;
      }
    }

    // Sử dụng static method createComment với retry logic
    console.log('📝 Creating comment:', { recipeId: parseInt(recipeId), userId, parentId, content: content.trim() });
    
    let comment;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        comment = await Comment.createComment({
          recipeId: parseInt(recipeId),
          userId,
          parentId: parentId ? parseInt(parentId) : null,
          content: content.trim()
        });
        console.log('✅ Comment created:', comment.id);
        break; // Success, exit loop
      } catch (createError: any) {
        console.error('❌ Error in Comment.createComment (attempt ' + (retryCount + 1) + '):', createError);
        
        // Handle duplicate key error (sequence desync) - retry
        if (createError.parent?.code === '23505' && createError.parent?.constraint === 'comments_pkey') {
          retryCount++;
          console.log('🔄 Sequence desync detected, resetting sequence and retrying...');
          
          // Reset sequence và retry - sử dụng sequelize đã import
          await sequelize.query(
            `SELECT setval('comments_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM comments), false)`
          );
          
          if (retryCount >= maxRetries) {
            throw new BadRequestError('Không thể tạo bình luận. Vui lòng thử lại sau.', 'CREATE_FAILED');
          }
          continue; // Retry
        }
        
        // Handle actual duplicate comment (same content) - don't retry
        if (createError.name === 'SequelizeUniqueConstraintError') {
          throw new BadRequestError('Bình luận này đã tồn tại. Vui lòng đợi một chút.', 'DUPLICATE_COMMENT');
        }
        
        // Re-throw other errors
        throw createError;
      }
    }
    
    if (!comment) {
      throw new BadRequestError('Không thể tạo bình luận. Vui lòng thử lại.', 'CREATE_FAILED');
    }

    // Fetch the created comment với relations
    const createdComment = await Comment.findByPk(comment.id);
    if (!createdComment) {
      throw new Error('Failed to fetch created comment');
    }

    // Invalidate cache for this recipe
    await commentCacheService.invalidateRecipeComments(parseInt(recipeId));
    await commentCacheService.incrementCommentCount(parseInt(recipeId));

    res.status(201).json({
      success: true,
      message: 'Comment created successfully',
      data: {
        comment: createdComment
      }
    });
  } catch (error: any) {
    console.error('❌ Error in createComment controller:', error);
    next(error);
  }
};

/**
 * Update a comment
 * PUT /api/comments/:commentId
 */
export const updateComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { commentId } = req.params;
    const { content } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const comment = await Comment.updateComment(parseInt(commentId), userId, content);

    // Invalidate cache
    await commentCacheService.invalidateCommentDetail(parseInt(commentId));
    if (comment.recipeId) {
      await commentCacheService.invalidateRecipeComments(comment.recipeId);
    }

    res.json({
      success: true,
      message: 'Comment updated successfully',
      data: {
        comment
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a comment
 * DELETE /api/comments/:commentId
 */
export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { commentId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    // Get comment before deletion to invalidate recipe cache
    const comment = await Comment.findByPk(parseInt(commentId));
    
    await Comment.deleteComment(parseInt(commentId), userId);

    // Invalidate cache
    await commentCacheService.invalidateCommentDetail(parseInt(commentId));
    if (comment?.recipeId) {
      await commentCacheService.invalidateRecipeComments(comment.recipeId);
      await commentCacheService.decrementCommentCount(comment.recipeId);
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle like on a comment
 * POST /api/comments/:commentId/like
 */
export const toggleCommentLike = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new BadRequestError('Validation failed', 'VALIDATION_ERROR');
    }

    const { commentId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      throw new UnauthorizedError('Authentication required');
    }

    const result = await CommentLike.toggleLike(parseInt(commentId), userId);

    // Get updated comment with like count
    const comment = await Comment.findByPk(parseInt(commentId), {
      attributes: ['id', 'likeCount', 'recipeId']
    });

    // Invalidate cache
    await commentCacheService.invalidateCommentDetail(parseInt(commentId));
    await commentCacheService.setUserLikeStatus(userId, parseInt(commentId), result.isLiked);
    if (comment?.recipeId) {
      await commentCacheService.invalidateRecipeComments(comment.recipeId);
    }

    res.json({
      success: true,
      message: 'Comment like toggled successfully',
      data: {
        commentId: parseInt(commentId),
        isLiked: result.isLiked,
        likeCount: comment?.likeCount || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// Validation middleware
export const validateGetComments = [
  param('recipeId').isInt({ min: 1 }).withMessage('Recipe ID must be a positive integer'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['newest', 'oldest', 'popular']).withMessage('Sort by must be newest, oldest, or popular'),
  query('includeReplies').optional().isBoolean().withMessage('Include replies must be boolean'),
  query('maxDepth').optional().isInt({ min: 1, max: 5 }).withMessage('Max depth must be between 1 and 5')
];

export const validateCreateComment = [
  param('recipeId').isInt({ min: 1 }).withMessage('Recipe ID must be a positive integer'),
  body('content').isLength({ min: 1, max: 2000 }).withMessage('Content must be between 1 and 2000 characters'),
  body('parentId').optional().isInt({ min: 1 }).withMessage('Parent ID must be a positive integer')
];

export const validateUpdateComment = [
  param('commentId').isInt({ min: 1 }).withMessage('Comment ID must be a positive integer'),
  body('content').isLength({ min: 1, max: 2000 }).withMessage('Content must be between 1 and 2000 characters')
];

export const validateDeleteComment = [
  param('commentId').isInt({ min: 1 }).withMessage('Comment ID must be a positive integer')
];

export const validateToggleLike = [
  param('commentId').isInt({ min: 1 }).withMessage('Comment ID must be a positive integer')
];

// Helper functions
function getAllCommentIds(comments: any[]): number[] {
  const ids: number[] = [];
  
  function extractIds(commentList: any[]) {
    commentList.forEach(comment => {
      ids.push(comment.id);
      if (comment.replies && comment.replies.length > 0) {
        extractIds(comment.replies);
      }
    });
  }
  
  extractIds(comments);
  return ids;
}

function addIsLikedFlag(comments: any[], userLikes: number[]): void {
  function addFlag(commentList: any[]) {
    commentList.forEach(comment => {
      comment.isLiked = userLikes.includes(comment.id);
      if (comment.replies && comment.replies.length > 0) {
        addFlag(comment.replies);
      }
    });
  }
  
  addFlag(comments);
}
