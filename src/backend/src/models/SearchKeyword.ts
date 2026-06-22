import { DataTypes, Model, Optional, Op } from 'sequelize';
import sequelize from '../config/database-supabase';

interface SearchKeywordAttributes {
  id: number;
  keyword: string;
  searchCount: number;
  lastSearchedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface SearchKeywordCreationAttributes extends Optional<
  SearchKeywordAttributes, 
  'id' | 'searchCount' | 'lastSearchedAt' | 'createdAt' | 'updatedAt'
> {}

class SearchKeyword extends Model<SearchKeywordAttributes, SearchKeywordCreationAttributes> 
  implements SearchKeywordAttributes {
  public id!: number;
  public keyword!: string;
  public searchCount!: number;
  public lastSearchedAt!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Static methods
  static async trackSearch(keyword: string): Promise<SearchKeyword> {
    const normalizedKeyword = keyword.trim().toLowerCase();
    
    if (!normalizedKeyword) {
      throw new Error('Keyword cannot be empty');
    }

    // Tìm hoặc tạo keyword
    const [searchKeyword, created] = await this.findOrCreate({
      where: { keyword: normalizedKeyword },
      defaults: {
        keyword: normalizedKeyword,
        searchCount: 1,
        lastSearchedAt: new Date(),
      },
    });

    if (!created) {
      // Tăng search count và cập nhật lastSearchedAt
      searchKeyword.searchCount += 1;
      searchKeyword.lastSearchedAt = new Date();
      await searchKeyword.save();
    }

    return searchKeyword;
  }

  static async getTrendingKeywords(limit: number = 10): Promise<SearchKeyword[]> {
    return await this.findAll({
      order: [
        ['searchCount', 'DESC'],
        ['lastSearchedAt', 'DESC'],
      ],
      limit,
    });
  }

  static async getTopKeywords(limit: number = 10, days: number = 30): Promise<SearchKeyword[]> {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    return await this.findAll({
      where: {
        lastSearchedAt: {
          [Op.gte]: dateLimit,
        },
      },
      order: [
        ['searchCount', 'DESC'],
        ['lastSearchedAt', 'DESC'],
      ],
      limit,
    });
  }
}

SearchKeyword.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    keyword: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      field: 'keyword', // Map to database column
    },
    searchCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'search_count', // Map to database column (snake_case)
    },
    lastSearchedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'last_searched_at', // Map to database column (snake_case)
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'updated_at',
    },
  },
  {
    sequelize,
    tableName: 'search_keywords',
    timestamps: true,
    underscored: false, // Không tự động convert sang snake_case
    freezeTableName: true, // Không thay đổi tên bảng
    indexes: [
      {
        unique: true,
        fields: ['keyword'],
        name: 'search_keywords_keyword_unique',
      },
      {
        fields: ['search_count'],
        name: 'idx_search_keywords_search_count',
      },
      {
        fields: ['last_searched_at'],
        name: 'idx_search_keywords_last_searched',
      },
    ],
  }
);

export default SearchKeyword;
