import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';
import User from './User';

interface ChatSessionAttributes {
  id: number;
  userId: number;
  sessionTitle: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ChatSessionCreationAttributes extends Optional<ChatSessionAttributes, 'id' | 'sessionTitle' | 'createdAt' | 'updatedAt'> {}

class ChatSession extends Model<ChatSessionAttributes, ChatSessionCreationAttributes> implements ChatSessionAttributes {
  public id!: number;
  public userId!: number;
  public sessionTitle!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly user?: InstanceType<typeof User>;
  public readonly messages?: any[];
}

ChatSession.init(
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
    sessionTitle: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: 'New Chat',
      field: 'session_title',
    },
  },
  {
    sequelize,
    tableName: 'chat_sessions',
    underscored: true,
    timestamps: true,
    updatedAt: true,
    indexes: [
      {
        fields: ['user_id'],
      },
    ],
  }
);

export default ChatSession;
