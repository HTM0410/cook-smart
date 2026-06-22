import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';
import type MealPlan from './MealPlan';
import type Recipe from './Recipe';

interface MealPlanItemAttributes {
  id: number;
  mealPlanId: number;
  recipeId: number;
  plannedDate: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MealPlanItemCreationAttributes extends Optional<MealPlanItemAttributes, 'id' | 'notes' | 'createdAt' | 'updatedAt'> {}

class MealPlanItem extends Model<MealPlanItemAttributes, MealPlanItemCreationAttributes> implements MealPlanItemAttributes {
  public id!: number;
  public mealPlanId!: number;
  public recipeId!: number;
  public plannedDate!: string;
  public mealType!: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  public servings!: number;
  public notes?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public readonly mealPlan?: InstanceType<typeof MealPlan>;
  public readonly recipe?: InstanceType<typeof Recipe>;
}

MealPlanItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mealPlanId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'meal_plan_id',
      references: {
        model: 'meal_plans',
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
    plannedDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'planned_date',
    },
    mealType: {
      type: DataTypes.ENUM('breakfast', 'lunch', 'dinner', 'snack'),
      allowNull: false,
    },
    servings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: {
        min: 1,
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'meal_plan_items',
    underscored: true,
    indexes: [
      {
        fields: ['meal_plan_id'],
      },
      {
        fields: ['recipe_id'],
      },
    ],
  }
);

export default MealPlanItem;
