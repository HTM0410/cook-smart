import { Request, Response, NextFunction } from 'express';
import { User, Recipe, UserFavorite, Comment } from '../models';
import { NotFoundError, BadRequestError } from '../utils/errors';
import fs from 'fs';
import path from 'path';
import { uploadAvatar as cloudinaryUploadAvatar } from '../config/cloudinary';

/**
 * Get user profile with stats
 * GET /api/profile/:userId
 */
export const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'fullName', 'avatar', 'createdAt']
    });

    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Get stats
    const { RecipeReview } = require('../models');
    const [favoriteCount, reviewCount, recipeCount] = await Promise.all([
      UserFavorite.count({ where: { userId } }),
      RecipeReview.count({ where: { userId } }),
      // TODO: Add recipe count when user can create recipes
      Promise.resolve(0)
    ]);

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        ...user.toJSON(),
        stats: {
          favoriteCount,
          reviewCount,
          recipeCount
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's favorite recipes
 * GET /api/profile/:userId/favorites
 */
export const getUserFavorites = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const { count, rows: favorites } = await UserFavorite.findAndCountAll({
      where: { userId },
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'recipeName', 'description', 'imageUrl', 'difficulty', 'prepTime', 'cookTime', 'servings'],
          where: { status: 'visible' },
          required: false // Cho phép favorites không có recipe
        }
      ],
      limit: parseInt(limit as string),
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Filter out favorites where recipe is null/deleted
    const recipes = favorites
      .filter((fav: any) => fav.recipe != null)
      .map((fav: any) => fav.recipe);

    res.json({
      success: true,
      message: 'Favorites retrieved successfully',
      data: {
        recipes,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count,
          pages: Math.ceil(count / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user profile
 * PUT /api/profile
 */
export const updateProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError('User not authenticated', 'NOT_AUTHENTICATED');
    }

    const { fullName, avatar } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Update fields
    if (fullName !== undefined) user.fullName = fullName;
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user profile
 * GET /api/profile/me
 */
export const getCurrentUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError('User not authenticated', 'NOT_AUTHENTICATED');
    }

    // Reuse getUserProfile logic
    req.params.userId = userId.toString();
    await getUserProfile(req, res, next);
  } catch (error) {
    next(error);
  }
};

/**
 * Get user activity feed
 * GET /api/profile/:userId/activity
 */
