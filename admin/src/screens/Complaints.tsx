import { useEffect, useMemo, useState } from 'react';
import { Flag, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Input';
import { EmptyPanel } from '@/components/EmptyPanel';
import { useCan } from '@/store/useSessionStore';
import { fetchComplaints, resolveComplaint, COMPLAINT_STATUS_LABEL } from '@/services/complaintsApi';
import { timeAgo } from '@/lib/format';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { Complaint, ComplaintStatus } from '@/types';

const STATUS_TONE: Record<ComplaintStatus, 'danger' | 'warning' | 'accent' | 'neutral'> = {
  new: 'danger',
  reviewing: 'warning',
  resolved: 'accent',
  rejected: 'neutral',
};

const TARGET_LABEL: Record<Complaint['targetKind'], string> = {
  worker: 'Соискатель',
  company: 'Работодатель',
  shift: 'Смена',
};

export function Complaints() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ComplaintStatus | 'all'>('new');
  const [items, setItems] = useState<Complaint[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const canAct = useCan('blockUsers');

  async function load(status: ComplaintStatus | 'all') {
    setLoadError(null);
    try {
      const data = await fetchComplaints(status);
      setItems(data.complaints);
      setCounts(data.counts);
    } catch (err) {
      setItems([]);
      setLoadError(
        err instanceof ApiError && err.code === 'migration_required'
          ? 'Не применена миграция 0031_complaints_and_employer_settings. Откройте Настройки → «Проверить миграции» — там готовый SQL.'
          : 'Не получилось загрузить жалобы.',
      );
    }
  }

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Держим открытую карточку на живом объекте после перезагрузки списка.
  useEffect(() => {
    setSelected((prev) => (prev ? (items.find((c) => c.id === prev.id) ?? null) : null));
  }, [items]);

  const tabs = useMemo(
    () => [
      { id: 'new', label: 'Новые', count: counts.new ?? 0 },
      { id: 'reviewing', label: 'Разбираем', count: counts.reviewing ?? 0 },
      { id: 'resolved', label: 'Решённые' },
      { id: 'rejected', label: 'Отклонённые' },
      { id: 'all', label: 'Все' },
    ],
    [counts],
  );

  return (
    <div className="pb-10 flex flex-col lg:h-full lg:min-h-0">
      <PageHeader title="Жалобы" />

      <div className="px-4 sm:px-8 pb-5 shrink-0">
        <Tabs value={tab} onChange={(v) => setTab(v as ComplaintStatus | 'all')} options={tabs} />
      </div>

      {loadError && <p className="px-4 sm:px-8 pb-3 text-[13px] text-danger leading-relaxed max-w-3xl">{loadError}</p>}

      <div className="lg:flex-1 lg:min-h-0 px-4 sm:px-8 pb-6 lg:pb-0 grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        <Card className="lg:overflow-hidden flex flex-col">
          <div className="lg:overflow-y-auto divide-y divide-border-soft">
            {items.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelected(c)}
                className={cn(
                  'w-full px-5 py-3.5 text-left hover:bg-surface-2 transition-colors',
                  selected?.id === c.id && 'bg-surface-2',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold truncate">
                      {TARGET_LABEL[c.targetKind]}: {c.targetName}
                    </p>
                    <p className="text-[13px] text-text-muted mt-0.5 truncate">
                      {c.reasonLabel} · от {c.authorName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Пятая жалоба на одного человека — совсем не то же
                        самое, что первая, и это должно быть видно списком. */}
                    {c.targetTotal > 1 && <Badge tone="warning">{c.targetTotal} жалоб</Badge>}
                    <Badge tone={STATUS_TONE[c.status]}>{COMPLAINT_STATUS_LABEL[c.status]}</Badge>
                  </div>
                </div>
                <p className="text-[12px] text-text-faint mt-1">{timeAgo(c.createdMinAgo)}</p>
              </button>
            ))}
            {items.length === 0 && !loadError && (
              <p className="px-5 py-10 text-center text-[13px] text-text-faint">
                {tab === 'new' ? 'Новых жалоб нет' : 'Ничего не нашли'}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-6 h-fit lg:sticky lg:top-0">
          {!selected && <EmptyPanel title="Выберите жалобу" description="Нажмите на строку слева, чтобы разобраться." />}
          {selected && (
            <ComplaintDetail
              complaint={selected}
              canAct={canAct}
              onOpenTarget={() => navigate('/users')}
              onDone={() => load(tab)}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function ComplaintDetail({
  complaint,
  canAct,
  onOpenTarget,
  onDone,
}: {
  complaint: Complaint;
  canAct: boolean;
  onOpenTarget: () => void;
  onDone: () => void;
}) {
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResolution(complaint.resolution ?? '');
    setError(null);
  }, [complaint.id, complaint.resolution]);

  async function act(status: ComplaintStatus) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await resolveComplaint(complaint.id, status, resolution.trim());
      onDone();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'resolution_required'
          ? 'Напишите, что сделали — это увидит тот, кто откроет жалобу после вас.'
          : 'Не получилось сохранить — попробуйте ещё раз.',
      );
    } finally {
      setBusy(false);
    }
  }

  const done = complaint.status === 'resolved' || complaint.status === 'rejected';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Flag size={16} className="text-danger" />
        <p className="font-bold text-[16px]">{complaint.reasonLabel}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge tone={STATUS_TONE[complaint.status]}>{COMPLAINT_STATUS_LABEL[complaint.status]}</Badge>
        <Badge tone="neutral">{TARGET_LABEL[complaint.targetKind]}</Badge>
        {complaint.targetTotal > 1 && <Badge tone="warning">Жалоб на него: {complaint.targetTotal}</Badge>}
      </div>

      <div className="space-y-3 text-[13px]">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-0.5">На кого</p>
          <p className="text-text">{complaint.targetName}</p>
          {complaint.targetShift && <p className="text-text-faint mt-0.5">{complaint.targetShift}</p>}
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-0.5">Кто пожаловался</p>
          <p className="text-text">
            {complaint.authorName} · {complaint.authorKind === 'seeker' ? 'соискатель' : 'работодатель'}
          </p>
        </div>
        {complaint.comment && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-0.5">Что пишет</p>
            <p className="text-text leading-relaxed whitespace-pre-line">{complaint.comment}</p>
          </div>
        )}
      </div>

      {done ? (
        <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 mt-5">
          <p className="text-[12px] font-semibold text-text-muted mb-0.5">Решение · {complaint.resolvedBy}</p>
          <p className="text-[13px] text-text leading-relaxed">{complaint.resolution}</p>
        </div>
      ) : (
        <div className="mt-5">
          <Textarea
            rows={3}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Что сделали? Например: скрыла анкету, попросила заменить фото."
          />
          {error && <p className="text-[12px] text-danger mt-2 leading-relaxed">{error}</p>}
          <div className="flex flex-col gap-2 mt-3">
            {/* Само действие — блокировка, скрытие анкеты, закрытие вакансии
                — живёт на своём экране. Здесь только вердикт по жалобе,
                иначе одно и то же действие оказалось бы в двух местах. */}
            <Button variant="outline" className="w-full" onClick={onOpenTarget}>
              <ExternalLink size={15} /> Открыть «Пользователи»
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" disabled={!canAct || busy} onClick={() => act('reviewing')}>
                Разбираемся
              </Button>
              <Button variant="primary" className="flex-1" disabled={!canAct || busy} onClick={() => act('resolved')}>
                Решена
              </Button>
            </div>
            <Button variant="outline" className="w-full text-danger border-danger/30" disabled={!canAct || busy} onClick={() => act('rejected')}>
              Отклонить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
