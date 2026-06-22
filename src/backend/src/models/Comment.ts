import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import { sequelize } from '../config/database-supabase';
import User from './User';

interface CommentAttributes {
  id: number;
  recipeId: number;
  userId: number;
  parentId?: number | null;
  content: string;
  isEdited: boolean;
  editedAt?: Date | null;
  isDeleted: boolean;
  deletedAt?: Date | null;
  likeCount: number;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CommentCreationAttributes extends Optional<CommentAttributes, 'id' | 'isEdited' | 'editedAt' | 'isDeleted' | 'deletedAt' | 'likeCount' | 'replyCount' | 'createdAt' | 'updatedAt'> {}

class Comment extends Model<CommentAttributes, CommentCreationAttributes> implements CommentAttributes {
  public id!: number;
  public recipeId!: number;
  public userId!: number;
  public parentId?: number | null;
  public content!: string;
  public isEdited!: boolean;
  public editedAt?: Date | null;
  public isDeleted!: boolean;
  public deletedAt?: Date | null;
  public likeCount!: number;
  public replyCount!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Virtual fields for nested structure
  public replies?: Comment[];
  public user?: any;
  public isLiked?: boolean;

  // Static methods
  static async getCommentsByRecipe(
    recipeId: number,
    options: {
      page?: number;
      limit?: number;
      sortBy?: 'newest' | 'oldest' | 'popular';
      includeReplies?: boolean;
      maxDepth?: number;
    } = {}
  ) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'newest',
      includeReplies = true,
      maxDepth = 3
    } = options;

    const offset = (page - 1) * limit;

