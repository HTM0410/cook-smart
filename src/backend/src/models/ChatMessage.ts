import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database-supabase';

interface ChatMessageAttributes {
  id: number;
  sessionId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

interface ChatMessageCreationAttributes extends Optional<ChatMessageAttributes, 'id' | 'metadata' | 'createdAt'> {}

class ChatMessage extends Model<ChatMessageAttributes, ChatMessageCreationAttributes> implements ChatMessageAttributes {
  public id!: number;
  public sessionId!: number;
  public role!: 'user' | 'assistant' | 'system';
  public content!: string;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
}

ChatMessage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'session_id',
      references: {
        model: 'chat_sessions',
        key: 'id',
      },
    },
    role: {
      type: DataTypes.ENUM('user', 'assistant', 'system'),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    sequelize,
    tableName: 'chat_messages',
    underscored: true,
    timestamps: false,
    indexes: [
      {
        fields: ['session_id'],
      },
    ],
  }
);

export default ChatMessage;
