import { Request, Response, NextFunction } from 'express';
import SearchKeyword from '../models/SearchKeyword';
import { BadRequestError } from '../utils/errors';

// Track một từ khóa tìm kiếm
export const trackSearch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { keyword } = req.body;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      throw new BadRequestError('Keyword is required and must be a non-empty string');
    }

    const searchKeyword = await SearchKeyword.trackSearch(keyword);

    res.json({
      success: true,
      message: 'Search tracked successfully',
      data: {
        keyword: searchKeyword.keyword,
        searchCount: searchKeyword.searchCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách từ khóa thịnh hành
export const getTrendingKeywords = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const days = parseInt(req.query.days as string) || 30;

    let keywords: SearchKeyword[];
    
    if (days > 0) {
      // Lấy top keywords trong N ngày gần đây
      keywords = await SearchKeyword.getTopKeywords(limit, days);
    } else {
      // Lấy top keywords tất cả thời gian
      keywords = await SearchKeyword.getTrendingKeywords(limit);
    }

    res.json({
      success: true,
      message: 'Trending keywords retrieved successfully',
      data: {
        keywords: keywords.map(k => ({
          keyword: k.keyword,
          searchCount: k.searchCount,
          lastSearchedAt: k.lastSearchedAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};
