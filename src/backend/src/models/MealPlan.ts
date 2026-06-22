import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';
import type User from './User';
import type MealPlanItem from './MealPlanItem';

interface MealPlanAttributes {
  id: number;
  userId: number;
  planName: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'archived';
  createdAt?: Date;
  updatedAt?: Date;
}

interface MealPlanCreationAttributes extends Optional<MealPlanAttributes, 'id' | 'status' | 'createdAt' | 'updatedAt'> {}

class MealPlan extends Model<MealPlanAttributes, MealPlanCreationAttributes> implements MealPlanAttributes {
  public id!: number;
  public userId!: number;
  public planName!: string;
  public startDate!: string;
  public endDate!: string;
  public status!: 'active' | 'completed' | 'archived';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public readonly user?: InstanceType<typeof User>;
  public readonly items?: InstanceType<typeof MealPlanItem>[];
}

MealPlan.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    planName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: 'plan_name',
      validate: {
        len: [1, 200],
        notEmpty: true,
      },
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'start_date',
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: 'end_date',
    },
    status: {
      type: DataTypes.ENUM('active', 'completed', 'archived'),
      defaultValue: 'active',
      field: 'status',
    },
  },
  {
    sequelize,
    tableName: 'meal_plans',
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
    ],
  }
);

export default MealPlan;
