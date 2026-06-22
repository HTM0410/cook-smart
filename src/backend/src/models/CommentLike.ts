import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database-supabase';

interface CommentLikeAttributes {
  id: number;
  commentId: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CommentLikeCreationAttributes extends Optional<CommentLikeAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class CommentLike extends Model<CommentLikeAttributes, CommentLikeCreationAttributes> implements CommentLikeAttributes {
  public id!: number;
  public commentId!: number;
  public userId!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Static methods
  static async toggleLike(commentId: number, userId: number) {
    const existingLike = await CommentLike.findOne({
      where: { commentId, userId }
    });

    if (existingLike) {
      // Unlike
      await existingLike.destroy();
      
      // Decrement like count
      await sequelize.models.Comment.decrement('likeCount', {
        where: { id: commentId }
      });

      return { isLiked: false };
    } else {
      // Like
      await CommentLike.create({ commentId, userId });
      
      // Increment like count
      await sequelize.models.Comment.increment('likeCount', {
        where: { id: commentId }
      });

      return { isLiked: true };
    }
  }

  static async getUserLikes(userId: number, commentIds: number[]) {
    const likes = await CommentLike.findAll({
      where: {
        userId,
        commentId: commentIds
      },
      attributes: ['commentId']
    });

    return likes.map(like => like.commentId);
  }
}

// Define the model
CommentLike.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    commentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'comments',
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
    modelName: 'CommentLike',
    tableName: 'commentlikes',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['comment_id', 'user_id'],
        name: 'unique_comment_user_like'
      },
      {
        fields: ['comment_id'],
      },
      {
        fields: ['user_id'],
      },
    ],
  }
);

// Associations will be handled manually in controllers

export default CommentLike;
