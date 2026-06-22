import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface RecipeStepAttributes {
  id: number;
  recipeId: number;
  stepNumber: number;
  instruction: string;
  imageUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RecipeStepCreationAttributes extends Optional<RecipeStepAttributes, 'id' | 'imageUrl' | 'createdAt' | 'updatedAt'> {}

class RecipeStep extends Model<RecipeStepAttributes, RecipeStepCreationAttributes> implements RecipeStepAttributes {
  public id!: number;
  public recipeId!: number;
  public stepNumber!: number;
  public instruction!: string;
  public imageUrl?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RecipeStep.init(
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
    stepNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'step_number',
      validate: {
        min: 1,
      },
    },
    instruction: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    imageUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'image_url',
    },
  },
  {
    sequelize,
    tableName: 'recipe_steps',
    underscored: true,
    indexes: [
      {
        fields: ['recipe_id'],
      },
      {
        fields: ['recipe_id', 'step_number'],
      },
    ],
  }
);

export default RecipeStep;
