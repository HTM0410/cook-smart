import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface DetectionHistoryAttributes {
  id: number;
  imageHash: string;
  originalIngredients: string[];
  finalIngredients: string[];
  wasModified: boolean;
  submittedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface DetectionHistoryCreationAttributes extends Optional<
  DetectionHistoryAttributes,
  'id' | 'submittedBy' | 'createdAt' | 'updatedAt'
> {}

class DetectionHistory extends Model<DetectionHistoryAttributes, DetectionHistoryCreationAttributes>
  implements DetectionHistoryAttributes {
  public id!: number;
  public imageHash!: string;
  public originalIngredients!: string[];
  public finalIngredients!: string[];
  public wasModified!: boolean;
  public submittedBy?: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static async getRecentHistory(limit: number = 10) {
    return await this.findAll({
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  static async getHistoryByUser(userId: number, limit: number = 20) {
    return await this.findAll({
      where: { submittedBy: userId },
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  static async getModifiedDetections(limit: number = 50) {
    return await this.findAll({
      where: { wasModified: true },
      limit,
      order: [['createdAt', 'DESC']],
    });
  }
}

DetectionHistory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    imageHash: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'image_hash',
      validate: {
        len: [1, 100],
        notEmpty: true,
      },
    },
    originalIngredients: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'original_ingredients',
    },
    finalIngredients: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'final_ingredients',
    },
    wasModified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'was_modified',
    },
    submittedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'submitted_by',
    },
  },
  {
    sequelize,
    tableName: 'detection_history',
    underscored: true,
    indexes: [
      {
        fields: ['image_hash'],
      },
      {
        fields: ['submitted_by'],
      },
      {
        fields: ['was_modified'],
      },
    ],
  }
);

export default DetectionHistory;
