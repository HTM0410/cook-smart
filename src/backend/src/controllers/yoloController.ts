import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { yoloService, DetectedIngredient } from '../services/yoloService';
import { Ingredient, IngredientCategory, DetectionHistory } from '../models';
import { getIngredientName, YOLO_LABEL_MAPPING } from '../config/yoloLabelMapping';

/**
 * Standard API response format
 */
interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

/**
 * Map detected ingredient to database ingredient
 */
interface DbMatchedIngredient {
  id: number | null;
  name: string;
  yoloLabel: string;
  inDatabase: boolean;
  categoryId?: number;
  categoryName?: string;
}

/**
 * Full detection result
 */
interface DetectionResult {
  detectedIngredients: DetectedIngredient[];
  dbMatchedIngredients: DbMatchedIngredient[];
  missingIngredients: string[];
  totalDetected: number;
  totalInDatabase: number;
}

/**
 * Map YOLO labels to exact database ingredient names
 */
function mapYoloLabelsToDbNames(ingredients: DetectedIngredient[]): {
  mappedNames: Map<string, string>;
  unmapped: string[];
} {
  const mappedNames = new Map<string, string>();
  const unmapped: string[] = [];

  for (const ing of ingredients) {
    const dbName = getIngredientName(ing.yoloLabel);
    if (dbName) {
      mappedNames.set(ing.yoloLabel, dbName);
    } else {
      unmapped.push(ing.yoloLabel);
    }
  }

  return { mappedNames, unmapped };
}

/**
 * Check YOLO service health
 * GET /api/yolo/health
 */
export const getYoloHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const health = await yoloService.checkHealth(forceRefresh);

    res.json({
      success: true,
      message: 'YOLO service health retrieved',
      data: {
        available: health.ok && health.model_loaded,
        modelLoaded: health.model_loaded,
        modelPath: health.model_path,
        modelMetadata: health.model_metadata,
        timestamp: health.timestamp,
      },
    });
  } catch (error: any) {
    console.error('[yoloController] Health check error:', error);
    res.status(503).json({
      success: false,
      message: 'YOLO service is not available',
      error: error.message,
    });
  }
};

/**
 * Get detailed YOLO service info
 * GET /api/yolo/info
 */
export const getYoloInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const health = await yoloService.checkHealth();

    res.json({
      success: true,
      message: 'YOLO service info retrieved',
      data: {
        available: health.ok && health.model_loaded,
        modelLoaded: health.model_loaded,
        modelPath: health.model_path,
        classCount: health.model_metadata?.class_count || 0,
        classNames: health.model_metadata?.class_names || [],
        supportedLabels: Object.keys(YOLO_LABEL_MAPPING).length,
      },
    });
  } catch (error: any) {
    console.error('[yoloController] Get info error:', error);
    res.status(503).json({
      success: false,
      message: 'YOLO service is not available',
      error: error.message,
    });
  }
};

/**
 * Get all supported labels
 * GET /api/yolo/labels
 */
export const getLabels = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const labels = await yoloService.getLabels();

    res.json({
      success: true,
      message: 'Labels retrieved',
      data: {
        labels: labels.labels,
        totalCount: labels.total_count,
      },
    });
  } catch (error: any) {
    console.error('[yoloController] Get labels error:', error);
    // Fallback to local mapping if YOLO service is unavailable
    const localLabels = Object.entries(YOLO_LABEL_MAPPING).map(([yoloLabel, mapping]) => ({
      yolo_label: yoloLabel,
      ingredient_name: mapping.ingredientName,
      category: mapping.category,
    }));

    res.json({
      success: true,
      message: 'Labels retrieved (local mapping)',
      data: {
        labels: localLabels,
        totalCount: localLabels.length,
      },
    });
  }
};

/**
 * Detect ingredients from uploaded image
 * POST /api/yolo/detect
 */
