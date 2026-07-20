/**
 * Model Registry Service
 * 
 * Quản lý model registry không qua W&B.
 * Models được lưu trong mlops/artifacts/model/
 * Metadata trong manifest.json
 * 
 * Registry endpoint: /api/admin/models/*
 */
import path from 'path';
import fs from 'fs';
import { readFile, writeFile, readdir, stat, copyFile, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';

const REGISTRY_DIR = path.join(process.cwd(), 'mlops', 'artifacts', 'model');
const MANIFEST_PATH = path.join(REGISTRY_DIR, 'manifest.json');

export interface ModelVersion {
  version: string;
  filename: string;
  createdAt: string;
  trainedAt: string;
  metrics: {
    precision?: number;
    recall?: number;
    mAP50?: number;
    mAP50_95?: number;
  };
  aliases: string[];
  sha256: string;
  size: number;
  notes?: string;
  baseModel?: string;
  classes?: number;
}

export interface ModelRegistry {
  active_model: string;
  models: Record<string, ModelVersion>;
  createdAt: string;
  updatedAt: string;
}

function ensureRegistryDir(): void {
  if (!existsSync(REGISTRY_DIR)) {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true });
  }
}

async function loadManifest(): Promise<ModelRegistry> {
  ensureRegistryDir();
  
  if (!existsSync(MANIFEST_PATH)) {
    const initial: ModelRegistry = {
      active_model: '',
      models: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await writeFile(MANIFEST_PATH, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
  
  const content = await readFile(MANIFEST_PATH, 'utf-8');
  return JSON.parse(content);
}

async function saveManifest(registry: ModelRegistry): Promise<void> {
  ensureRegistryDir();
  registry.updatedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, JSON.stringify(registry, null, 2), 'utf-8');
}

function calculateSHA256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ====================================================================
// Public API
// ====================================================================

/**
 * Liệt kê tất cả models trong registry
 */
export async function listModels(): Promise<{
  active: string;
  models: Array<ModelVersion & { exists: boolean; filePath: string }>;
}> {
  const manifest = await loadManifest();
  const files = existsSync(REGISTRY_DIR) 
    ? await readdir(REGISTRY_DIR) 
    : [];
  
  const models = Object.entries(manifest.models).map(([version, model]) => {
    const filePath = path.join(REGISTRY_DIR, model.filename);
    return {
      ...model,
      exists: existsSync(filePath),
      filePath: model.filename,
    };
  });
  
  // Sort by creation date descending
  models.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  return {
    active: manifest.active_model,
    models,
  };
}

/**
 * Lấy thông tin chi tiết một model version
 */
export async function getModel(version: string): Promise<ModelVersion | null> {
  const manifest = await loadManifest();
  const model = manifest.models[version];
  
  if (!model) return null;
  
  const filePath = path.join(REGISTRY_DIR, model.filename);
  return {
    ...model,
    exists: existsSync(filePath),
    filePath: model.filename,
  };
}

/**
 * Upload model file và thêm vào registry
 */
export async function uploadModel(params: {
  filePath: string;
  version: string;
  alias?: string;
  notes?: string;
  baseModel?: string;
  classes?: number;
}): Promise<ModelVersion> {
  const manifest = await loadManifest();
  const { filePath, version, alias, notes, baseModel, classes } = params;
  
  // Check if file exists
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Check if version already exists
  if (manifest.models[version]) {
    throw new Error(`Version ${version} already exists in registry`);
  }
  
  // Generate filename
  const ext = path.extname(filePath);
  const dateStr = formatDate(new Date());
  const filename = `${version}-${dateStr}${ext}`;
  const destPath = path.join(REGISTRY_DIR, filename);
  
  // Copy file to registry
  await mkdir(REGISTRY_DIR, { recursive: true });
  await copyFile(filePath, destPath);
  
  // Calculate hash
  const sha256 = await calculateSHA256(destPath);
  const stats = await stat(destPath);
  
  // Create model entry
  const model: ModelVersion = {
    version,
    filename,
    createdAt: new Date().toISOString(),
    trainedAt: new Date().toISOString(),
    metrics: {},
    aliases: alias ? [alias] : [version],
    sha256,
    size: stats.size,
    notes,
    baseModel,
    classes,
  };
  
  manifest.models[version] = model;
  
  // Set as active if first model
  if (!manifest.active_model) {
    manifest.active_model = version;
  }
  
  await saveManifest(manifest);
  
  return {
    ...model,
    exists: true,
    filePath: filename,
  };
}

/**
 * Cập nhật thông tin model (metrics, aliases, notes)
 */
export async function updateModel(version: string, updates: Partial<ModelVersion>): Promise<ModelVersion> {
  const manifest = await loadManifest();
  
  if (!manifest.models[version]) {
    throw new Error(`Model ${version} not found`);
  }
  
  // Don't allow updating certain fields
  const { version: _v, filename: _f, createdAt: _c, sha256: _s, size: _sz, ...allowedUpdates } = updates;
  
  manifest.models[version] = {
    ...manifest.models[version],
    ...allowedUpdates,
  };
  
  await saveManifest(manifest);
  
  return manifest.models[version];
}

/**
 * Thêm alias cho model
 */
export async function addAlias(version: string, alias: string): Promise<void> {
  const manifest = await loadManifest();
  
  if (!manifest.models[version]) {
    throw new Error(`Model ${version} not found`);
  }
  
  if (!manifest.models[version].aliases.includes(alias)) {
    manifest.models[version].aliases.push(alias);
    await saveManifest(manifest);
  }
}

/**
 * Xóa alias khỏi model
 */
export async function removeAlias(version: string, alias: string): Promise<void> {
  const manifest = await loadManifest();
  
  if (!manifest.models[version]) {
    throw new Error(`Model ${version} not found`);
  }
  
  manifest.models[version].aliases = manifest.models[version].aliases.filter(a => a !== alias);
  await saveManifest(manifest);
}

/**
 * Đặt model làm active (production)
 */
export async function setActiveModel(version: string): Promise<void> {
  const manifest = await loadManifest();
  
  if (!manifest.models[version]) {
    throw new Error(`Model ${version} not found`);
  }
  
  manifest.active_model = version;
  
  // Make sure 'production' alias is set
  if (!manifest.models[version].aliases.includes('production')) {
    manifest.models[version].aliases.push('production');
  }
  
  await saveManifest(manifest);
}

/**
 * Xóa model khỏi registry (không xóa file)
 */
export async function deleteModel(version: string): Promise<void> {
  const manifest = await loadManifest();
  
  if (!manifest.models[version]) {
    throw new Error(`Model ${version} not found`);
  }
  
  // Don't allow deleting active model
  if (manifest.active_model === version) {
    throw new Error(`Cannot delete active model. Set another model as active first.`);
  }
  
  delete manifest.models[version];
  await saveManifest(manifest);
}

/**
 * Lấy đường dẫn file của model active
 */
export async function getActiveModelPath(): Promise<string | null> {
  const manifest = await loadManifest();
  
  if (!manifest.active_model || !manifest.models[manifest.active_model]) {
    return null;
  }
  
  return path.join(REGISTRY_DIR, manifest.models[manifest.active_model].filename);
}

/**
 * Lấy thông tin model active
 */
export async function getActiveModel(): Promise<ModelVersion | null> {
  const manifest = await loadManifest();
  
  if (!manifest.active_model) {
    return null;
  }
  
  return manifest.models[manifest.active_model] || null;
}
