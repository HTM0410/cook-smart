import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface IngredientCategoryAttributes {
  id: number;
  categoryName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IngredientCategoryCreationAttributes extends Optional<IngredientCategoryAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class IngredientCategory extends Model<IngredientCategoryAttributes, IngredientCategoryCreationAttributes> implements IngredientCategoryAttributes {
  public id!: number;
  public categoryName!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

IngredientCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    categoryName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'category_name',
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
  },
  {
    sequelize,
    tableName: 'ingredient_categories',
    underscored: true,
  }
);

export default IngredientCategory;
