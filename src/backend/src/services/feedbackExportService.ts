import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { DetectionHistory, DetectionCorrection } from '../models';

// Resolve DEFAULT_EXPORT_ROOT tu thu muc lam viec thay vi __dirname vi
// `dist/services/feedbackExportService.js` trong container prod co __dirname = /app/dist/services,
// khong phu hop de ghi ra `mlops/`. Dung process.cwd() (=/app) cho path on dinh giua dev/prod.
function resolveDefaultExportRoot(): string {
  const cwd = process.cwd();
  // Skip parent nếu cwd là root (tránh mkdir '/mlops' trong container)
  if (cwd === '/' || cwd === os.homedir()) {
    return path.join(os.tmpdir(), 'cooksmart-mlops', 'data', 'corrections');
  }
  return path.resolve(cwd, 'mlops', 'data', 'corrections');
}

const DEFAULT_EXPORT_ROOT = resolveDefaultExportRoot();

function difference<T>(source: T[], target: T[]): T[] {
  const set = new Set(target);
  return source.filter((item) => !set.has(item));
}

function intersection<T>(source: T[], target: T[]): T[] {
  const set = new Set(target);
  return source.filter((item) => set.has(item));
}

export interface ExportOptions {
  /**
   * Chi export cac correction da approved (default true). Neu false, export toan bo.
   */
  approvedOnly?: boolean;
  /**
   * Gioi han so correction de tranh increment qua lon.
   */
  maxCount?: number;
  /**
   * Override thu muc output root.
   */
  exportRoot?: string;
  /**
   * Tag them vao ten thu muc (vd: 'production-tuning-2026-07').
   */
  tag?: string;
}

export interface ExportResult {
  directory: string;
  exported: number;
  needsBboxReannotation: number;
  classesWritten: number;
  manifest: Array<{
    imageHash: string;
    labels: string[];
    source: 'history' | 'correction';
    detectionHistoryId: number;
    correctionId?: number;
  }>;
}

/**
 * Lookup class id (integer) tu danh sach class name trong YOLO data.yaml.
 * Neu class khong ton tai, gan -1 va canh bao trong manifest.
 */
async function buildClassIndex(): Promise<Map<string, number>> {
  const yamlPath = path.resolve(
    __dirname,
    '../../../../mlops/data/yolo_dataset/data.yaml'
  );
  try {
    const text = await fs.readFile(yamlPath, 'utf-8');
    const lines = text.split(/\r?\n/);
    const index = new Map<string, number>();
    let inNames = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'names:') {
        inNames = true;
        continue;
      }
      if (inNames) {
        const match = trimmed.match(/^(\d+):\s*(.+)$/);
        if (match) {
          const [, idStr, name] = match;
          index.set(name.trim(), parseInt(idStr, 10));
        } else if (trimmed && !trimmed.startsWith('#')) {
          // Thoat khoi block
          break;
        }
      }
    }
    return index;
  } catch {
    return new Map();
  }
}

/**
 * Ghi mot placeholder YOLO label file (full image bbox) cho 1 entry.
 * Tra ve true neu thanh cong.
 */
async function writeLabelFile(
  labelsDir: string,
  imageHash: string,
  classNames: string[],
  classIndex: Map<string, number>
): Promise<{ written: number; needsBboxReannotation: boolean }> {
  let needsBbox = false;
  const lines = classNames.map((name, idx) => {
    const classId = classIndex.get(name);
    if (classId === undefined) {
      needsBbox = true;
      return `${idx} 0.5 0.5 0.99 0.99 ${name}`;
    }
    return `${classId} 0.5 0.5 0.99 0.99 ${name}`;
  });
  await fs.writeFile(path.join(labelsDir, `${imageHash}.txt`), lines.join('\n'), 'utf-8');
  return { written: classNames.length, needsBboxReannotation: classIndex.size === 0 };
}

/**
 * Export cac correction da duoc admin duyet ra DVC-tracked subset.
 */
