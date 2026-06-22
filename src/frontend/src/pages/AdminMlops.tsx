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
  Loader2,
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import AdminLayout from '../components/templates/AdminLayout';
import adminService, { MlopsOverview } from '../services/adminService';

type ViewMode = 'overview' | 'feedback' | 'classes';

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

const AdminMlops: React.FC = () => {
  const [data, setData] = useState<MlopsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('overview');

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Đang đọc trạng thái model...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1500px] space-y-5">
        <div className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
              <Bot className="h-4 w-4" />
              Ingredient Detection
            </div>
            <h1 className="text-2xl font-bold text-gray-950 dark:text-white">Vận hành MLOps</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Theo dõi model production, schema lớp và phản hồi nhận diện.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Làm mới trạng thái
          </button>
          {data?.monitoring?.grafanaUrl && (
            <a
              href={data.monitoring.grafanaUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Mở Grafana <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-5 w-5" />
                  Cần chú ý
                </div>
                <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-400">
                  {data.warnings.map(warning => <li key={warning}>• {warning}</li>)}
                </ul>
              </div>
            )}

            <div className="flex w-full overflow-x-auto border-b border-gray-200 dark:border-gray-800">
              {([
                ['overview', 'Tổng quan', Activity],
                ['feedback', 'Phản hồi', UserRoundCheck],
                ['classes', 'Lớp nhận diện', Layers3],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setView(value)}
                  className={`flex h-11 min-w-max items-center gap-2 border-b-2 px-4 text-sm font-semibold ${
                    view === value
                      ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {view === 'overview' && (
              <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
                <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <SectionHeader icon={Server} title="Model đang phục vụ" />
                  <div className="grid gap-px bg-gray-200 dark:bg-gray-800 sm:grid-cols-2">
                    <InfoCell label="Artifact" value={data.model.artifact || 'Không dùng registry'} />
                    <InfoCell label="Phiên bản" value={data.model.artifactVersion || 'N/A'} />
                    <InfoCell label="Base model" value={data.model.baseModel || 'Chưa ghi nhận'} />
                    <InfoCell label="Số lớp" value={`${data.model.classCount}/${data.schema.mappedClassCount}`} />
                    <InfoCell label="Ngưỡng confidence" value={data.service.confidenceThreshold !== null ? data.service.confidenceThreshold.toFixed(2) : 'Chưa có'} />
                    <InfoCell label="Cập nhật service" value={formatDate(data.service.timestamp)} />
                    <InfoCell label="Git revision" value={shortValue(data.model.gitRevision)} mono />
                    <InfoCell label="SHA-256" value={shortValue(data.model.sha256)} mono />
                  </div>
                  <div className="flex flex-wrap gap-2 border-t border-gray-200 p-4 dark:border-gray-800">
                    {data.model.runUrl && (
                      <a
                        href={data.model.runUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        Mở W&B run <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-gray-100 px-3 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      <GitCommitHorizontal className="h-4 w-4" />
                      Tạo model: {formatDate(data.model.createdAt)}
                    </span>
                  </div>
                </section>

                <section className="rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <SectionHeader icon={SlidersHorizontal} title="Chỉ số đánh giá" />
                  {metrics.length > 0 ? (
                    <div className="grid grid-cols-2 gap-px bg-gray-200 dark:bg-gray-800">
                      {metrics.map(metric => (
                        <div key={metric.key} className="bg-white p-5 dark:bg-gray-900">
                          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{metric.label}</p>
                          <p className="mt-2 text-2xl font-bold text-gray-950 dark:text-white">
                            {(metric.value * 100).toFixed(1)}%
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyBlock text="Checkpoint hiện tại chưa có metrics trong manifest." />
                  )}
                  <div className="grid grid-cols-2 gap-px border-t border-gray-200 bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
                    <InfoCell label="Phản hồi 24 giờ" value={String(data.feedback.last24Hours)} />
                    <InfoCell label="MLOps registry" value={data.service.mlopsEnabled ? 'Đang bật' : 'Đang tắt'} />
                  </div>
                </section>
              </div>
            )}

            {view === 'feedback' && (
              <section className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <SectionHeader icon={UserRoundCheck} title={`Phản hồi cần học lại (${data.feedback.recent.length})`} />
                {data.feedback.recent.length === 0 ? (
                  <EmptyBlock text="Chưa có lượt nhận diện nào được người dùng chỉnh sửa." />
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-800">
                    {data.feedback.recent.map(item => (
                      <div key={item.id} className="grid gap-4 p-4 lg:grid-cols-[180px_1fr_1fr]">
                        <div>
                          <p className="font-mono text-xs text-gray-500 dark:text-gray-400">#{item.id} · {shortValue(item.imageHash, 16)}</p>
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatDate(item.createdAt)}
                          </p>
                          <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
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
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {view === 'classes' && (
              <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                    {data.model.classNames.map((name, index) => (
                      <div key={name} className="min-w-0 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-800">
                        <span className="mr-2 font-mono text-xs text-gray-400">{index}</span>
                        <span className="break-all text-sm font-medium text-gray-800 dark:text-gray-200">{name}</span>
                      </div>
                    ))}
                  </div>
                  {data.model.classNames.length === 0 && <EmptyBlock text="Không đọc được danh sách lớp từ model." />}
                </section>
                <aside className="space-y-4">
                  <SchemaList title="Thiếu mapping" items={data.schema.missingMappings} tone="red" />
                  <SchemaList title="Mapping không dùng" items={data.schema.unusedMappings} tone="amber" />
                </aside>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
};

const StatusCard = ({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ElementType;
  tone: 'green' | 'red' | 'blue' | 'amber';
}) => {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-950/35 dark:text-red-300',
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-950/35 dark:text-blue-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-300',
  };
  return (
    <div className="min-h-[104px] rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="min-h-8 text-[10px] font-semibold uppercase leading-4 text-gray-500 dark:text-gray-400 sm:text-xs">{label}</p>
          <p className="mt-1 break-words text-base font-bold leading-5 text-gray-950 dark:text-white sm:text-lg">{value}</p>
          {detail && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
        </div>
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex h-12 items-center gap-2 border-b border-gray-200 px-4 dark:border-gray-800">
    <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
  </div>
);

const InfoCell = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="min-w-0 bg-white p-4 dark:bg-gray-900">
    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
    <p className={`mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100 ${mono ? 'font-mono' : ''}`} title={value}>
      {value}
    </p>
  </div>
);

const EmptyBlock = ({ text }: { text: string }) => (
  <div className="flex min-h-32 items-center justify-center p-6 text-center text-sm text-gray-500 dark:text-gray-400">
    {text}
  </div>
);

const IngredientDiff = ({ label, items, added = [], removed = [], tone }: {
  label: string;
  items: string[];
  added?: string[];
  removed?: string[];
  tone: 'neutral' | 'final';
}) => (
  <div>
    <p className="mb-2 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{label}</p>
    <div className="flex flex-wrap gap-1.5">
      {items.map(item => {
        const isAdded = added.includes(item);
        const isRemoved = removed.includes(item);
        const style = isAdded
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-300'
          : isRemoved
          ? 'border-red-200 bg-red-50 text-red-700 line-through dark:border-red-900 dark:bg-red-950/35 dark:text-red-300'
          : tone === 'final'
          ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-300'
          : 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300';
        return <span key={item} className={`rounded-md border px-2 py-1 text-xs font-medium ${style}`}>{item}</span>;
      })}
      {items.length === 0 && <span className="text-xs text-gray-400">Không có nguyên liệu</span>}
    </div>
  </div>
);

const SchemaList = ({ title, items, tone }: { title: string; items: string[]; tone: 'red' | 'amber' }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h3>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
        tone === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
      }`}>{items.length}</span>
    </div>
    <div className="mt-3 space-y-1">
      {items.map(item => <p key={item} className="break-all font-mono text-xs text-gray-600 dark:text-gray-300">{item}</p>)}
      {items.length === 0 && <p className="text-xs text-gray-400">Không có sai lệch.</p>}
    </div>
  </div>
);

export default AdminMlops;