export const getUserActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get user's recent activities
    const [favorites, comments] = await Promise.all([
      // Recent favorites
      UserFavorite.findAll({
        where: { userId },
        include: [
          {
            model: Recipe,
            as: 'recipe',
            attributes: ['id', 'recipeName', 'imageUrl'],
            where: { status: 'visible' },
            required: false // Cho phép favorites không có recipe (recipe đã bị xóa/ẩn)
          }
        ],
        limit: parseInt(limit as string),
        offset,
        order: [['createdAt', 'DESC']]
      }),
      // Recent comments
      Comment.findAll({
        where: { 
          userId,
          isDeleted: false 
        },
        include: [
          {
            model: Recipe,
            as: 'recipe',
            attributes: ['id', 'recipeName', 'imageUrl'],
            where: { status: 'visible' },
            required: false // Cho phép comments không có recipe
          }
        ],
        limit: parseInt(limit as string),
        offset,
        order: [['createdAt', 'DESC']]
      })
    ]);

    // Combine and format activities (filter out items where recipe is null/deleted)
    const activities = [
      ...favorites
        .filter((fav: any) => fav.recipe != null) // Only include favorites with valid recipe
        .map((fav: any) => ({
          id: `favorite_${fav.id}`,
          type: 'favorite',
          action: 'Đã thêm vào yêu thích',
          target: {
            id: fav.recipe.id,
            name: fav.recipe.recipeName,
            imageUrl: fav.recipe.imageUrl,
            type: 'recipe'
          },
          createdAt: fav.createdAt
        })),
      ...comments
        .filter((comment: any) => comment.recipe != null) // Only include comments with valid recipe
        .map((comment: any) => ({
          id: `comment_${comment.id}`,
          type: 'comment',
          action: 'Đã bình luận',
          target: {
            id: comment.recipe.id,
            name: comment.recipe.recipeName,
            imageUrl: comment.recipe.imageUrl,
            type: 'recipe'
          },
          content: comment.content,
          createdAt: comment.createdAt
        }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      message: 'Activity feed retrieved successfully',
      data: {
        activities: activities.slice(0, parseInt(limit as string)),
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: activities.length,
          pages: Math.ceil(activities.length / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's ratings (from recipe_reviews table)
 * GET /api/profile/:userId/reviews
 */
export const getUserReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 12 } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Import RecipeReview model
    const { RecipeReview } = require('../models');

    const { count, rows: ratings } = await RecipeReview.findAndCountAll({
      where: { userId },
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'recipeName', 'imageUrl', 'difficulty', 'prepTime', 'cookTime'],
          where: { status: 'visible' },
          required: false
        }
      ],
      limit: parseInt(limit as string),
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Filter out ratings where recipe is null/deleted
    const reviews = ratings
      .filter((rating: any) => rating.recipe != null)
      .map((rating: any) => ({
        id: rating.id,
        rating: rating.rating,
        comment: rating.comment,
        createdAt: rating.createdAt,
        updatedAt: rating.updatedAt,
        recipe: rating.recipe
      }));

    res.json({
      success: true,
      message: 'Reviews retrieved successfully',
      data: {
        reviews,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total: count,
          pages: Math.ceil(count / parseInt(limit as string))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change user password
 * PUT /api/profile/password
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError('User not authenticated', 'NOT_AUTHENTICATED');
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new BadRequestError('Vui lòng nhập đầy đủ mật khẩu', 'MISSING_PASSWORD');
    }

    if (newPassword.length < 6) {
      throw new BadRequestError('Mật khẩu mới phải có ít nhất 6 ký tự', 'PASSWORD_TOO_SHORT');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestError('Mật khẩu hiện tại không đúng', 'WRONG_PASSWORD');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Upload user avatar
 * POST /api/profile/avatar
 */
export const uploadUserAvatar = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    console.log('📸 Avatar upload request received');
    console.log('User:', req.user?.id);
    console.log('File:', req.file);

    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundError('User not authenticated', 'NOT_AUTHENTICATED');
    }

    if (!req.file) {
      throw new BadRequestError('No file uploaded', 'NO_FILE');
    }

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User not found', 'USER_NOT_FOUND');
    }

    console.log('Current user avatar:', user.avatar);
    console.log('File details:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      filename: req.file.filename
    });

    // Upload avatar using Cloudinary helper or local storage
    let avatarUrl: string;
    
    try {
      avatarUrl = await cloudinaryUploadAvatar(req.file);
      console.log('✅ Avatar uploaded successfully:', avatarUrl);
    } catch (uploadError: any) {
      console.error('❌ Avatar upload failed:', uploadError);
      console.error('❌ Error stack:', uploadError.stack);
      // Clean up temporary file on error
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          console.warn('⚠️ Could not delete temp file:', unlinkErr);
        }
      }
      throw new BadRequestError(
        uploadError.message || 'Không thể upload ảnh. Vui lòng thử lại.', 
        'UPLOAD_FAILED'
      );
    }

    // Delete old avatar if exists (only if it's a local file)
    if (user.avatar && user.avatar.startsWith('http://localhost:3000/uploads/')) {
      const oldFilename = user.avatar.split('/').pop();
      const oldPath = path.join(__dirname, '../../uploads', oldFilename || '');
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
          console.log('🗑️ Deleted old avatar:', oldPath);
        } catch (err) {
          console.warn('⚠️ Could not delete old avatar:', err);
        }
      }
    }

    // Update user avatar
    user.avatar = avatarUrl;
    await user.save();

    console.log('✅ New avatar URL saved to database:', avatarUrl);

    // Note: Don't delete the file if it's being served locally
    // Only delete if uploaded to Cloudinary
    if (avatarUrl.includes('cloudinary.com') && req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('🗑️ Cleaned up temporary file after Cloudinary upload');
    }

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar: avatarUrl
      }
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    // Clean up temporary file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};
