import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface UserFavoriteAttributes {
  id: number;
  userId: number;
  recipeId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserFavoriteCreationAttributes extends Optional<UserFavoriteAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class UserFavorite extends Model<UserFavoriteAttributes, UserFavoriteCreationAttributes> implements UserFavoriteAttributes {
  public id!: number;
  public userId!: number;
  public recipeId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserFavorite.init(
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
  },
  {
    sequelize,
    tableName: 'user_favorites',
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['recipe_id'],
      },
      {
        unique: true,
        fields: ['user_id', 'recipe_id'],
      },
    ],
  }
);

export default UserFavorite;
