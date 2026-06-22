import { NextFunction, Request, Response } from 'express';
import { Op } from 'sequelize';
import { DetectionHistory, User } from '../models';
import { YOLO_LABEL_MAPPING } from '../config/yoloLabelMapping';
import { yoloService } from '../services/yoloService';

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
