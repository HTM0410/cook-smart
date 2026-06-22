import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';
import type User from './User';
import type IngredientCategory from './IngredientCategory';

interface PendingIngredientAttributes {
  id: number;
  ingredientName: string;
  categoryId: number;
  description?: string;
  submittedBy: number; // User ID who submitted
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: number; // Admin ID who reviewed
  reviewedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PendingIngredientCreationAttributes extends Optional<
  PendingIngredientAttributes, 
  'id' | 'description' | 'status' | 'reviewedBy' | 'reviewedAt' | 'rejectionReason' | 'createdAt' | 'updatedAt'
> {}

class PendingIngredient extends Model<PendingIngredientAttributes, PendingIngredientCreationAttributes> 
  implements PendingIngredientAttributes {
  public id!: number;
  public ingredientName!: string;
  public categoryId!: number;
  public description?: string;
  public submittedBy!: number;
  public status!: 'pending' | 'approved' | 'rejected';
  public reviewedBy?: number;
  public reviewedAt?: Date;
  public rejectionReason?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association properties
  public readonly submitter?: InstanceType<typeof User>;
  public readonly reviewer?: InstanceType<typeof User>;
  public readonly category?: InstanceType<typeof IngredientCategory>;

  // Static methods
  static async getPendingIngredients(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    
    return await this.findAndCountAll({
      where: { status: 'pending' },
      include: [
        {
          model: sequelize.models.User,
          as: 'submitter',
          attributes: ['id', 'username', 'email'],
        },
        {
          model: sequelize.models.IngredientCategory,
          as: 'category',
          attributes: ['id', 'categoryName'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });
  }

  static async approveIngredient(id: number, reviewedBy: number) {
    const pendingIngredient = await this.findByPk(id);
    if (!pendingIngredient) {
      throw new Error('Pending ingredient not found');
    }

    if (pendingIngredient.status !== 'pending') {
      throw new Error('Ingredient is not in pending status');
    }

    // Create the actual ingredient
    const Ingredient = sequelize.models.Ingredient;
    await Ingredient.create({
      ingredientName: pendingIngredient.ingredientName,
      categoryId: pendingIngredient.categoryId,
      description: pendingIngredient.description,
    });

    // Update pending ingredient status
    await pendingIngredient.update({
      status: 'approved',
      reviewedBy,
      reviewedAt: new Date(),
    });

    return pendingIngredient;
  }

  static async rejectIngredient(id: number, reviewedBy: number, rejectionReason: string) {
    const pendingIngredient = await this.findByPk(id);
    if (!pendingIngredient) {
      throw new Error('Pending ingredient not found');
    }

    if (pendingIngredient.status !== 'pending') {
      throw new Error('Ingredient is not in pending status');
    }

    await pendingIngredient.update({
      status: 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
      rejectionReason,
    });

    return pendingIngredient;
  }

  static async getStats() {
    const [total, pending, approved, rejected] = await Promise.all([
      this.count(),
      this.count({ where: { status: 'pending' } }),
      this.count({ where: { status: 'approved' } }),
      this.count({ where: { status: 'rejected' } }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
    };
  }
}

PendingIngredient.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ingredientName: {
      type: DataTypes.STRING(100),
      allowNull: false,
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
    submittedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'submitted_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'pending',
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'reviewed_by',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'rejection_reason',
    },
  },
  {
    sequelize,
    tableName: 'pending_ingredients',
    underscored: true,
    indexes: [
      {
        fields: ['ingredient_name'],
      },
      {
        fields: ['category_id'],
      },
      {
        fields: ['submitted_by'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['created_at'],
      },
    ],
  }
);

export default PendingIngredient;