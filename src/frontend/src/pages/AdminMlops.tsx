import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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
  RefreshCw,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  UserRoundCheck,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/templates/AdminLayout';
import adminService, { MlopsOverview } from '../services/adminService';
import { EyebrowTag } from '../components/atoms/EyebrowTag';
import { splitRevealLeft, splitRevealRight, cardReveal, staggerGrid, easeFluid } from '../lib/motion';

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
  const [classSearch, setClassSearch] = useState('');

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

  const filteredClassMappings = useMemo(() => {
    if (!data) return [];
    const query = classSearch.trim().toLowerCase();
    if (!query) return data.schema.classMappings;
    return data.schema.classMappings.filter(mapping => {
      const haystack = [mapping.yoloLabel, mapping.vietnameseName ?? '', mapping.category ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [data, classSearch]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#ff4f00]" strokeWidth={1.5} />
            <p className="text-sm uppercase tracking-[0.2em] text-ink-secondary">Đang đọc trạng thái model...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <motion.div initial="hidden" animate="visible" variants={splitRevealLeft} className="lg:col-span-7">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="h-4 w-4 text-[#ff4f00]" strokeWidth={1.5} />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff4f00]">
                Ingredient Detection
              </span>
            </div>
            <EyebrowTag>Vận hành MLOps</EyebrowTag>
            <h1 className="mt-4 text-display text-4xl md:text-5xl text-ink-primary dark:text-paper-light text-balance">
              MLOps.
            </h1>
            <p className="mt-4 text-ink-secondary text-pretty">
              Theo dõi model production, schema lớp và phản hồi nhận diện.
            </p>
          </motion.div>

          <motion.div initial="hidden" animate="visible" variants={splitRevealRight} className="lg:col-span-5 lg:pb-2 flex items-center gap-3 flex-wrap lg:justify-end">
            <Link
              to="/admin/mlops/feedback"
              className="btn-editorial-ghost"
            >
              <LinkIcon className="h-4 w-4" strokeWidth={1.5} />
              Mở feedback queue
            </Link>
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="btn-editorial-primary"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
              Làm mới trạng thái
            </button>
            {data?.monitoring?.grafanaUrl && (
              <a
                href={data.monitoring.grafanaUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-editorial-ghost"
              >
                Mở Grafana <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
              </a>
            )}
          </motion.div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeFluid }}
            className="card-bezel"
          >
            <div className="card-bezel-inner p-4 bg-[#FDEBEC] dark:bg-[#9F2F2D]/15 flex items-center gap-3">
              <XCircle className="h-5 w-5 text-[#9F2F2D] flex-shrink-0" strokeWidth={1.5} />
              <span className="text-sm text-[#9F2F2D]">{error}</span>
            </div>
          </motion.div>
        )}

        {data && (
          <>
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerGrid}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
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
            </motion.div>

            {data.warnings.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: easeFluid }}
                className="card-bezel"
              >
                <div className="card-bezel-inner p-4 bg-[#FBF3DB] dark:bg-[#956400]/15">
                  <div className="flex items-center gap-2 font-semibold text-[#956400] mb-2">
                    <AlertTriangle className="h-4 w-4" strokeWidth={1.5} />
                    Cần chú ý
                  </div>
                  <ul className="space-y-1 text-sm text-[#956400]">
                    {data.warnings.map(warning => <li key={warning}>• {warning}</li>)}
                  </ul>
                </div>
              </motion.div>
            )}

            <div className="card-bezel">
              <div className="card-bezel-inner p-0">
                <div className="flex w-full overflow-x-auto">
                  {([
                    ['overview', 'Tổng quan', Activity],
                    ['feedback', 'Phản hồi', UserRoundCheck],
                    ['classes', 'Lớp nhận diện', Layers3],
                  ] as const).map(([value, label, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setView(value)}
                      className={`relative flex h-12 min-w-max items-center gap-2 px-5 text-xs font-bold uppercase tracking-[0.15em] transition-colors duration-500 ease-[var(--ease-fluid)] ${
                        view === value
                          ? 'text-[#ff4f00]'
                          : 'text-ink-secondary hover:text-ink-primary dark:hover:text-paper-light'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      {label}
                      {view === value && (
                        <motion.span
                          layoutId="mlops-active"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#ff4f00]"
                          transition={{ duration: 0.4, ease: easeFluid }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {view === 'overview' && (
              <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
                <div className="card-bezel">
                  <div className="card-bezel-inner p-0 overflow-hidden">
                    <EditorialSectionHeader icon={Server} title="Model đang phục vụ" />
                    <div className="grid sm:grid-cols-2 gap-px bg-ink-200/40 dark:bg-ink-700/40">
                      <InfoCell label="Artifact" value={data.model.artifact || 'Không dùng registry'} />
                      <InfoCell label="Phiên bản" value={data.model.artifactVersion || 'N/A'} />
                      <InfoCell label="Base model" value={data.model.baseModel || 'Chưa ghi nhận'} />
                      <InfoCell label="Số lớp" value={`${data.model.classCount}/${data.schema.mappedClassCount}`} />
                      <InfoCell label="Ngưỡng confidence" value={data.service.confidenceThreshold !== null ? data.service.confidenceThreshold.toFixed(2) : 'Chưa có'} />
                      <InfoCell label="Cập nhật service" value={formatDate(data.service.timestamp)} />
                      <InfoCell label="Git revision" value={shortValue(data.model.gitRevision)} mono />
                      <InfoCell label="SHA-256" value={shortValue(data.model.sha256)} mono />
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-ink-200/40 dark:border-ink-700/40 p-4">
                      {data.model.runUrl && (
                        <a
                          href={data.model.runUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-editorial-ghost"
                        >
                          Mở W&B run <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
                        </a>
                      )}
                      <span className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-medium bg-paper-light dark:bg-ink-700 text-ink-secondary">
                        <GitCommitHorizontal className="h-4 w-4" strokeWidth={1.5} />
                        Tạo model: {formatDate(data.model.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-bezel">
                  <div className="card-bezel-inner p-0 overflow-hidden">
                    <EditorialSectionHeader icon={SlidersHorizontal} title="Chỉ số đánh giá" />
                    {metrics.length > 0 ? (
                      <div className="grid grid-cols-2 gap-px bg-ink-200/40 dark:bg-ink-700/40">
                        {metrics.map(metric => (
                          <div key={metric.key} className="bg-paper-light dark:bg-ink-700/30 p-5">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">
                              {metric.label}
                            </p>
                            <p className="mt-2 text-display text-3xl text-ink-primary dark:text-paper-light">
                              {(metric.value * 100).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyBlock text="Checkpoint hiện tại chưa có metrics trong manifest." />
                    )}
                    <div className="grid grid-cols-2 gap-px border-t border-ink-200/40 dark:border-ink-700/40 bg-ink-200/40 dark:bg-ink-700/40">
                      <InfoCell label="Phản hồi 24 giờ" value={String(data.feedback.last24Hours)} />
                      <InfoCell label="MLOps registry" value={data.service.mlopsEnabled ? 'Đang bật' : 'Đang tắt'} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {view === 'feedback' && (
              <div className="card-bezel">
                <div className="card-bezel-inner p-0 overflow-hidden">
                  <EditorialSectionHeader icon={UserRoundCheck} title={`Phản hồi cần học lại (${data.feedback.recent.length})`} />
                  {data.feedback.recent.length === 0 ? (
                    <EmptyBlock text="Chưa có lượt nhận diện nào được người dùng chỉnh sửa." />
                  ) : (
                    <div className="divide-y divide-ink-200/40 dark:divide-ink-700/40">
                      {data.feedback.recent.map(item => (
                        <div key={item.id} className="grid gap-4 p-4 lg:grid-cols-[180px_1fr_1fr]">
                          <div>
                            <p className="font-mono text-xs text-ink-muted">#{item.id} · {shortValue(item.imageHash, 16)}</p>
                            <p className="mt-2 flex items-center gap-1.5 text-xs uppercase tracking-[0.15em] text-ink-secondary">
                              <Clock3 className="h-3.5 w-3.5" strokeWidth={1.5} />
                              {formatDate(item.createdAt)}
                            </p>
                            <p className="mt-1 text-xs text-ink-primary dark:text-paper-light">
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
                </div>
              </div>
            )}

            {view === 'classes' && (
              <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
                <div className="card-bezel">
                  <div className="card-bezel-inner p-0 overflow-hidden">
                    <div className="flex h-14 items-center justify-between border-b border-ink-200/40 dark:border-ink-700/40 px-4">
                      <div className="flex items-center gap-2">
                        <Layers3 className="h-4 w-4 text-[#ff4f00]" strokeWidth={1.5} />
                        <h2 className="text-sm font-bold text-ink-primary dark:text-paper-light uppercase tracking-[0.15em]">
                          Bảng mapping lớp YOLO → nguyên liệu
                        </h2>
                      </div>
                      <input
                        type="search"
                        placeholder="Tìm theo YOLO label hoặc tên VN..."
                        value={classSearch}
                        onChange={event => setClassSearch(event.target.value)}
                        className="input-bezel-inner h-9 w-56 text-xs"
                      />
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-paper-light dark:bg-ink-700/40 text-[10px] uppercase tracking-[0.2em] text-ink-secondary">
                          <tr>
                            <th className="px-4 py-3 font-bold">#</th>
                            <th className="px-4 py-3 font-bold">YOLO label</th>
                            <th className="px-4 py-3 font-bold">Tên nguyên liệu (database)</th>
                            <th className="px-4 py-3 font-bold">Danh mục</th>
                            <th className="px-4 py-3 font-bold">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-ink-200/40 dark:divide-ink-700/40">
                          {filteredClassMappings.map((mapping, index) => (
                            <tr key={mapping.yoloLabel} className="hover:bg-paper-light dark:hover:bg-ink-700/30 transition-colors duration-500 ease-[var(--ease-fluid)]">
                              <td className="px-4 py-2 font-mono text-xs text-ink-muted">{index}</td>
                              <td className="px-4 py-2">
                                <span className="font-mono text-xs font-semibold text-ink-primary dark:text-paper-light">
                                  {mapping.yoloLabel}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm font-semibold text-ink-primary dark:text-paper-light">
                                {mapping.vietnameseName ?? <span className="italic text-ink-muted font-normal">— chưa ánh xạ —</span>}
                              </td>
                              <td className="px-4 py-2 text-xs text-ink-secondary">
                                {mapping.category ?? <span className="italic text-ink-muted">—</span>}
                              </td>
                              <td className="px-4 py-2">
                                {mapping.isMapped ? (
                                  <span className="eyebrow-tag text-[10px] bg-[#EDF3EC] text-[#346538]">
                                    <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                                    Đã map
                                  </span>
                                ) : (
                                  <span className="eyebrow-tag text-[10px] bg-[#FDEBEC] text-[#9F2F2D]">
                                    <XCircle className="h-3 w-3" strokeWidth={2} />
                                    Thiếu map
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredClassMappings.length === 0 && (
                      <EmptyBlock
                        text={
                          classSearch
                            ? `Không tìm thấy lớp nào khớp với "${classSearch}".`
                            : 'Không đọc được danh sách lớp từ model.'
                        }
                      />
                    )}
                    <div className="flex items-center justify-between border-t border-ink-200/40 dark:border-ink-700/40 px-4 py-3 text-xs uppercase tracking-[0.15em] text-ink-muted">
                      <span>
                        Hiển thị {filteredClassMappings.length}/{data.schema.classMappings.length} lớp
                      </span>
                      <span>
                        Đã map: {data.schema.classMappings.filter(m => m.isMapped).length} · Thiếu:{' '}
                        {data.schema.classMappings.filter(m => !m.isMapped).length}
                      </span>
                    </div>
                  </div>
                </div>
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
    green: 'bg-[#EDF3EC] text-[#346538]',
    red: 'bg-[#FDEBEC] text-[#9F2F2D]',
    blue: 'bg-[#E5EDF6] text-[#3D5A80]',
    amber: 'bg-[#FBF3DB] text-[#956400]',
  };
  return (
    <div className="card-bezel h-full">
      <div className="card-bezel-inner p-5 min-h-[104px]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary">{label}</p>
            <p className="mt-1 break-words text-base font-bold leading-5 text-ink-primary dark:text-paper-light text-display sm:text-lg">
              {value}
            </p>
            {detail && <p className="mt-1 text-xs text-ink-muted">{detail}</p>}
          </div>
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${tones[tone]}`}>
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    </div>
  );
};

const EditorialSectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex h-12 items-center gap-2 border-b border-ink-200/40 dark:border-ink-700/40 px-4">
    <Icon className="h-4 w-4 text-[#ff4f00]" strokeWidth={1.5} />
    <h2 className="text-sm font-bold text-ink-primary dark:text-paper-light">{title}</h2>
  </div>
);

