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
  Sparkles,
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
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow-tag text-[10px]">
              <Filter className="h-3 w-3" strokeWidth={2} />
              Feedback queue
            </p>
            <h1 className="mt-3 text-display text-3xl md:text-4xl text-ink-primary dark:text-paper-light">
              Duyệt phản hồi & xuất dataset increment
            </h1>
            <p className="mt-2 text-ink-secondary text-sm max-w-3xl">
              Phê duyệt các correction người dùng, xuất YOLO labels ra thư mục DVC, rồi promote model và triển khai Blue/Green
              thông qua CodePipeline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['pending', 'approved', 'rejected'] as CorrectionStatus[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`btn-editorial-${status === s ? 'primary' : 'ghost'}`}
              >
                {s === 'pending' ? 'Cần duyệt' : s === 'approved' ? 'Đã duyệt' : 'Bị từ chối'}
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-paper-light px-2 py-0.5 text-[10px] font-bold uppercase text-ink-secondary">
                  {stats?.[s] ?? '…'}
                </span>
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="card-bezel">
            <div className="card-bezel-inner p-4 bg-[#FDEBEC] dark:bg-[#9F2F2D]/15 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-[#9F2F2D]" strokeWidth={1.5} />
              <span className="text-sm text-[#9F2F2D]">{error}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <button
            type="button"
            disabled={actionInProgress === -1}
            onClick={handleSync}
            className="card-bezel h-full text-left"
          >
            <div className="card-bezel-inner p-5 min-h-[110px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">Đồng bộ</p>
                  <p className="mt-2 text-base font-bold text-ink-primary dark:text-paper-light">
                    Đồng bộ history → correction queue
                  </p>
                </div>
                <Sparkles className="h-6 w-6 text-[#3D5A80]" strokeWidth={1.5} />
              </div>
              <p className="mt-2 text-xs text-ink-secondary">
                Quét <code>DetectionHistory.wasModified = true</code> và tạo row <code>DetectionCorrection</code> trạng thái
                <em> pending</em>.
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={actionInProgress === -2}
            onClick={handleExport}
            className="card-bezel h-full text-left"
          >
            <div className="card-bezel-inner p-5 min-h-[110px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">Export</p>
                  <p className="mt-2 text-base font-bold text-ink-primary dark:text-paper-light">
                    Export YOLO labels từ approved corrections
                  </p>
                </div>
                <Download className="h-6 w-6 text-[#346538]" strokeWidth={1.5} />
              </div>
              <p className="mt-2 text-xs text-ink-secondary">
                Xuất placeholder bbox toàn ảnh, file <code>classes.txt</code>, <code>manifest.json</code> và hướng dẫn
                <code> dvc add</code>.
              </p>
            </div>
          </button>

          <button
            type="button"
            disabled={releasing}
            onClick={handleRelease}
            className="card-bezel h-full text-left"
          >
            <div className="card-bezel-inner p-5 min-h-[110px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">Pipeline</p>
                  <p className="mt-2 text-base font-bold text-ink-primary dark:text-paper-light">
                    Promote W&B + trigger CodePipeline
                  </p>
                </div>
                {releasing ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#ff4f00]" strokeWidth={1.5} />
                ) : (
                  <Rocket className="h-6 w-6 text-[#ff4f00]" strokeWidth={1.5} />
                )}
              </div>
              <p className="mt-2 text-xs text-ink-secondary">
                Alias <code>candidate → production</code>, gọi <code>start_pipeline_execution</code>, chờ SNS approval.
              </p>
            </div>
          </button>
        </div>

        {exportResult && (
          <div className="card-bezel">
            <div className="card-bezel-inner p-4 bg-[#EDF3EC] dark:bg-[#346538]/15 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#346538]" strokeWidth={1.5} />
              <div className="text-sm text-[#346538]">
                Đã export {exportResult.exported} corrections ({exportResult.classesWritten} lớp) ra{' '}
                <code className="ml-1">{exportResult.directory}</code>. Tiếp theo chạy{' '}
                <code>dvc add</code> để DVC track.
              </div>
            </div>
          </div>
        )}

        {pipelineResult && (
          <div className="card-bezel">
            <div className="card-bezel-inner p-4 bg-[#E5EDF6] dark:bg-[#3D5A80]/15 flex items-center gap-3">
              <Rocket className="h-5 w-5 text-[#3D5A80]" strokeWidth={1.5} />
              <div className="text-sm text-[#3D5A80]">
                Pipeline <strong>{pipelineResult.pipelineName}</strong> đã khởi chạy, execution{' '}
                <code className="ml-1 font-mono">{pipelineResult.executionId}</code>. Vào AWS console để duyệt Approval
                stage.
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="h-9 w-9 animate-spin text-[#ff4f00]" strokeWidth={1.5} />
          </div>
        ) : items.length === 0 ? (
          <div className="card-bezel">
            <div className="card-bezel-inner p-10 text-center text-sm text-ink-secondary">
              <ShieldCheck className="mx-auto mb-3 h-7 w-7 text-[#346538]" strokeWidth={1.5} />
              Không có correction nào đang ở trạng thái <strong>{status}</strong>.
            </div>
          </div>
        ) : (
          <div className="card-bezel">
            <div className="card-bezel-inner p-0 overflow-hidden">
              <ul className="divide-y divide-ink-200/40 dark:divide-ink-700/40">
                {items.map(item => (
                  <CorrectionRow
                    key={item.id}
                    item={item}
                    busy={actionInProgress === item.id}
                    onDecide={handleDecision}
                  />
                ))}
              </ul>
            </div>
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
    <li className="grid gap-3 p-4 lg:grid-cols-[1.4fr_1fr_1fr]">
      <div>
        <p className="font-mono text-xs text-ink-muted">#{item.id} · history #{item.detectionHistoryId}</p>
        <p className="mt-1 break-all text-xs text-ink-secondary">hash: {item.imageHash}</p>
        <p className="mt-1 text-xs text-ink-secondary">Cập nhật: {fmt(item.updatedAt)}</p>
        {item.reviewedBy && (
          <p className="mt-1 text-xs text-ink-secondary">
            Reviewed by <strong>{item.reviewedBy.fullName}</strong> · {fmt(item.reviewedAt)}
          </p>
        )}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#3D5A80]"
        >
          Ghi chú review <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Lý do approve / reject ..."
            rows={2}
            className="input-bezel-inner mt-2 w-full text-xs"
          />
        )}
      </div>

      <IngredientDiff
        label="Model dự đoán"
        items={item.originalIngredients}
        tone="neutral"
      />

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
              className="btn-editorial-primary"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
              ) : (
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
              )}
              Approve
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(item.id, 'rejected', notes)}
              className="btn-editorial-ghost"
            >
              <XCircle className="h-4 w-4" strokeWidth={1.5} /> Reject
            </button>
          </div>
        ) : (
          <span className={`eyebrow-tag mt-3 inline-flex items-center gap-1 text-[10px] ${
            item.status === 'approved'
              ? 'bg-[#EDF3EC] text-[#346538]'
              : 'bg-[#FDEBEC] text-[#9F2F2D]'
          }`}>
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
    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-ink-secondary">{label}</p>
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const isAdded = added.includes(item);
        const isRemoved = removed.includes(item);
        const style = isAdded
          ? 'ring-[#346538]/30 bg-[#EDF3EC] text-[#346538]'
          : isRemoved
          ? 'ring-[#9F2F2D]/30 bg-[#FDEBEC] text-[#9F2F2D] line-through'
          : tone === 'final'
          ? 'ring-[#3D5A80]/30 bg-[#E5EDF6] text-[#3D5A80]'
          : 'ring-ink-200/40 dark:ring-ink-700/40 bg-paper-light dark:bg-ink-700/30 text-ink-secondary';
        return (
          <span
            key={item}
            className={`rounded-full ring-1 px-2.5 py-1 text-xs font-medium ${style}`}
          >
            {item}
          </span>
        );
      })}
      {items.length === 0 && <span className="text-xs text-ink-muted">Không có nguyên liệu</span>}
    </div>
  </div>
);

export default AdminFeedbackQueue;
