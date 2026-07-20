import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleOff,
  Clock3,
  Database,
  ExternalLink,
  GitCommitHorizontal,
  Layers3,
  Link as LinkIcon,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Trash2,
  Upload,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/templates/AdminLayout';
import adminService, { MlopsOverview, RegistryOverview, RegistryModel } from '../services/adminService';
type ViewMode = 'overview' | 'feedback' | 'classes' | 'registry';

const metricLabels: Record<string, string> = {
  'metrics/precision(B)': 'Precision',
  'metrics/recall(B)': 'Recall',
  'metrics/mAP50(B)': 'mAP@50',
  'metrics/mAP50-95(B)': 'mAP@50-95',
};

const formatDate = (value: string | null) => {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const shortValue = (value: string | null, length = 12) => {
  if (!value) return 'Chưa có';
  return value.length > length ? `${value.slice(0, length)}...` : value;
};

const toneToBadge = (tone: 'green' | 'red' | 'blue' | 'amber') => {
  switch (tone) {
    case 'green':
      return { bg: 'var(--admin-success-bg)', color: 'var(--admin-success)' };
    case 'red':
      return { bg: 'var(--admin-danger-bg)', color: 'var(--admin-danger)' };
    case 'blue':
      return { bg: 'var(--admin-info-bg)', color: 'var(--admin-info)' };
    case 'amber':
      return { bg: 'var(--admin-warning-bg)', color: 'var(--admin-warning)' };
  }
};

const AdminMlops: React.FC = () => {
  const [data, setData] = useState<MlopsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('overview');
  const [classSearch, setClassSearch] = useState('');

  // Model Registry state
  const [registryData, setRegistryData] = useState<RegistryOverview | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Confidence threshold (admin-tunable at runtime)
  const [thresholdDraft, setThresholdDraft] = useState<number | null>(null);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [thresholdNotice, setThresholdNotice] = useState<string | null>(null);

  const loadData = useCallback(async (refresh = false) => {
    try {
      refresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      setData(await adminService.getMlopsOverview());
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải trạng thái MLOps.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadRegistry = useCallback(async () => {
    setRegistryLoading(true);
    setRegistryError(null);
    try {
      setRegistryData(await adminService.getModelRegistry());
    } catch (err: any) {
      setRegistryError(err.response?.data?.message || 'Không thể tải model registry.');
    } finally {
      setRegistryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load registry when switching to registry tab
  useEffect(() => {
    if (view === 'registry' && !registryData) {
      loadRegistry();
    }
  }, [view, registryData, loadRegistry]);

  // Keep the slider in sync with the live threshold (skip while user is editing).
  useEffect(() => {
    if (data?.service.confidenceThreshold != null && !thresholdSaving) {
      setThresholdDraft(data.service.confidenceThreshold);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.service.confidenceThreshold]);

  const handleSaveThreshold = useCallback(async () => {
    if (thresholdDraft == null) return;
    const value = Math.max(0, Math.min(1, thresholdDraft));
    setThresholdSaving(true);
    setThresholdError(null);
    setThresholdNotice(null);
    try {
      const response = await adminService.updateConfidenceThreshold(value);
      const updated = response?.data ?? response;
      setThresholdNotice(
        `Đã lưu ngưỡng ${updated.confidence_threshold.toFixed(2)} trên YOLO service.`
      );
      // Reload to pull fresh `service.confidenceThreshold`.
      await loadData(true);
    } catch (err: any) {
      setThresholdError(
        err.response?.data?.message || 'Không thể cập nhật ngưỡng trên YOLO service.'
      );
    } finally {
      setThresholdSaving(false);
    }
  }, [thresholdDraft, loadData]);

  const handleResetThreshold = useCallback(async () => {
    if (!data || data.service.confidenceThreshold == null) return;
    setThresholdSaving(true);
    setThresholdError(null);
    setThresholdNotice(null);
    try {
      // Push the current effective value back through the API to refresh the
      // server's persisted state. There is no separate "default" endpoint, so
      // we round to the same value.
      const value = data.service.confidenceThreshold;
      await adminService.updateConfidenceThreshold(value);
      setThresholdNotice('Đã đồng bộ lại ngưỡng với YOLO service.');
      await loadData(true);
    } catch (err: any) {
      setThresholdError(
        err.response?.data?.message || 'Không thể đồng bộ ngưỡng.'
      );
    } finally {
      setThresholdSaving(false);
    }
  }, [data, loadData]);

  // Model Registry handlers
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    setUploadProgress(`Đang upload ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('model', file);
      formData.append('version', `v${Date.now()}`);
      formData.append('alias', 'candidate');

      await adminService.uploadModel(formData);
      setUploadSuccess(`Model ${file.name} đã được upload thành công!`);
      setUploadProgress(null);
      await loadRegistry();
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Upload thất bại');
      setUploadProgress(null);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }, [loadRegistry]);

  const handleSetActive = useCallback(async (version: string) => {
    try {
      await adminService.setActiveModel(version);
      await loadRegistry();
      await loadData(true);
    } catch (err: any) {
      setRegistryError(err.response?.data?.message || 'Không thể đặt model active');
    }
  }, [loadRegistry, loadData]);

  const handleDeleteModel = useCallback(async (version: string) => {
    if (!confirm(`Xóa model ${version} khỏi registry?`)) return;

    try {
      await adminService.deleteModel(version);
      await loadRegistry();
    } catch (err: any) {
      setRegistryError(err.response?.data?.message || 'Không thể xóa model');
    }
  }, [loadRegistry]);

  const metrics = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.model.metrics)
      .filter(([key]) => key in metricLabels)
      .map(([key, value]) => ({
        key,
        label: metricLabels[key],
        value,
      }));
  }, [data]);

  const filteredClassMappings = useMemo(() => {
    if (!data) return [];
    const query = classSearch.trim().toLowerCase();
    if (!query) return data.schema.classMappings;
    return data.schema.classMappings.filter((mapping) => {
      const haystack = [mapping.yoloLabel, mapping.vietnameseName ?? '', mapping.category ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [data, classSearch]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="admin-loading" style={{ minHeight: 420 }}>
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
          <span>Đang đọc trạng thái model...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-[1500px]">
        <div className="admin-page-header">
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
            <span
              className="text-xs font-bold uppercase"
              style={{ letterSpacing: '0.06em', color: 'var(--admin-accent)' }}
            >
              Ingredient Detection
            </span>
          </div>
          <h1 className="admin-page-title">Vận hành MLOps</h1>
          <p className="admin-page-subtitle">Theo dõi model production, schema lớp và phản hồi nhận diện.</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <Link
              to="/admin/mlops/feedback"
              style={{
                height: 36,
                padding: '0 14px',
                background: 'var(--admin-surface)',
                color: 'var(--admin-text)',
                border: '1px solid var(--admin-border-strong)',
                borderRadius: 'var(--admin-radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                textDecoration: 'none',
              }}
            >
              <LinkIcon className="h-4 w-4" strokeWidth={2} />
              Mở feedback queue
            </Link>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              style={{
                height: 36,
                padding: '0 14px',
                background: 'var(--admin-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--admin-radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={2} />
              Làm mới
            </button>
            {data?.monitoring?.grafanaUrl && (
              <a
                href={data.monitoring.grafanaUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  height: 36,
                  padding: '0 14px',
                  background: 'var(--admin-surface)',
                  color: 'var(--admin-text)',
                  border: '1px solid var(--admin-border-strong)',
                  borderRadius: 'var(--admin-radius-sm)',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  textDecoration: 'none',
                }}
              >
                Mở Grafana <ExternalLink className="h-4 w-4" strokeWidth={2} />
              </a>
            )}
          </div>
        </div>

        {error && (
          <div className="admin-alert admin-alert-danger">
            <XCircle className="h-4 w-4" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <>
            {/* Status cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatusCard
                label="Dịch vụ inference"
                value={data.service.available ? 'Sẵn sàng' : 'Gián đoạn'}
                icon={data.service.available ? CheckCircle2 : CircleOff}
                tone={data.service.available ? 'green' : 'red'}
              />
              <StatusCard
                label="Nguồn model"
                value={data.model.source === 'wandb' ? 'W&B Registry' : 'Checkpoint cục bộ'}
                icon={Database}
                tone={data.model.source === 'wandb' ? 'blue' : 'amber'}
              />
              <StatusCard
                label="Schema nhận diện"
                value={data.schema.compatible ? 'Đồng bộ' : 'Lệch schema'}
                icon={ShieldCheck}
                tone={data.schema.compatible ? 'green' : 'red'}
              />
              <StatusCard
                label="Phản hồi đã sửa"
                value={`${(data.feedback.modificationRate * 100).toFixed(1)}%`}
                detail={`${data.feedback.modified}/${data.feedback.total} lượt`}
                icon={UserRoundCheck}
                tone={data.feedback.modificationRate > 0.2 ? 'amber' : 'blue'}
              />
            </div>

            {data.warnings.length > 0 && (
              <div className="admin-alert admin-alert-warning">
                <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                <div>
                  <strong>Cần chú ý:</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    {data.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="admin-card">
              <div className="admin-tabs" style={{ padding: '0 12px' }}>
                <button
                  type="button"
                  onClick={() => setView('overview')}
                  className={`admin-tab ${view === 'overview' ? 'active' : ''}`}
                >
                  <Activity className="w-4 h-4" strokeWidth={2} />
                  Tổng quan
                </button>
                <button
                  type="button"
                  onClick={() => setView('feedback')}
                  className={`admin-tab ${view === 'feedback' ? 'active' : ''}`}
                >
                  <UserRoundCheck className="w-4 h-4" strokeWidth={2} />
                  Phản hồi
                </button>
                <button
                  type="button"
                  onClick={() => setView('classes')}
                  className={`admin-tab ${view === 'classes' ? 'active' : ''}`}
                >
                  <Layers3 className="w-4 h-4" strokeWidth={2} />
                  Lớp nhận diện
                </button>
                <button
                  type="button"
                  onClick={() => setView('registry')}
                  className={`admin-tab ${view === 'registry' ? 'active' : ''}`}
                >
                  <Package className="w-4 h-4" strokeWidth={2} />
                  Model Registry
                </button>
              </div>
            </div>

            {view === 'overview' && (
              <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">
                      <Server className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                      Model đang phục vụ
                    </h2>
                  </div>
                  <div className="admin-card-body">
                    <div className="admin-info-grid">
                      <InfoCell label="Artifact" value={data.model.artifact || 'Không dùng registry'} />
                      <InfoCell label="Phiên bản" value={data.model.artifactVersion || 'N/A'} />
                      <InfoCell label="Base model" value={data.model.baseModel || 'Chưa ghi nhận'} />
                      <InfoCell
                        label="Số lớp"
                        value={`${data.model.classCount}/${data.schema.mappedClassCount}`}
                      />
                      <ThresholdControl
                        value={data.service.confidenceThreshold}
                        draft={thresholdDraft}
                        onDraftChange={setThresholdDraft}
                        onSave={handleSaveThreshold}
                        onRefresh={handleResetThreshold}
                        saving={thresholdSaving}
                        notice={thresholdNotice}
                        error={thresholdError}
                        available={data.service.available}
                      />
                      <InfoCell label="Cập nhật service" value={formatDate(data.service.timestamp)} />
                      <InfoCell label="Git revision" value={shortValue(data.model.gitRevision)} mono />
                      <InfoCell label="SHA-256" value={shortValue(data.model.sha256)} mono />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {data.model.runUrl && (
                        <a
                          href={data.model.runUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            height: 36,
                            padding: '0 14px',
                            background: 'var(--admin-surface)',
                            color: 'var(--admin-text)',
                            border: '1px solid var(--admin-border-strong)',
                            borderRadius: 'var(--admin-radius-sm)',
                            fontSize: 13,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            textDecoration: 'none',
                          }}
                        >
                          Mở W&B run <ExternalLink className="h-4 w-4" strokeWidth={2} />
                        </a>
                      )}
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          height: 36,
                          padding: '0 14px',
                          borderRadius: 'var(--admin-radius-sm)',
                          background: 'var(--admin-surface-alt)',
                          color: 'var(--admin-text-secondary)',
                          fontSize: 13,
                          fontWeight: 500,
                        }}
                      >
                        <GitCommitHorizontal className="h-4 w-4" strokeWidth={2} />
                        Tạo model: {formatDate(data.model.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">
                      <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                      Chỉ số đánh giá
                    </h2>
                  </div>
                  <div className="admin-card-body">
                    {metrics.length > 0 ? (
                      <div className="admin-info-grid">
                        {metrics.map((metric) => (
                          <div key={metric.key} className="admin-info-cell">
                            <p className="admin-info-label">{metric.label}</p>
                            <p className="admin-info-value tabular-nums">
                              {(metric.value * 100).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="admin-empty">Checkpoint hiện tại chưa có metrics trong manifest.</div>
                    )}
                    <div className="admin-info-grid mt-3">
                      <InfoCell label="Phản hồi 24 giờ" value={String(data.feedback.last24Hours)} />
                      <InfoCell label="MLOps registry" value={data.service.mlopsEnabled ? 'Đang bật' : 'Đang tắt'} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'feedback' && (
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2 className="admin-card-title">
                    <UserRoundCheck className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                    Phản hồi cần học lại ({data.feedback.recent.length})
                  </h2>
                </div>
                {data.feedback.recent.length === 0 ? (
                  <div className="admin-empty">Chưa có lượt nhận diện nào được người dùng chỉnh sửa.</div>
                ) : (
                  <ul>
                    {data.feedback.recent.map((item) => (
                      <li
                        key={item.id}
                        style={{
                          borderTop: '1px solid var(--admin-border)',
                          padding: 16,
                          display: 'grid',
                          gap: 16,
                          gridTemplateColumns: '1fr',
                        }}
                        className="lg:!grid-cols-[180px_1fr_1fr]"
                      >
                        <div>
                          <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-text-muted)' }}>
                            #{item.id} · {shortValue(item.imageHash, 16)}
                          </p>
                          <p
                            className="mt-2 flex items-center gap-1.5 text-xs"
                            style={{ color: 'var(--admin-text-secondary)' }}
                          >
                            <Clock3 className="h-3.5 w-3.5" strokeWidth={2} />
                            {formatDate(item.createdAt)}
                          </p>
                          <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
                            {item.submitter?.fullName || 'Người dùng ẩn danh'}
                          </p>
                        </div>
                        <IngredientDiff label="Model dự đoán" items={item.originalIngredients} tone="neutral" />
                        <IngredientDiff
                          label="Người dùng xác nhận"
                          items={item.finalIngredients}
                          added={item.addedIngredients}
                          removed={item.removedIngredients}
                          tone="final"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {view === 'classes' && (
              <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">
                      <Layers3 className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                      Bảng mapping lớp YOLO → nguyên liệu
                    </h2>
                    <input
                      type="search"
                      placeholder="Tìm theo YOLO label hoặc tên VN..."
                      value={classSearch}
                      onChange={(event) => setClassSearch(event.target.value)}
                      style={{ height: 36, padding: '0 12px', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border-strong)', background: 'var(--admin-surface)', color: 'var(--admin-text)', fontSize: 13, width: 240 }}
                    />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: 60 }}>#</th>
                          <th>YOLO label</th>
                          <th>Tên nguyên liệu (database)</th>
                          <th>Danh mục</th>
                          <th>Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClassMappings.map((mapping, index) => (
                          <tr key={mapping.yoloLabel}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-text-muted)' }}>
                              {index}
                            </td>
                            <td>
                              <span
                                style={{
                                  fontFamily: 'monospace',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: 'var(--admin-text)',
                                }}
                              >
                                {mapping.yoloLabel}
                              </span>
                            </td>
                            <td
                              className="text-sm font-semibold"
                              style={{ color: 'var(--admin-text)' }}
                            >
                              {mapping.vietnameseName ?? (
                                <span style={{ fontStyle: 'italic', color: 'var(--admin-text-muted)', fontWeight: 400 }}>
                                  — chưa ánh xạ —
                                </span>
                              )}
                            </td>
                            <td className="text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
                              {mapping.category ?? (
                                <span style={{ fontStyle: 'italic', color: 'var(--admin-text-muted)' }}>—</span>
                              )}
                            </td>
                            <td>
                              <span
                                className={`admin-badge ${
                                  mapping.isMapped ? 'admin-badge-success' : 'admin-badge-danger'
                                }`}
                              >
                                {mapping.isMapped ? 'Đã map' : 'Thiếu map'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredClassMappings.length === 0 && (
                    <div className="admin-empty">
                      {classSearch
                        ? `Không tìm thấy lớp nào khớp với "${classSearch}".`
                        : 'Không đọc được danh sách lớp từ model.'}
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderTop: '1px solid var(--admin-border)',
                      padding: '12px 16px',
                      fontSize: 12,
                      color: 'var(--admin-text-muted)',
                    }}
                  >
                    <span>
                      Hiển thị {filteredClassMappings.length}/{data.schema.classMappings.length} lớp
                    </span>
                    <span>
                      Đã map: {data.schema.classMappings.filter((m) => m.isMapped).length} · Thiếu:{' '}
                      {data.schema.classMappings.filter((m) => !m.isMapped).length}
                    </span>
                  </div>
                </div>
                <aside className="space-y-3">
                  <SchemaList title="Thiếu mapping" items={data.schema.missingMappings} tone="red" />
                  <SchemaList title="Mapping không dùng" items={data.schema.unusedMappings} tone="amber" />
                </aside>
              </div>
            )}

            {view === 'registry' && (
              <div className="space-y-4">
                {/* Registry Header */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">
                      <Package className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                      Model Registry
                    </h2>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="model-upload"
                        style={{
                          height: 36,
                          padding: '0 14px',
                          background: 'var(--admin-accent)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 'var(--admin-radius-sm)',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <Upload className="h-4 w-4" strokeWidth={2} />
                        Upload Model
                        <input
                          id="model-upload"
                          type="file"
                          accept=".pt"
                          onChange={handleFileUpload}
                          disabled={uploading}
                          style={{ display: 'none' }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={loadRegistry}
                        disabled={registryLoading}
                        style={{
                          height: 36,
                          padding: '0 14px',
                          background: 'var(--admin-surface)',
                          color: 'var(--admin-text)',
                          border: '1px solid var(--admin-border-strong)',
                          borderRadius: 'var(--admin-radius-sm)',
                          fontSize: 13,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <RefreshCw className={`h-4 w-4 ${registryLoading ? 'animate-spin' : ''}`} strokeWidth={2} />
                        Làm mới
                      </button>
                    </div>
                  </div>
                  <div className="admin-card-body">
                    {/* Upload status */}
                    {uploadProgress && (
                      <div className="admin-alert admin-alert-info mb-4">
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                        <span>{uploadProgress}</span>
                      </div>
                    )}
                    {uploadError && (
                      <div className="admin-alert admin-alert-danger mb-4">
                        <XCircle className="h-4 w-4" strokeWidth={2} />
                        <span>{uploadError}</span>
                      </div>
                    )}
                    {uploadSuccess && (
                      <div className="admin-alert admin-alert-success mb-4">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
                        <span>{uploadSuccess}</span>
                      </div>
                    )}
                    {registryError && (
                      <div className="admin-alert admin-alert-danger mb-4">
                        <XCircle className="h-4 w-4" strokeWidth={2} />
                        <span>{registryError}</span>
                      </div>
                    )}

                    {/* Models list */}
                    {registryLoading ? (
                      <div className="admin-loading">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
                        <span>Đang tải registry...</span>
                      </div>
                    ) : registryData ? (
                      <div className="space-y-3">
                        {registryData.models.length === 0 ? (
                          <div className="admin-empty">
                            <Package className="w-12 h-12 mb-2" style={{ color: 'var(--admin-text-muted)' }} strokeWidth={1.5} />
                            <p>Chưa có model nào trong registry.</p>
                            <p className="text-sm" style={{ color: 'var(--admin-text-secondary)' }}>
                              Upload model .pt để bắt đầu.
                            </p>
                          </div>
                        ) : (
                          registryData.models.map((model) => (
                            <div
                              key={model.version}
                              style={{
                                border: `1px solid ${registryData.active === model.version ? 'var(--admin-accent)' : 'var(--admin-border)'}`,
                                borderRadius: 'var(--admin-radius)',
                                padding: 16,
                                background: registryData.active === model.version ? 'var(--admin-surface-alt)' : 'var(--admin-surface)',
                              }}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span
                                      style={{
                                        fontFamily: 'monospace',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: 'var(--admin-text)',
                                      }}
                                    >
                                      {model.version}
                                    </span>
                                    {registryData.active === model.version && (
                                      <span
                                        style={{
                                          height: 20,
                                          padding: '0 8px',
                                          background: 'var(--admin-accent)',
                                          color: '#fff',
                                          borderRadius: 10,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        ACTIVE
                                      </span>
                                    )}
                                    {model.aliases.filter(a => a !== 'production' && a !== model.version).map((alias) => (
                                      <span
                                        key={alias}
                                        className="admin-badge admin-badge-info"
                                      >
                                        {alias}
                                      </span>
                                    ))}
                                  </div>
                                  <div
                                    className="flex flex-wrap gap-4 text-sm"
                                    style={{ color: 'var(--admin-text-secondary)' }}
                                  >
                                    <span>
                                      <strong>File:</strong> {model.filename}
                                    </span>
                                    <span>
                                      <strong>Size:</strong> {(model.size / 1024 / 1024).toFixed(2)} MB
                                    </span>
                                    <span>
                                      <strong>Created:</strong> {formatDate(model.createdAt)}
                                    </span>
                                    {model.baseModel && (
                                      <span>
                                        <strong>Base:</strong> {model.baseModel}
                                      </span>
                                    )}
                                  </div>
                                  {model.notes && (
                                    <p className="mt-2 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
                                      {model.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {registryData.active !== model.version && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetActive(model.version)}
                                      style={{
                                        height: 32,
                                        padding: '0 12px',
                                        background: 'var(--admin-success)',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 'var(--admin-radius-sm)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Star className="h-3.5 w-3.5" strokeWidth={2} />
                                      Set Active
                                    </button>
                                  )}
                                  {registryData.active !== model.version && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteModel(model.version)}
                                      style={{
                                        height: 32,
                                        padding: '0 12px',
                                        background: 'transparent',
                                        color: 'var(--admin-danger)',
                                        border: '1px solid var(--admin-danger)',
                                        borderRadius: 'var(--admin-radius-sm)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                                      Xóa
                                    </button>
                                  )}
                                </div>
                              </div>
                              {/* Metrics */}
                              {model.metrics && Object.keys(model.metrics).length > 0 && (
                                <div className="flex flex-wrap gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--admin-border)' }}>
                                  {model.metrics.precision !== undefined && (
                                    <div className="text-xs">
                                      <span style={{ color: 'var(--admin-text-muted)' }}>Precision:</span>{' '}
                                      <span className="font-semibold">{(model.metrics.precision * 100).toFixed(1)}%</span>
                                    </div>
                                  )}
                                  {model.metrics.recall !== undefined && (
                                    <div className="text-xs">
                                      <span style={{ color: 'var(--admin-text-muted)' }}>Recall:</span>{' '}
                                      <span className="font-semibold">{(model.metrics.recall * 100).toFixed(1)}%</span>
                                    </div>
                                  )}
                                  {model.metrics.mAP50 !== undefined && (
                                    <div className="text-xs">
                                      <span style={{ color: 'var(--admin-text-muted)' }}>mAP@50:</span>{' '}
                                      <span className="font-semibold">{(model.metrics.mAP50 * 100).toFixed(1)}%</span>
                                    </div>
                                  )}
                                  {model.metrics.mAP50_95 !== undefined && (
                                    <div className="text-xs">
                                      <span style={{ color: 'var(--admin-text-muted)' }}>mAP@50-95:</span>{' '}
                                      <span className="font-semibold">{(model.metrics.mAP50_95 * 100).toFixed(1)}%</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    ) : (
                      <div className="admin-empty">
                        Nhấn "Làm mới" để tải registry.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

const StatusCard = ({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ElementType;
  tone: 'green' | 'red' | 'blue' | 'amber';
}) => {
  const colors = toneToBadge(tone);
  return (
    <div className="admin-stat">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="admin-stat-label">{label}</span>
          <p className="text-base font-bold mt-1 break-words" style={{ color: 'var(--admin-text)' }}>
            {value}
          </p>
          {detail && (
            <p className="text-xs mt-1" style={{ color: 'var(--admin-text-muted)' }}>
              {detail}
            </p>
          )}
        </div>
        <span
          style={{
            background: colors.bg,
            color: colors.color,
            width: 36,
            height: 36,
            borderRadius: 10,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
    </div>
  );
};

const InfoCell = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="admin-info-cell">
    <p className="admin-info-label">{label}</p>
    <p
      className="admin-info-value"
      style={{ fontFamily: mono ? 'monospace' : undefined }}
      title={value}
    >
      {value}
    </p>
  </div>
);

const ThresholdControl = ({
  value,
  draft,
  onDraftChange,
  onSave,
  onRefresh,
  saving,
  notice,
  error,
  available,
}: {
  value: number | null;
  draft: number | null;
  onDraftChange: (next: number) => void;
  onSave: () => void;
  onRefresh: () => void;
  saving: boolean;
  notice: string | null;
  error: string | null;
  available: boolean;
}) => {
  const effective = value ?? 0.25;
  const safeDraft = draft != null ? Math.min(1, Math.max(0, draft)) : effective;
  const dirty = draft != null && Math.abs(safeDraft - effective) > 0.005;

  const handleSlider = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    onDraftChange(Number.isFinite(next) ? next : effective);
  };

  const handleNumber = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    if (Number.isFinite(next)) {
      onDraftChange(Math.min(1, Math.max(0, next)));
    }
  };

  return (
    <div className="admin-info-cell" style={{ gridColumn: '1 / -1' }}>
      <div className="flex items-center justify-between gap-3">
        <p className="admin-info-label">Ngưỡng confidence</p>
        <span
          className="text-xs tabular-nums"
          style={{ color: 'var(--admin-text-secondary)' }}
        >
          Hiện tại: {value == null ? 'Chưa có' : value.toFixed(2)}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={safeDraft}
          onChange={handleSlider}
          disabled={!available || saving}
          aria-label="Ngưỡng confidence"
          style={{
            flex: 1,
            accentColor: 'var(--admin-accent, #ff4f00)',
          }}
        />
        <input
          type="number"
          min={0}
          max={1}
          step={0.01}
          value={safeDraft.toFixed(2)}
          onChange={handleNumber}
          disabled={!available || saving}
          className="tabular-nums"
          style={{
            width: 78,
            height: 32,
            padding: '0 8px',
            borderRadius: 'var(--admin-radius-sm)',
            border: '1px solid var(--admin-border-strong)',
            background: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            fontSize: 13,
            textAlign: 'right',
          }}
          aria-label="Ngưỡng confidence (số)"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!available || saving || !dirty}
          style={{
            height: 32,
            padding: '0 14px',
            background:
              !available || saving || !dirty
                ? 'var(--admin-surface-alt)'
                : 'var(--admin-accent)',
            color: !available || saving || !dirty ? 'var(--admin-text-muted)' : '#fff',
            border: 'none',
            borderRadius: 'var(--admin-radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            cursor:
              !available || saving || !dirty ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <SaveIcon spinning={saving} />
          {saving ? 'Đang lưu...' : 'Lưu ngưỡng'}
        </button>
        <button
          type="button"
          onClick={onRefresh}
          disabled={!available || saving}
          style={{
            height: 32,
            padding: '0 12px',
            background: 'var(--admin-surface)',
            color: 'var(--admin-text)',
            border: '1px solid var(--admin-border-strong)',
            borderRadius: 'var(--admin-radius-sm)',
            fontSize: 13,
            fontWeight: 600,
            cursor: !available || saving ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} strokeWidth={2} />
          Đồng bộ lại
        </button>
        <span
          className="text-xs"
          style={{ color: 'var(--admin-text-muted)' }}
        >
          Khoảng hợp lệ: 0.00 – 1.00
        </span>
      </div>

      {!available && (
        <p
          className="text-xs mt-2"
          style={{ color: 'var(--admin-warning, #b45309)' }}
        >
          YOLO service hiện không khả dụng — không thể lưu ngưỡng.
        </p>
      )}
      {error && (
        <p
          className="text-xs mt-2"
          style={{ color: 'var(--admin-danger, #b91c1c)' }}
        >
          {error}
        </p>
      )}
      {notice && !error && (
        <p
          className="text-xs mt-2"
          style={{ color: 'var(--admin-success, #15803d)' }}
        >
          {notice}
        </p>
      )}
    </div>
  );
};

const SaveIcon = ({ spinning }: { spinning: boolean }) =>
  spinning ? (
    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
  ) : (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );

const IngredientDiff = ({
  label,
  items,
  added = [],
  removed = [],
  tone,
}: {
  label: string;
  items: string[];
  added?: string[];
  removed?: string[];
  tone: 'neutral' | 'final';
}) => (
  <div>
    <p
      className="mb-2 text-xs font-semibold"
      style={{
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--admin-text-muted)',
      }}
    >
      {label}
    </p>
    <div className="flex flex-wrap" style={{ gap: 4 }}>
      {items.map((item) => {
        const isAdded = added.includes(item);
        const isRemoved = removed.includes(item);
        const className = isAdded
          ? 'added'
          : isRemoved
          ? 'removed'
          : tone === 'final'
          ? 'final'
          : 'neutral';
        return <span key={item} className={`admin-diff-tag ${className}`}>{item}</span>;
      })}
      {items.length === 0 && (
        <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          Không có nguyên liệu
        </span>
      )}
    </div>
  </div>
);

const SchemaList = ({ title, items, tone }: { title: string; items: string[]; tone: 'red' | 'amber' }) => (
  <div className="admin-card">
    <div className="admin-card-header">
      <h3 className="text-sm font-semibold" style={{ color: 'var(--admin-text)' }}>
        {title}
      </h3>
      <span
        className={`admin-badge ${tone === 'red' ? 'admin-badge-danger' : 'admin-badge-warning'}`}
      >
        {items.length}
      </span>
    </div>
    <div className="admin-card-body">
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item}
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                color: 'var(--admin-text-secondary)',
                wordBreak: 'break-all',
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs italic" style={{ color: 'var(--admin-text-muted)' }}>
          Không có sai lệch.
        </p>
      )}
    </div>
  </div>
);

export default AdminMlops;
