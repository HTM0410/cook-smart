import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface RecipeCategoryAttributes {
  id: number;
  categoryName: string;
  categoryType: 'cuisine' | 'course' | 'tag';
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RecipeCategoryCreationAttributes extends Optional<RecipeCategoryAttributes, 'id' | 'description' | 'createdAt' | 'updatedAt'> {}

class RecipeCategory extends Model<RecipeCategoryAttributes, RecipeCategoryCreationAttributes> implements RecipeCategoryAttributes {
  public id!: number;
  public categoryName!: string;
  public categoryType!: 'cuisine' | 'course' | 'tag';
  public description?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public readonly recipes?: any[];
}

RecipeCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    categoryName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'category_name',
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    categoryType: {
      type: DataTypes.ENUM('cuisine', 'course', 'tag'),
      allowNull: false,
      field: 'category_type',
      validate: {
        isIn: [['cuisine', 'course', 'tag']],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'recipe_categories',
    underscored: true,
    indexes: [
      {
        fields: ['category_type'],
      },
      {
        fields: ['category_name'],
      },
      {
        unique: true,
        fields: ['category_name', 'category_type'],
        name: 'unique_category_name_type',
      },
    ],
  }
);

export default RecipeCategory;