export const detectIngredients = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { imageBase64, mimeType, minConfidence } = req.body;

    if (!imageBase64) {
      res.status(400).json({
        success: false,
        message: 'Image data is required',
      });
      return;
    }

    // Call YOLO service
    const result = await yoloService.detectIngredients(imageBase64, mimeType, minConfidence);

    if (!result.detected || result.ingredients.length === 0) {
      res.json({
        success: true,
        message: 'No ingredients detected in the image',
        data: {
          detected: false,
          ingredients: [],
          dbMatched: [],
          missing: [],
          totalDetected: 0,
          totalInDatabase: 0,
        },
      });
      return;
    }

    // Map YOLO labels to exact database ingredient names
    const { mappedNames, unmapped } = mapYoloLabelsToDbNames(result.ingredients);
    const ingredientNames = Array.from(mappedNames.values());

    const dbMatchedIngredients: DbMatchedIngredient[] = [];
    const missingIngredients: string[] = [];

    if (ingredientNames.length > 0) {
      // Find matching ingredients in database using EXACT names
      const dbIngredients = await Ingredient.findAll({
        where: {
          ingredientName: {
            [Op.or]: ingredientNames.map(name => ({ [Op.eq]: name })),
          },
        },
        include: [
          {
            model: IngredientCategory,
            as: 'category',
            attributes: ['id', 'categoryName'],
          },
        ],
      });

      // Create a map for quick lookup using exact database names
      const dbIngredientMap = new Map<string, typeof dbIngredients[0]>();
      dbIngredients.forEach(ing => {
        dbIngredientMap.set(ing.ingredientName, ing);
      });

      // Match detected ingredients with database using exact names
      for (const ing of result.ingredients) {
        const dbName = mappedNames.get(ing.yoloLabel);
        const dbIngredient = dbName ? dbIngredientMap.get(dbName) : null;

        if (dbIngredient) {
          dbMatchedIngredients.push({
            id: dbIngredient.id,
            name: dbIngredient.ingredientName,
            yoloLabel: ing.yoloLabel,
            inDatabase: true,
            categoryId: dbIngredient.categoryId,
            categoryName: dbIngredient.category?.categoryName,
          });
        } else if (dbName) {
          // Name was mapped but not found in database
          missingIngredients.push(dbName);
          dbMatchedIngredients.push({
            id: null,
            name: dbName,
            yoloLabel: ing.yoloLabel,
            inDatabase: false,
          });
        }
      }
    }

    // Add unmapped YOLO labels (not in our mapping)
    for (const yoloLabel of unmapped) {
      missingIngredients.push(yoloLabel);
      dbMatchedIngredients.push({
        id: null,
        name: yoloLabel,
        yoloLabel: yoloLabel,
        inDatabase: false,
      });
    }

    const detectionResult: DetectionResult = {
      detectedIngredients: result.ingredients,
      dbMatchedIngredients,
      missingIngredients,
      totalDetected: result.count,
      totalInDatabase: dbMatchedIngredients.filter(i => i.inDatabase).length,
    };

    res.json({
      success: true,
      message: `Detected ${result.count} ingredients, ${detectionResult.totalInDatabase} found in database`,
      data: {
        detected: result.detected,
        ingredients: detectionResult.detectedIngredients,
        dbMatched: detectionResult.dbMatchedIngredients,
        missing: detectionResult.missingIngredients,
        totalDetected: detectionResult.totalDetected,
        totalInDatabase: detectionResult.totalInDatabase,
      },
    });
  } catch (error: any) {
    console.error('[yoloController] Detection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect ingredients',
      error: error.message,
    });
  }
};

/**
 * Search recipes by detected ingredients
 * POST /api/yolo/search-recipes
 */
export const searchRecipesByDetection = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { imageBase64, mimeType, minConfidence } = req.body;

    if (!imageBase64) {
      res.status(400).json({
        success: false,
        message: 'Image data is required',
      });
      return;
    }

    // First detect ingredients
    const detectionResult = await yoloService.detectIngredients(imageBase64, mimeType, minConfidence);

    if (!detectionResult.detected || detectionResult.ingredients.length === 0) {
      res.json({
        success: true,
        message: 'No ingredients detected in the image',
        data: {
          detected: false,
          ingredients: [],
          recipes: [],
        },
      });
      return;
    }

    // Map YOLO labels to exact database ingredient names
    const { mappedNames, unmapped } = mapYoloLabelsToDbNames(detectionResult.ingredients);
    const ingredientNames = Array.from(mappedNames.values());
    
    // Find ingredients in database using EXACT names
    const dbIngredients = await Ingredient.findAll({
      where: {
        ingredientName: {
          [Op.or]: ingredientNames.map(name => ({ [Op.eq]: name })),
        },
      },
      attributes: ['id', 'ingredientName'],
    });

    const matchedIngredientNames = dbIngredients.map(i => i.ingredientName);
    const missingFromDb = ingredientNames.filter(
      name => !matchedIngredientNames.includes(name)
    );

    // Create display with exact names from database
    const displayIngredients = detectionResult.ingredients.map(ing => {
      const dbName = mappedNames.get(ing.yoloLabel);
      return {
        yoloLabel: ing.yoloLabel,
        name: dbName || ing.yoloLabel, // Use exact DB name or keep YOLO label
        confidence: ing.confidence,
        inDatabase: dbName ? matchedIngredientNames.includes(dbName) : false,
      };
    });

    res.json({
      success: true,
      message: `Detected ${detectionResult.count} ingredients, ${matchedIngredientNames.length} found in database`,
      data: {
        detected: detectionResult.detected,
        ingredients: displayIngredients,
        matchedIngredients: dbIngredients,
        missingIngredients: [...missingFromDb, ...unmapped],
        totalDetected: detectionResult.count,
        totalMatched: matchedIngredientNames.length,
      },
    });
  } catch (error: any) {
    console.error('[yoloController] Search recipes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search recipes by detection',
      error: error.message,
    });
  }
};

/**
 * Save detection history (for admin review when user modifies)
 * POST /api/yolo/save-history
 */
export const saveDetectionHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { imageHash, originalIngredients, finalIngredients, wasModified } = req.body;

    if (!imageHash || !Array.isArray(originalIngredients) || !Array.isArray(finalIngredients)) {
      res.status(400).json({
        success: false,
        message: 'Invalid request body',
      });
      return;
    }

    // Only save if was modified (requirement from use case)
    if (!wasModified) {
      res.json({
        success: true,
        message: 'No modification detected, history not saved',
        data: {
          saved: false,
        },
      });
      return;
    }

    // Get user ID from auth token if available
    const userId = (req as any).user?.id || null;

    // Create detection history record
    const history = await DetectionHistory.create({
      imageHash,
      originalIngredients,
      finalIngredients,
      wasModified,
      submittedBy: userId,
    });

    console.log(`[yoloController] Saved detection history: ${history.id}`);

    res.json({
      success: true,
      message: 'Detection history saved for admin review',
      data: {
        saved: true,
        historyId: history.id,
      },
    });
  } catch (error: any) {
    console.error('[yoloController] Save history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save detection history',
      error: error.message,
    });
  }
};