const InfoCell = ({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) => (
  <div className="min-w-0 bg-paper-light dark:bg-ink-700/30 p-4">
    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-ink-secondary">{label}</p>
    <p className={`mt-1 truncate text-sm font-semibold text-ink-primary dark:text-paper-light ${mono ? 'font-mono' : ''}`} title={value}>
      {value}
    </p>
  </div>
);

const EmptyBlock = ({ text }: { text: string }) => (
  <div className="flex min-h-32 items-center justify-center p-6 text-center text-sm text-ink-secondary">
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
        return <span key={item} className={`rounded-full ring-1 px-2.5 py-1 text-xs font-medium ${style}`}>{item}</span>;
      })}
      {items.length === 0 && <span className="text-xs text-ink-muted">Không có nguyên liệu</span>}
    </div>
  </div>
);

const SchemaList = ({ title, items, tone }: { title: string; items: string[]; tone: 'red' | 'amber' }) => (
  <div className="card-bezel">
    <div className="card-bezel-inner p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-ink-primary dark:text-paper-light">{title}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
          tone === 'red' ? 'bg-[#FDEBEC] text-[#9F2F2D]' : 'bg-[#FBF3DB] text-[#956400]'
        }`}>{items.length}</span>
      </div>
      <div className="space-y-1">
        {items.map(item => <p key={item} className="break-all font-mono text-xs text-ink-secondary">{item}</p>)}
        {items.length === 0 && <p className="text-xs text-ink-muted italic">Không có sai lệch.</p>}
      </div>
    </div>
  </div>
);

export default AdminMlops;