import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface RecipeCategoryMapAttributes {
  id: number;
  recipeId: number;
  categoryId: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RecipeCategoryMapCreationAttributes extends Optional<RecipeCategoryMapAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class RecipeCategoryMap extends Model<RecipeCategoryMapAttributes, RecipeCategoryMapCreationAttributes> implements RecipeCategoryMapAttributes {
  public id!: number;
  public recipeId!: number;
  public categoryId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RecipeCategoryMap.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'category_id',
      references: {
        model: 'recipe_categories',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'recipe_category_map',
    underscored: true,
    indexes: [
      {
        fields: ['recipe_id'],
      },
      {
        fields: ['category_id'],
      },
      {
        unique: true,
        fields: ['recipe_id', 'category_id'],
        name: 'unique_recipe_category',
      },
    ],
  }
);

export default RecipeCategoryMap;

