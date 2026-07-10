import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Loader2,
  Rocket,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService from '../services/adminService';

type CorrectionStatus = 'pending' | 'approved' | 'rejected';

interface FeedbackCorrectionItem {
  id: number;
  imageHash: string;
  detectionHistoryId: number;
  status: CorrectionStatus;
  originalIngredients: string[];
  finalIngredients: string[];
  addedIngredients: string[];
  removedIngredients: string[];
  notes: string | null;
  reviewedBy: { id: number; fullName: string; email: string } | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const fmt = (value: string | null | undefined) => {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const statusLabel = (s: CorrectionStatus) =>
  s === 'pending' ? 'Cần duyệt' : s === 'approved' ? 'Đã duyệt' : 'Bị từ chối';

const AdminFeedbackQueue: React.FC = () => {
  const [status, setStatus] = useState<CorrectionStatus>('pending');
  const [items, setItems] = useState<FeedbackCorrectionItem[]>([]);
  const [stats, setStats] = useState<{ total: number; pending: number; approved: number; rejected: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<number | null>(null);
  const [exportResult, setExportResult] = useState<{ directory: string; exported: number; classesWritten: number } | null>(null);
  const [pipelineResult, setPipelineResult] = useState<{ executionId: string; pipelineName: string } | null>(null);
  const [releasing, setReleasing] = useState(false);

  const load = useCallback(async (nextStatus: CorrectionStatus) => {
    try {
      setLoading(true);
      setError(null);
      const queueRes = await adminService.getFeedbackQueue({ status: nextStatus, limit: 100 });
      setItems(queueRes.data?.items || []);
      const statsRes = await adminService.getFeedbackStats();
      setStats(statsRes.data || null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải feedback queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(status);
  }, [load, status]);

  const handleDecision = async (
    id: number,
    decision: 'approved' | 'rejected',
    notes?: string
  ) => {
    try {
      setActionInProgress(id);
      await adminService.decideFeedback(id, decision, notes);
      await load(status);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể cập nhật feedback.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSync = async () => {
    try {
      setActionInProgress(-1);
      await adminService.syncFeedback();
      await load(status);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sync thất bại');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleExport = async () => {
    try {
      setActionInProgress(-2);
      const res = await adminService.exportFeedback({ approvedOnly: true, maxCount: 200 });
      setExportResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Export thất bại');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRelease = async () => {
    if (!window.confirm('Promote W&B candidate -> production và trigger CodePipeline?')) return;
    try {
      setReleasing(true);
      setPipelineResult(null);
      const res = await adminService.releaseToPipeline();
      setPipelineResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Pipeline trigger thất bại');
    } finally {
      setReleasing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-[1500px]">
        <div className="admin-page-header">
          <h1 className="admin-page-title">Duyệt phản hồi & xuất dataset</h1>
          <p className="admin-page-subtitle">
            Phê duyệt các correction của người dùng, xuất YOLO labels ra thư mục DVC, sau đó promote model và triển khai Blue/Green
            thông qua CodePipeline.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {(['pending', 'approved', 'rejected'] as CorrectionStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`admin-tab ${status === s ? 'active' : ''}`}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 'var(--admin-radius-sm)',
                  background: status === s ? 'var(--admin-accent)' : 'var(--admin-surface)',
                  color: status === s ? '#fff' : 'var(--admin-text-secondary)',
                  border: '1px solid',
                  borderColor: status === s ? 'var(--admin-accent)' : 'var(--admin-border-strong)',
                  borderBottom: '1px solid',
                  borderBottomColor: status === s ? 'var(--admin-accent)' : 'var(--admin-border-strong)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 0,
                }}
              >
                {statusLabel(s)}
                <span
                  style={{
                    background: status === s ? 'rgba(255,255,255,0.25)' : 'var(--admin-surface-alt)',
                    color: status === s ? '#fff' : 'var(--admin-text-secondary)',
                    padding: '1px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {stats?.[s] ?? '…'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="admin-alert admin-alert-danger">
            <AlertTriangle className="w-4 h-4" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            disabled={actionInProgress === -1}
            onClick={handleSync}
            className="admin-stat text-left"
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-center justify-between">
              <span className="admin-stat-label">Đồng bộ</span>
              <Filter className="w-4 h-4" style={{ color: 'var(--admin-info)' }} strokeWidth={2} />
            </div>
            <span className="text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
              Đồng bộ history → correction queue
            </span>
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              Quét DetectionHistory.wasModified = true và tạo row DetectionCorrection trạng thái pending.
            </p>
          </button>

          <button
            type="button"
            disabled={actionInProgress === -2}
            onClick={handleExport}
            className="admin-stat text-left"
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-center justify-between">
              <span className="admin-stat-label">Export</span>
              <Download className="w-4 h-4" style={{ color: 'var(--admin-success)' }} strokeWidth={2} />
            </div>
            <span className="text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
              Export YOLO labels từ approved corrections
            </span>
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              Xuất placeholder bbox toàn ảnh, classes.txt, manifest.json, hướng dẫn dvc add.
            </p>
          </button>

          <button
            type="button"
            disabled={releasing}
            onClick={handleRelease}
            className="admin-stat text-left"
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-center justify-between">
              <span className="admin-stat-label">Pipeline</span>
              {releasing ? (
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
              ) : (
                <Rocket className="w-4 h-4" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
              )}
            </div>
            <span className="text-base font-semibold" style={{ color: 'var(--admin-text)' }}>
              Promote W&B + trigger CodePipeline
            </span>
            <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
              Alias candidate → production, gọi start_pipeline_execution, chờ SNS approval.
            </p>
          </button>
        </div>

        {exportResult && (
          <div className="admin-alert admin-alert-success">
            <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
            <span>
              Đã export <strong>{exportResult.exported}</strong> corrections ({exportResult.classesWritten} lớp) ra{' '}
              <code>{exportResult.directory}</code>. Tiếp theo chạy <code>dvc add</code> để DVC track.
            </span>
          </div>
        )}

        {pipelineResult && (
          <div className="admin-alert admin-alert-info">
            <Rocket className="w-4 h-4" strokeWidth={2} />
            <span>
              Pipeline <strong>{pipelineResult.pipelineName}</strong> đã khởi chạy, execution{' '}
              <code style={{ fontFamily: 'monospace' }}>{pipelineResult.executionId}</code>. Vào AWS console để duyệt Approval stage.
            </span>
          </div>
        )}

        {loading ? (
          <div className="admin-card">
            <div className="admin-loading" style={{ minHeight: 300 }}>
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--admin-accent)' }} strokeWidth={2} />
              <span>Đang tải...</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="admin-card">
            <div className="admin-empty">
              <ShieldCheck className="w-10 h-10" style={{ color: 'var(--admin-success)' }} strokeWidth={1.5} />
              <span>Không có correction nào đang ở trạng thái <strong>{statusLabel(status)}</strong>.</span>
            </div>
          </div>
        ) : (
          <div className="admin-card">
            <ul>
              {items.map((item) => (
                <CorrectionRow
                  key={item.id}
                  item={item}
                  busy={actionInProgress === item.id}
                  onDecide={handleDecision}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

interface RowProps {
  item: FeedbackCorrectionItem;
  busy: boolean;
  onDecide: (id: number, decision: 'approved' | 'rejected', notes?: string) => Promise<void>;
}

const CorrectionRow: React.FC<RowProps> = ({ item, busy, onDecide }) => {
  const [notes, setNotes] = useState(item.notes ?? '');
  const [open, setOpen] = useState(false);

  return (
    <li
      style={{
        borderTop: '1px solid var(--admin-border)',
        padding: 16,
        display: 'grid',
        gap: 16,
        gridTemplateColumns: '1fr',
      }}
      className="lg:!grid-cols-[1.4fr_1fr_1fr]"
    >
      <div>
        <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--admin-text-muted)' }}>
          #{item.id} · history #{item.detectionHistoryId}
        </p>
        <p className="mt-1 text-xs break-all" style={{ color: 'var(--admin-text-secondary)' }}>
          hash: {item.imageHash}
        </p>
        <p className="mt-1 text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          Cập nhật: {fmt(item.updatedAt)}
        </p>
        {item.reviewedBy && (
          <p className="mt-1 text-xs" style={{ color: 'var(--admin-text-secondary)' }}>
            Reviewed by <strong>{item.reviewedBy.fullName}</strong> · {fmt(item.reviewedAt)}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--admin-info)', padding: 0 }}
        >
          Ghi chú review <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Lý do approve / reject..."
            rows={2}
            className="admin-textarea"
            style={{ marginTop: 8, fontSize: 13 }}
          />
        )}
      </div>

      <IngredientDiff label="Model dự đoán" items={item.originalIngredients} tone="neutral" />

      <div>
        <IngredientDiff
          label="Người dùng xác nhận"
          items={item.finalIngredients}
          added={item.addedIngredients}
          removed={item.removedIngredients}
          tone="final"
        />
        {item.status === 'pending' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(item.id, 'approved', notes)}
              style={{
                height: 36,
                padding: '0 14px',
                background: 'var(--admin-success)',
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
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              )}
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(item.id, 'rejected', notes)}
              style={{
                height: 36,
                padding: '0 14px',
                background: 'var(--admin-surface)',
                color: 'var(--admin-danger)',
                border: '1px solid var(--admin-danger)',
                borderRadius: 'var(--admin-radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <XCircle className="h-4 w-4" strokeWidth={2} /> Reject
            </button>
          </div>
        ) : (
          <span
            className={`admin-badge mt-3 ${item.status === 'approved' ? 'admin-badge-success' : 'admin-badge-danger'}`}
          >
            {item.status === 'approved' ? (
              <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
            ) : (
              <XCircle className="h-3 w-3" strokeWidth={2} />
            )}
            {item.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'}
          </span>
        )}
      </div>
    </li>
  );
};

interface DiffProps {
  label: string;
  items: string[];
  added?: string[];
  removed?: string[];
  tone: 'neutral' | 'final';
}

const IngredientDiff: React.FC<DiffProps> = ({ label, items, added = [], removed = [], tone }) => (
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
        return (
          <span key={item} className={`admin-diff-tag ${className}`}>
            {item}
          </span>
        );
      })}
      {items.length === 0 && (
        <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
          Không có nguyên liệu
        </span>
      )}
    </div>
  </div>
);

export default AdminFeedbackQueue;