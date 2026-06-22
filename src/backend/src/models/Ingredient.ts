import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';
import type IngredientCategory from './IngredientCategory';
import type Recipe from './Recipe';

interface IngredientAttributes {
  id: number;
  ingredientName: string;
  categoryId: number;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IngredientCreationAttributes extends Optional<IngredientAttributes, 'id' | 'description' | 'createdAt' | 'updatedAt'> {}

class Ingredient extends Model<IngredientAttributes, IngredientCreationAttributes> implements IngredientAttributes {
  public id!: number;
  public ingredientName!: string;
  public categoryId!: number;
  public description?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public readonly category?: InstanceType<typeof IngredientCategory>;
  public readonly recipes?: InstanceType<typeof Recipe>[];
}

Ingredient.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ingredientName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      field: 'ingredient_name',
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'category_id',
      references: {
        model: 'ingredient_categories',
        key: 'id',
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'ingredients',
    underscored: true,
    indexes: [
      {
        fields: ['ingredient_name'],
      },
      {
        fields: ['category_id'],
      },
    ],
  }
);

export default Ingredient;
