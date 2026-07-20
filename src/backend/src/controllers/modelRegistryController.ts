/**
 * Model Registry Controller
 * 
 * Handles HTTP requests for model registry operations.
 */
import { Request, Response } from 'express';
import multer from 'multer';
import {
  listModels as listModelsService,
  getModel as getModelService,
  uploadModel as uploadModelService,
  updateModel as updateModelService,
  deleteModel as deleteModelService,
  setActiveModel as setActiveModelService,
  addAlias as addAliasService,
  removeAlias as removeAliasService,
} from '../services/modelRegistryService';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, '/tmp');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/octet-stream' || file.originalname.endsWith('.pt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .pt files are allowed'));
    }
  },
});

/**
 * GET /api/admin/models
 * List all models in registry
 */
export const listModels = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await listModelsService();
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Error listing models:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to list models',
    });
  }
};

/**
 * GET /api/admin/models/:version
 * Get details of a specific model version
 */
export const getModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.params;
    const model = await getModelService(version);
    
    if (!model) {
      res.status(404).json({
        success: false,
        message: `Model ${version} not found`,
      });
      return;
    }
    
    res.json({
      success: true,
      data: model,
    });
  } catch (error: any) {
    console.error('Error getting model:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get model',
    });
  }
};

/**
 * POST /api/admin/models/upload
 * Upload a new model file
 */
export const uploadModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = (req as any).file;
    
    if (!file) {
      res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
      return;
    }
    
    const { version, alias, notes, baseModel, classes } = req.body;
    
    if (!version) {
      res.status(400).json({
        success: false,
        message: 'Version is required',
      });
      return;
    }
    
    const model = await uploadModelService({
      filePath: file.path,
      version,
      alias,
      notes,
      baseModel,
      classes: classes ? parseInt(classes, 10) : undefined,
    });
    
    res.json({
      success: true,
      message: `Model ${version} uploaded successfully`,
      data: model,
    });
  } catch (error: any) {
    console.error('Error uploading model:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload model',
    });
  }
};

/**
 * PUT /api/admin/models/:version
 * Update model metadata
 */
export const updateModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.params;
    const updates = req.body;
    
    const model = await updateModelService(version, updates);
    
    res.json({
      success: true,
      message: `Model ${version} updated successfully`,
      data: model,
    });
  } catch (error: any) {
    console.error('Error updating model:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update model',
    });
  }
};

/**
 * DELETE /api/admin/models/:version
 * Delete a model from registry
 */
export const deleteModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.params;
    
    await deleteModelService(version);
    
    res.json({
      success: true,
      message: `Model ${version} deleted from registry`,
    });
  } catch (error: any) {
    console.error('Error deleting model:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete model',
    });
  }
};

/**
 * POST /api/admin/models/:version/set-active
 * Set model as active (production)
 */
export const setActiveModel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.params;
    
    await setActiveModelService(version);
    
    res.json({
      success: true,
      message: `Model ${version} set as active`,
    });
  } catch (error: any) {
    console.error('Error setting active model:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to set active model',
    });
  }
};

/**
 * POST /api/admin/models/:version/aliases
 * Add alias to model
 */
export const addAlias = async (req: Request, res: Response): Promise<void> => {
  try {
    const { version } = req.params;
    const { alias } = req.body;
    
    if (!alias) {
      res.status(400).json({
        success: false,
        message: 'Alias is required',
      });
      return;
    }
    
    await addAliasService(version, alias);
    
    res.json({
      success: true,
      message: `Alias '${alias}' added to ${version}`,
    });
  } catch (error: any) {
    console.error('Error adding alias:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to add alias',
    });
  }
};

/**
 * DELETE /api/admin/models/:version/aliases/:alias
 * Remove alias from model
 */
export const removeAlias = async (req: Request, res: Response): Promise<void> => {
  try {
    const { version, alias } = req.params;
    
    await removeAliasService(version, alias);
    
    res.json({
      success: true,
      message: `Alias '${alias}' removed from ${version}`,
    });
  } catch (error: any) {
    console.error('Error removing alias:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to remove alias',
    });
  }
};

// Export upload middleware for routes
export const uploadMiddleware = upload.single('model');
