import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface RecipeIngredientAttributes {
  id: number;
  recipeId: number;
  ingredientId: number;
  quantity: string;
  unit?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RecipeIngredientCreationAttributes extends Optional<RecipeIngredientAttributes, 'id' | 'unit' | 'notes' | 'createdAt' | 'updatedAt'> {}

class RecipeIngredient extends Model<RecipeIngredientAttributes, RecipeIngredientCreationAttributes> implements RecipeIngredientAttributes {
  public id!: number;
  public recipeId!: number;
  public ingredientId!: number;
  public quantity!: string;
  public unit?: string;
  public notes?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RecipeIngredient.init(
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
    ingredientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ingredient_id',
      references: {
        model: 'ingredients',
        key: 'id',
      },
    },
    quantity: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'recipe_ingredients',
    underscored: true,
    indexes: [
      {
        fields: ['recipe_id'],
      },
      {
        fields: ['ingredient_id'],
      },
      {
        unique: true,
        fields: ['recipe_id', 'ingredient_id'],
      },
    ],
  }
);

export default RecipeIngredient;
