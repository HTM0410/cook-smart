import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface UserViewAttributes {
  id: number;
  userId: number;
  recipeId: number;
  viewCount: number;
  lastViewedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserViewCreationAttributes extends Optional<UserViewAttributes, 'id' | 'viewCount' | 'lastViewedAt' | 'createdAt' | 'updatedAt'> {}

class UserView extends Model<UserViewAttributes, UserViewCreationAttributes> implements UserViewAttributes {
  public id!: number;
  public userId!: number;
  public recipeId!: number;
  public viewCount!: number;
  public lastViewedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserView.init(
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
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'view_count',
    },
    lastViewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_viewed_at',
    },
  },
  {
    sequelize,
    tableName: 'user_views',
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'recipe_id'],
      },
      {
        fields: ['user_id'],
      },
      {
        fields: ['recipe_id'],
      },
      {
        fields: ['last_viewed_at'],
      },
    ],
  }
);

export default UserView;