    // Get root comments (parentId is null)
    const rootComments = await Comment.findAll({
      where: {
        recipeId,
        parentId: null,
        isDeleted: false
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'avatar'],
          required: false
        }
      ],
      order: this.getSortOrder(sortBy),
      limit,
      offset,
      raw: false, // Ensure we get model instances, not plain objects
      nest: true // Nest associations in the result
    });
    
    // Debug: Log first comment to see if user is loaded
    if (rootComments.length > 0) {
      const firstComment = rootComments[0] as any;
      console.log(`🔍 First comment ID: ${firstComment.id}, User ID: ${firstComment.userId}`);
      console.log(`🔍 First comment has user property: ${!!firstComment.user}`);
      if (firstComment.user) {
        console.log(`🔍 First comment user: ${firstComment.user.fullName || 'no fullName'}`);
      } else {
        console.log(`⚠️  First comment missing user! Trying to access via get()`);
        try {
          const userViaGet = firstComment.get?.('user');
          console.log(`🔍 User via get(): ${userViaGet ? userViaGet.fullName : 'null'}`);
        } catch (e) {
          console.log(`❌ Error accessing user via get():`, e);
        }
      }
    }

    if (!includeReplies) {
      return rootComments.map(comment => {
        const commentData: any = (comment as any).toJSON();
        // Ensure user is included
        if (!commentData.user) {
          const commentInstance = comment as any;
          if (commentInstance.user) {
            commentData.user = {
              id: commentInstance.user.id,
              fullName: commentInstance.user.fullName,
              avatar: commentInstance.user.avatar
            };
          }
        }
        return commentData;
      });
    }

    // Get replies for each root comment
    const commentsWithReplies = await Promise.all(
      rootComments.map(async (comment) => {
        const replies = await this.getRepliesRecursive(comment.id, maxDepth);
        // Use toJSON() which should automatically include associations
        const commentData: any = (comment as any).toJSON();
        
        // Debug: Log to see what toJSON() returns
        if (!commentData.user) {
          console.log(`⚠️  Comment ${commentData.id} missing user in toJSON()`);
          console.log(`   Comment keys:`, Object.keys(commentData));
          // Try accessing user directly from instance
          const commentInstance = comment as any;
          if (commentInstance.user) {
            commentData.user = {
              id: commentInstance.user.id,
              fullName: commentInstance.user.fullName,
              avatar: commentInstance.user.avatar
            };
            console.log(`✅ Comment ${commentData.id} user found on instance: ${commentData.user.fullName}`);
          } else {
            console.log(`❌ Comment ${commentData.id} user not found on instance either`);
          }
        } else {
          console.log(`✅ Comment ${commentData.id} has user: ${commentData.user.fullName}`);
        }
        
        return {
          ...commentData,
          replies
        };
      })
    );

    return commentsWithReplies;
  }

  static async getRepliesRecursive(parentId: number, maxDepth: number, currentDepth: number = 1): Promise<any[]> {
    if (currentDepth > maxDepth) {
      return [];
    }

    const replies = await Comment.findAll({
      where: {
        parentId,
        isDeleted: false
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'fullName', 'avatar']
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    // Recursively get nested replies
    const repliesWithNested = await Promise.all(
      replies.map(async (reply) => {
        const nestedReplies = await this.getRepliesRecursive(reply.id, maxDepth, currentDepth + 1);
        const replyData: any = (reply as any).toJSON();
        
        // Ensure user is included
        if (!replyData.user) {
          const replyInstance = reply as any;
          if (replyInstance.user) {
            replyData.user = {
              id: replyInstance.user.id,
              fullName: replyInstance.user.fullName,
              avatar: replyInstance.user.avatar
            };
          }
        }
        
        return {
          ...replyData,
          replies: nestedReplies
        };
      })
    );

    return repliesWithNested;
  }

  static getSortOrder(sortBy: string): any {
    switch (sortBy) {
      case 'oldest':
        return [['createdAt', 'ASC']];
      case 'popular':
        return [['likeCount', 'DESC'], ['createdAt', 'DESC']];
      case 'newest':
      default:
        return [['createdAt', 'DESC']];
    }
  }

  static async createComment(data: {
    recipeId: number;
    userId: number;
    parentId?: number | null;
    content: string;
  }) {
    const comment = await Comment.create(data);

    // Update reply count for parent comment
    if (data.parentId) {
      await Comment.increment('replyCount', {
        where: { id: data.parentId }
      });
    }

    return comment;
  }

  static async deleteComment(commentId: number, userId: number) {
    const comment = await Comment.findOne({
      where: { id: commentId, userId }
    });

    if (!comment) {
      throw new Error('Comment not found or not authorized');
    }

    // Soft delete
    await comment.update({
      isDeleted: true,
      deletedAt: new Date(),
      content: '[Deleted comment]'
    });

    // Update reply count for parent
    if (comment.parentId) {
      await Comment.decrement('replyCount', {
        where: { id: comment.parentId }
      });
    }

    return comment;
  }

  static async updateComment(commentId: number, userId: number, content: string) {
    const comment = await Comment.findOne({
      where: { id: commentId, userId, isDeleted: false }
    });

    if (!comment) {
      throw new Error('Comment not found or not authorized');
    }

    await comment.update({
      content,
      isEdited: true,
      editedAt: new Date()
    });

    return comment;
  }

  static async toggleLike(commentId: number, userId: number) {
    // This would integrate with a CommentLike model
    // For now, we'll simulate the like functionality
    const comment = await Comment.findByPk(commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    // Simulate like toggle (in real implementation, use CommentLike model)
    const newLikeCount = comment.likeCount + 1;
    await comment.update({ likeCount: newLikeCount });

    return { isLiked: true, likeCount: newLikeCount };
  }
}

// Define the model
Comment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    recipeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'recipes',
        key: 'id',
      },
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'comments',
        key: 'id',
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [1, 2000],
      },
    },
    isEdited: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    editedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isDeleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    likeCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    replyCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Comment',
    tableName: 'comments',
    timestamps: true,
    paranoid: false, // We handle soft delete manually
    indexes: [
      {
        fields: ['recipe_id', 'parent_id', 'created_at'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['parent_id'],
      },
    ],
  }
);

// Associations will be handled manually in controllers

export default Comment;
