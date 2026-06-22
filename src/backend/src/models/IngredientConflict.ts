import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';
import type Ingredient from './Ingredient';

interface IngredientConflictAttributes {
  id: number;
  ingredientId1: number;
  ingredientId2: number;
  conflictReason: string;
  severity: 'low' | 'medium' | 'high';
  createdAt?: Date;
  updatedAt?: Date;
}

interface IngredientConflictCreationAttributes extends Optional<IngredientConflictAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class IngredientConflict extends Model<IngredientConflictAttributes, IngredientConflictCreationAttributes> implements IngredientConflictAttributes {
  public id!: number;
  public ingredientId1!: number;
  public ingredientId2!: number;
  public conflictReason!: string;
  public severity!: 'low' | 'medium' | 'high';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public readonly ingredient1?: InstanceType<typeof Ingredient>;
  public readonly ingredient2?: InstanceType<typeof Ingredient>;
}

IngredientConflict.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ingredientId1: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ingredient_id_1',
      references: {
        model: 'ingredients',
        key: 'id',
      },
    },
    ingredientId2: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'ingredient_id_2',
      references: {
        model: 'ingredients',
        key: 'id',
      },
    },
    conflictReason: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'conflict_reason',
    },
    severity: {
      type: DataTypes.ENUM('low', 'medium', 'high'),
      defaultValue: 'medium',
    },
  },
  {
    sequelize,
    tableName: 'ingredient_conflicts',
    underscored: true,
    indexes: [],
  }
);

export default IngredientConflict;
