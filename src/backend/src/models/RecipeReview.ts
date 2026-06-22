import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface RecipeReviewAttributes {
  id: number;
  userId: number;
  recipeId: number;
  rating: number;
  comment?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RecipeReviewCreationAttributes extends Optional<RecipeReviewAttributes, 'id' | 'comment' | 'isActive' | 'createdAt' | 'updatedAt'> {}

class RecipeReview extends Model<RecipeReviewAttributes, RecipeReviewCreationAttributes> implements RecipeReviewAttributes {
  public id!: number;
  public userId!: number;
  public recipeId!: number;
  public rating!: number;
  public comment?: string;
  public isActive!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RecipeReview.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    recipeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'recipe_id',
      references: {
        model: 'recipes',
        key: 'id',
      },
    },
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'recipe_reviews',
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['recipe_id'],
      },
      {
        fields: ['rating'],
      },
      {
        unique: true,
        fields: ['user_id', 'recipe_id'],
      },
    ],
  }
);

export default RecipeReview;
