import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface RecipeEmbeddingAttributes {
  id: number;
  recipeId: number;
  chunkIndex: number;
  content: string;
  contentType: string;
  embedding: number[];
  createdAt?: Date;
}

interface RecipeEmbeddingCreationAttributes extends Optional<RecipeEmbeddingAttributes, 'id' | 'chunkIndex' | 'contentType' | 'createdAt'> {}

class RecipeEmbedding extends Model<RecipeEmbeddingAttributes, RecipeEmbeddingCreationAttributes> implements RecipeEmbeddingAttributes {
  public id!: number;
  public recipeId!: number;
  public chunkIndex!: number;
  public content!: string;
  public contentType!: string;
  public embedding!: number[];
  public readonly createdAt!: Date;
}

RecipeEmbedding.init(
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
    chunkIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'chunk_index',
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    contentType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'general',
      field: 'content_type',
    },
    embedding: {
      type: DataTypes.ARRAY(DataTypes.FLOAT),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'recipe_embeddings',
    underscored: true,
    timestamps: false,
    createdAt: 'created_at',
    indexes: [
      {
        fields: ['recipe_id'],
      },
    ],
  }
);

export default RecipeEmbedding;
