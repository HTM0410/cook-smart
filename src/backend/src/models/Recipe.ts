import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';
import type Admin from './Admin';
import type Ingredient from './Ingredient';
import type RecipeStep from './RecipeStep';
import type User from './User';

interface RecipeAttributes {
  id: number;
  recipeName: string;
  description?: string;
  imageUrl?: string;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  prepTime: number; // minutes
  cookTime: number; // minutes
  createdBy: number; // FK to Admin
  status: 'visible' | 'hidden';
  createdAt?: Date;
  updatedAt?: Date;
}

interface RecipeCreationAttributes extends Optional<RecipeAttributes, 'id' | 'description' | 'imageUrl' | 'status' | 'createdAt' | 'updatedAt'> {}

class Recipe extends Model<RecipeAttributes, RecipeCreationAttributes> implements RecipeAttributes {
  public id!: number;
  public recipeName!: string;
  public description?: string;
  public imageUrl?: string;
  public servings!: number;
  public difficulty!: 'easy' | 'medium' | 'hard';
  public prepTime!: number;
  public cookTime!: number;
  public createdBy!: number;
  public status!: 'visible' | 'hidden';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public readonly creator?: InstanceType<typeof Admin>;
  public readonly ingredients?: InstanceType<typeof Ingredient>[];
  public readonly steps?: InstanceType<typeof RecipeStep>[];
  public readonly favoritedBy?: InstanceType<typeof User>[];

  // Computed properties
  public get totalTime(): number {
    return this.prepTime + this.cookTime;
  }
}

Recipe.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    recipeName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: 'recipe_name',
      validate: {
        len: [1, 150],
        notEmpty: true,
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'image_url',
    },
    prepTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'prep_time',
      validate: {
        min: 0,
      },
    },
    cookTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'cook_time',
      validate: {
        min: 0,
      },
    },
    servings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
    },
    difficulty: {
      type: DataTypes.ENUM('easy', 'medium', 'hard'),
      allowNull: false,
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'created_by',
      references: {
        model: 'admins',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('visible', 'hidden'),
      defaultValue: 'visible',
    },
  },
  {
    sequelize,
    tableName: 'recipes',
    underscored: true,
    indexes: [
      {
        fields: ['recipe_name'],
      },
      {
        fields: ['created_by'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['difficulty'],
      },
    ],
  }
);

export default Recipe;