export async function exportCorrectionsAsYolo(
  options: ExportOptions = {}
): Promise<ExportResult> {
  const approvedOnly = options.approvedOnly !== false;
  const maxCount = options.maxCount ?? 500;
  const root = options.exportRoot ?? process.env.FEEDBACK_EXPORT_ROOT ?? DEFAULT_EXPORT_ROOT;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tag = options.tag ? `_${options.tag}` : '';
  const outDir = path.join(root, `V_inc_${stamp}${tag}`);
  const labelsDir = path.join(outDir, 'labels');
  await fs.mkdir(labelsDir, { recursive: true });

  const classIndex = await buildClassIndex();

  // Lay cac correction theo trang thai
  const corrections = approvedOnly
    ? await DetectionCorrection.findAll({
        where: { status: 'approved' },
        order: [['reviewedAt', 'DESC']],
        limit: maxCount,
      })
    : await DetectionCorrection.findAll({
        order: [['createdAt', 'DESC']],
        limit: maxCount,
      });

  const manifest: ExportResult['manifest'] = [];
  let needsBboxTotal = 0;
  let writtenTotal = 0;
  for (const corr of corrections) {
    const plain = corr.get({ plain: true }) as any;
    const finalLabels: string[] = Array.isArray(plain.finalIngredients)
      ? plain.finalIngredients
      : [];
    if (finalLabels.length === 0) continue;
    const { written, needsBboxReannotation } = await writeLabelFile(
      labelsDir,
      plain.imageHash,
      finalLabels,
      classIndex
    );
    writtenTotal += written;
    if (needsBboxReannotation) needsBboxTotal += 1;
    manifest.push({
      imageHash: plain.imageHash,
      labels: finalLabels,
      source: 'correction',
      detectionHistoryId: plain.detectionHistoryId,
      correctionId: plain.id,
    });
  }

  // Fallback: lay them cac detection chua tao correction (truong hop admin bo review)
  if (manifest.length < maxCount) {
    const used = new Set(manifest.map((m) => m.imageHash));
    const remaining = maxCount - manifest.length;
    const histories = await DetectionHistory.findAll({
      where: { wasModified: true },
      order: [['createdAt', 'DESC']],
      limit: remaining + used.size,
    });
    for (const hist of histories) {
      const plain = hist.get({ plain: true }) as any;
      const hash = plain.imageHash;
      if (used.has(hash)) continue;
      const labels: string[] = Array.isArray(plain.finalIngredients)
        ? plain.finalIngredients
        : [];
      if (labels.length === 0) continue;
      const { written, needsBboxReannotation } = await writeLabelFile(
        labelsDir,
        hash,
        labels,
        classIndex
      );
      writtenTotal += written;
      if (needsBboxReannotation) needsBboxTotal += 1;
      manifest.push({
        imageHash: hash,
        labels,
        source: 'history',
        detectionHistoryId: plain.id,
      });
      used.add(hash);
      if (manifest.length >= maxCount) break;
    }
  }

  // Summary
  const uniqueClasses = new Set(manifest.flatMap((m) => m.labels));
  await fs.writeFile(
    path.join(outDir, 'classes.txt'),
    Array.from(uniqueClasses).join('\n'),
    'utf-8'
  );
  await fs.writeFile(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        approvedOnly,
        count: manifest.length,
        uniqueClasses: uniqueClasses.size,
        needsBboxReannotation: needsBboxTotal > 0,
        entries: manifest,
      },
      null,
      2
    ),
    'utf-8'
  );
  await fs.writeFile(
    path.join(outDir, 'README.md'),
    [
      `# Feedback dataset increment`,
      ``,
      `* Exported at: ${new Date().toISOString()}`,
      `* Source: ${approvedOnly ? 'approved corrections only' : 'all corrections'}`,
      `* Count: ${manifest.length}`,
      `* Unique classes: ${uniqueClasses.size}`,
      ``,
      `## Hoàn thiện để DVC track`,
      ``,
      `\`\`\`bash`,
      `cd ${outDir}`,
      `mkdir -p ../corrections_parent`,
      `cp -r labels manifest.json classes.txt ../corrections_parent/`,
      `dvc add ../corrections_parent/labels ../corrections_parent/classes.txt`,
      `git add ../corrections_parent.dvc .gitignore`,
      `git commit -m "Add feedback increment ${stamp}${tag}"`,
      `dvc push`,
      `\`\`\``,
    ].join('\n'),
    'utf-8'
  );

  return {
    directory: outDir,
    exported: manifest.length,
    needsBboxReannotation: needsBboxTotal,
    classesWritten: uniqueClasses.size,
    manifest,
  };
}

/**
 * Tu dong tao correction cho detection chua co (admin co the xu ly trong UI).
 */
export async function syncCorrectionsFromHistory(): Promise<{ created: number; skipped: number }> {
  // Lay cac history modified chua co correction record
  const [histories] = await Promise.all([
    DetectionHistory.findAll({
      where: { wasModified: true },
      order: [['createdAt', 'DESC']],
      limit: 200,
    }),
    Promise.resolve(),
  ]);

  let created = 0;
  let skipped = 0;
  for (const h of histories) {
    const plain = h.get({ plain: true }) as any;
    const existing = await DetectionCorrection.findOne({
      where: { detectionHistoryId: plain.id },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const final: string[] = Array.isArray(plain.finalIngredients)
      ? (plain.finalIngredients as string[])
      : [];
    const original: string[] = Array.isArray(plain.originalIngredients)
      ? (plain.originalIngredients as string[])
      : [];
    await DetectionCorrection.create({
      detectionHistoryId: plain.id,
      status: 'pending',
      imageHash: plain.imageHash,
      originalIngredients: original,
      finalIngredients: final,
      addedIngredients: difference(final, original),
      removedIngredients: difference(original, final),
    });
    created += 1;
  }
  return { created, skipped };
}

export { difference, intersection };
