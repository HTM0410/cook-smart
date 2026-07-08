import { NextFunction, Request, Response } from 'express';
import { Op } from 'sequelize';
import {
  DetectionHistory,
  DetectionCorrection,
  User,
} from '../models';
import { YOLO_LABEL_MAPPING } from '../config/yoloLabelMapping';
import { yoloService } from '../services/yoloService';
import {
  exportCorrectionsAsYolo,
  syncCorrectionsFromHistory,
} from '../services/feedbackExportService';

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function difference(source: string[], target: string[]): string[] {
  const targetSet = new Set(target);
  return source.filter(item => !targetSet.has(item));
}

export const getMlopsOverview = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [healthResult, feedbackResult] = await Promise.all([
        yoloService.getDetailedHealth().then(
          health => ({ health, error: null as string | null }),
          error => ({ health: null, error: error instanceof Error ? error.message : String(error) })
        ),
        Promise.all([
          DetectionHistory.count(),
          DetectionHistory.count({ where: { wasModified: true } }),
          DetectionHistory.count({ where: { createdAt: { [Op.gte]: since } } }),
          DetectionHistory.findAll({
            where: { wasModified: true },
            include: [
              {
                model: User,
                as: 'submitter',
                attributes: ['id', 'fullName', 'email'],
                required: false,
              },
            ],
            order: [['createdAt', 'DESC']],
            limit: 20,
          }),
        ]).then(
          ([total, modified, last24Hours, recent]) => ({
            total,
            modified,
            last24Hours,
            recent,
            error: null as string | null,
          }),
          error => ({
            total: 0,
            modified: 0,
            last24Hours: 0,
            recent: [],
            error: error instanceof Error ? error.message : String(error),
          })
        ),
      ]);

    const health = healthResult.health;
    const modelMetadata = health?.model_metadata || {};
    const modelClasses = stringList(
      health?.class_names?.length ? health.class_names : modelMetadata.class_names
    );
    const mappedClasses = Object.keys(YOLO_LABEL_MAPPING);
    const missingMappings = difference(modelClasses, mappedClasses);
    const unusedMappings = difference(mappedClasses, modelClasses);
    // Build full mapping table for each YOLO class so admin can audit:
    // yoloLabel -> { vietnameseName, category }
    const classMappings = modelClasses.map(yoloLabel => {
      const mapping = YOLO_LABEL_MAPPING[yoloLabel];
      return {
        yoloLabel,
        vietnameseName: mapping?.ingredientName ?? null,
        category: mapping?.category ?? null,
        isMapped: Boolean(mapping),
      };
    });
    const classCount = health?.class_count || modelClasses.length;
    const schemaCompatible =
      Boolean(health?.model_loaded) &&
      classCount === mappedClasses.length &&
      missingMappings.length === 0 &&
      unusedMappings.length === 0;

    const warnings: string[] = [];
    if (!health) warnings.push('Không thể kết nối dịch vụ nhận diện.');
    else if (!health.model_loaded) warnings.push('Dịch vụ đang chạy nhưng model chưa được nạp.');
    if (health && !schemaCompatible) {
      warnings.push('Schema lớp của model không khớp mapping nguyên liệu trong ứng dụng.');
    }
    if (health?.mlops_enabled === false) {
      warnings.push('MLOps registry đang tắt; dịch vụ sử dụng checkpoint cục bộ.');
    }
    if (feedbackResult.error) {
      warnings.push('Không thể đọc dữ liệu phản hồi nhận diện.');
    }

    const feedbackItems = feedbackResult.recent.map(item => {
      const plain = item.get({ plain: true }) as any;
      const original = stringList(plain.originalIngredients);
      const final = stringList(plain.finalIngredients);
      return {
        id: plain.id,
        imageHash: plain.imageHash,
        originalIngredients: original,
        finalIngredients: final,
        addedIngredients: difference(final, original),
        removedIngredients: difference(original, final),
        createdAt: plain.createdAt,
        submitter: plain.submitter
          ? {
              id: plain.submitter.id,
              fullName: plain.submitter.fullName,
              email: plain.submitter.email,
            }
          : null,
      };
    });

    res.json({
      success: true,
      message: 'MLOps overview retrieved successfully',
      data: {
        generatedAt: new Date().toISOString(),
        service: {
          available: Boolean(health?.ok && health.model_loaded),
          ok: Boolean(health?.ok),
          modelLoaded: Boolean(health?.model_loaded),
          embeddingModelLoaded: Boolean(health?.embedding_model_loaded),
          mlopsEnabled: Boolean(health?.mlops_enabled),
          modelPath: health?.model_path || null,
          confidenceThreshold: health?.confidence_threshold ?? null,
          timestamp: health?.timestamp || null,
          error: healthResult.error,
        },
        model: {
          source: modelMetadata.source || 'unknown',
          artifact: modelMetadata.artifact || null,
          artifactVersion: modelMetadata.artifact_version || null,
          runId: modelMetadata.wandb_run_id || null,
          runUrl: modelMetadata.wandb_run_url || null,
          gitRevision: modelMetadata.git_revision || null,
          createdAt: modelMetadata.created_at || null,
          sha256: modelMetadata.model_sha256 || null,
          baseModel: modelMetadata.base_model || null,
          classCount,
          classNames: modelClasses,
          metrics: modelMetadata.metrics || {},
        },
        schema: {
          compatible: schemaCompatible,
          mappedClassCount: mappedClasses.length,
          missingMappings,
          unusedMappings,
          classMappings,
        },
        feedback: {
          total: feedbackResult.total,
          modified: feedbackResult.modified,
          last24Hours: feedbackResult.last24Hours,
          modificationRate:
            feedbackResult.total > 0 ? feedbackResult.modified / feedbackResult.total : 0,
          recent: feedbackItems,
        },
        monitoring: {
          grafanaUrl: process.env.GRAFANA_URL || null,
        },
        warnings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =============================================================================
// Feedback correction endpoints (admin review queue)
// =============================================================================

function normalizeIngredients(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

function diffAdded(original: string[], final: string[]): string[] {
  const set = new Set(original);
  return final.filter((f) => !set.has(f));
}

function diffRemoved(original: string[], final: string[]): string[] {
  const set = new Set(final);
  return original.filter((o) => !set.has(o));
}

/**
 * GET /api/mlops/feedback/queue?status=pending&limit=50
 */
export const getFeedbackQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = (req.query.status as string | undefined) || 'pending';
    const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 200);
    const validStatuses = ['pending', 'approved', 'rejected'] as const;

    if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
      res.status(400).json({
        success: false,
        message: `status khong hop le. Cho phep: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const rows = await DetectionCorrection.findAll({
      where: { status },
      include: [
        {
          model: User,
          as: 'reviewer',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });

    const items = rows.map((row) => {
      const plain = row.get({ plain: true }) as any;
      return {
        id: plain.id,
        detectionHistoryId: plain.detectionHistoryId,
        imageHash: plain.imageHash,
        status: plain.status,
        originalIngredients: normalizeIngredients(plain.originalIngredients),
        finalIngredients: normalizeIngredients(plain.finalIngredients),
        addedIngredients: normalizeIngredients(plain.addedIngredients),
        removedIngredients: normalizeIngredients(plain.removedIngredients),
        reviewedBy: plain.reviewer
          ? {
              id: plain.reviewer.id,
              fullName: plain.reviewer.fullName,
              email: plain.reviewer.email,
            }
          : null,
        reviewedAt: plain.reviewedAt,
        notes: plain.notes,
        createdAt: plain.createdAt,
        updatedAt: plain.updatedAt,
      };
    });

    const stats = await DetectionCorrection.stats();

    res.json({
      success: true,
      message: 'Feedback queue retrieved',
      data: {
        status,
        count: items.length,
        items,
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/mlops/feedback/:id/decision  body: { status, notes }
 */
export const decideFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ success: false, message: 'id khong hop le' });
      return;
    }
    const { status, notes } = req.body ?? {};
    const validStatuses = ['approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `status khong hop le. Cho phep: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const review = (req as any).user as { id?: number } | undefined;
    const reviewerId = review?.id;

    const correction = await DetectionCorrection.findByPk(id);
    if (!correction) {
      res.status(404).json({ success: false, message: 'Correction khong ton tai' });
      return;
    }

    correction.status = status;
    correction.reviewedAt = new Date();
    correction.notes = notes ?? null;
    if (reviewerId !== undefined) correction.reviewedBy = reviewerId;
    await correction.save();

    const plain = correction.get({ plain: true }) as any;
    res.json({
      success: true,
      message: `Feedback ${status}`,
      data: {
        id: plain.id,
        status: plain.status,
        reviewedAt: plain.reviewedAt,
        reviewedBy: plain.reviewedBy,
        notes: plain.notes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/mlops/feedback/export  body: { approvedOnly, maxCount, tag }
 */
export const exportFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const approvedOnly = req.body?.approvedOnly !== false;
    const maxCount = Math.min(parseInt(req.body?.maxCount ?? '500', 10), 5000);
    const tag = req.body?.tag as string | undefined;

    const result = await exportCorrectionsAsYolo({ approvedOnly, maxCount, tag });
    res.json({
      success: true,
      message: 'Feedback exported',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/mlops/feedback/sync  body: { limit }
 */
export const syncFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await syncCorrectionsFromHistory();
    res.json({
      success: true,
      message: 'Corrections synced',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/mlops/release-to-pipeline
 *
 * Multi-step:
 *  1) Neu PIPELINE_TRIGGER_CMD hoac GITHUB_TOKEN set: goi gh CLI hoac W&B promote -> trigger pipeline
 *  2) Neu AWS_PIPELINE_NAME set: goi boto3 start_pipeline_execution (qua mlops.serving.promotion)
 *  3) Tra ve execution_id va huong dan admin approve trong console.
 */
export const releaseToPipeline = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const pipelineName = process.env.CODE_PIPELINE_NAME;
    const wandbEntity = process.env.WANDB_ENTITY;
    const wandbProject = process.env.WANDB_PROJECT || 'ingredient-detection';
    const artifactName = process.env.WANDB_MODEL_ARTIFACT || 'ingredient-detector';
    const awsRegion = process.env.AWS_REGION || 'us-east-1';

    if (!pipelineName) {
      res.status(503).json({
        success: false,
        message:
          'CODE_PIPELINE_NAME chua duoc set. Vui long cau hinh env truoc khi release.',
      });
      return;
    }

    // Lazy imports de tranh crash khi missing dev dep
    let promoteAndDeploy: (
      entity: string,
      project: string,
      artifact: string,
      pipeline: string,
      region: string
    ) => Promise<{ wandb_promoted: string; pipeline_execution_id: string }>;

    try {
      // Goi truc tiep boto3 thay vi import Python module de tranh phu thuoc
      // TypeScript vao file Python. Logic giong nhu mlops/serving/promotion.py.
      const { spawn } = await import('child_process');
      const pythonCode = [
        'import sys',
        'from mlops.serving.promotion import _trigger_code_pipeline, _promote_wandb',
        'try:',
        `    if "${wandbEntity}":`,
        '        _promote_wandb("' + wandbEntity + '", "' + wandbProject + '", "' + artifactName + '")',
        '        promoted = f"' + wandbEntity + '/' + wandbProject + '/' + artifactName + ':candidate->production"',
        '    else:',
        '        promoted = "skipped (no entity)"',
        'except Exception as e:',
        '    promoted = f"skipped ({e})"',
        `exec_id = _trigger_code_pipeline("${pipelineName}", "${awsRegion}")`,
        'print(f"{promoted}::{exec_id}")',
      ].join('; ');
      promoteAndDeploy = async () => {
        return new Promise<any>((resolve, reject) => {
          const child = (require('child_process') as typeof import('child_process')).spawn(
            'python',
            ['-c', pythonCode],
            { cwd: process.cwd(), env: process.env }
          );
          let stdout = '';
          let stderr = '';
          child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
          child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
          child.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`python exit ${code}: ${stderr}`));
              return;
            }
            const [promoted, execId] = stdout.trim().split('::');
            resolve({
              wandb_promoted: promoted,
              pipeline_execution_id: execId,
            });
          });
        });
      };
    } catch (importErr) {
      promoteAndDeploy = async () => {
        throw importErr;
      };
    }

    if (!wandbEntity) {
      // Khong co W&B entity, chi trigger pipeline
      const result = await promoteAndDeploy(
        '',
        wandbProject,
        artifactName,
        pipelineName,
        awsRegion
      );
      res.json({
        success: true,
        message: 'Pipeline triggered (khong thuc hien W&B promote)',
        data: {
          pipelineName,
          executionId: result.pipeline_execution_id,
          approvalRequired: true,
        },
      });
      return;
    }

    const result = await promoteAndDeploy(
      wandbEntity,
      wandbProject,
      artifactName,
      pipelineName,
      awsRegion
    );

    res.json({
      success: true,
      message: 'W&B alias updated va pipeline triggered',
      data: {
        pipelineName,
        executionId: result.pipeline_execution_id,
        wandbPromoted: result.wandb_promoted,
        approvalRequired: true,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/mlops/feedback/stats
 */
export const getFeedbackStats = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await DetectionCorrection.stats();
    res.json({
      success: true,
      message: 'Feedback stats retrieved',
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
