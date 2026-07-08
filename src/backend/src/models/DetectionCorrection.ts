import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

export type CorrectionStatus = 'pending' | 'approved' | 'rejected';

export interface DetectionCorrectionAttributes {
  id: number;
  detectionHistoryId: number;
  status: CorrectionStatus;
  reviewedBy?: number | null;
  reviewedAt?: Date | null;
  notes?: string | null;
  imageHash: string;
  originalIngredients: string[];
  finalIngredients: string[];
  addedIngredients: string[];
  removedIngredients: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DetectionCorrectionCreationAttributes
  extends Optional<
    DetectionCorrectionAttributes,
    'id' | 'reviewedBy' | 'reviewedAt' | 'notes' | 'createdAt' | 'updatedAt'
  > {}

class DetectionCorrection
  extends Model<DetectionCorrectionAttributes, DetectionCorrectionCreationAttributes>
  implements DetectionCorrectionAttributes {
  public id!: number;
  public detectionHistoryId!: number;
  public status!: CorrectionStatus;
  public reviewedBy!: number | null;
  public reviewedAt!: Date | null;
  public notes!: string | null;
  public imageHash!: string;
  public originalIngredients!: string[];
  public finalIngredients!: string[];
  public addedIngredients!: string[];
  public removedIngredients!: string[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static async listByStatus(status: CorrectionStatus, limit = 50) {
    return await this.findAll({
      where: { status },
      order: [['createdAt', 'DESC']],
      limit,
    });
  }

  static async stats() {
    const total = await this.count();
    const pending = await this.count({ where: { status: 'pending' } });
    const approved = await this.count({ where: { status: 'approved' } });
    const rejected = await this.count({ where: { status: 'rejected' } });
    return { total, pending, approved, rejected };
  }
}

DetectionCorrection.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    detectionHistoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'detection_history_id',
      references: {
        model: 'detection_history',
        key: 'id',
      },
      onDelete: 'CASCADE',
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
      references: { model: 'users', key: 'id' },
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    imageHash: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'image_hash',
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
    addedIngredients: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'added_ingredients',
    },
    removedIngredients: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: 'removed_ingredients',
    },
  },
  {
    sequelize,
    tableName: 'detection_corrections',
    underscored: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['detection_history_id'] },
      { fields: ['reviewed_by'] },
    ],
  }
);

export default DetectionCorrection;
