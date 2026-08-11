import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Undo2, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyPanel } from '@/components/EmptyPanel';
import { useCurrentActor, useModerationStore } from '@/store/useModerationStore';
import { useCan } from '@/store/useSessionStore';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ComplaintItem, DocumentReview, ModerationVacancy } from '@/types';

const FLAG_TONE_MAP = { danger: 'danger', warning: 'warning', info: 'info', neutral: 'neutral' } as const;

export function Moderation() {
  const [tab, setTab] = useState<'vacancies' | 'complaints' | 'documents'>('vacancies');
  const allVacancies = useModerationStore((s) => s.vacancies);
  const allComplaints = useModerationStore((s) => s.complaints);
  const allDocuments = useModerationStore((s) => s.documents);
  const vacancies = useMemo(() => allVacancies.filter((v) => v.status === 'pending'), [allVacancies]);
  const complaints = useMemo(() => allComplaints.filter((c) => c.status === 'pending'), [allComplaints]);
  const documents = useMemo(() => allDocuments.filter((d) => d.status === 'pending'), [allDocuments]);

  return (
    <div className="pb-10 flex flex-col h-full min-h-0">
      <PageHeader
        title="Модерация"
        right={<span className="text-[13px] text-text-faint">Среднее время проверки — 6 мин</span>}
      />
      <div className="px-8 pb-5 shrink-0">
        <Tabs
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { id: 'vacancies', label: 'Новые', count: vacancies.length },
            { id: 'complaints', label: 'Жалобы', count: complaints.length },
            { id: 'documents', label: 'Документы', count: documents.length },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 px-8">
        {tab === 'vacancies' && <VacancyQueue items={vacancies} />}
        {tab === 'complaints' && <ComplaintQueue items={complaints} />}
        {tab === 'documents' && <DocumentQueue items={documents} />}
      </div>
    </div>
  );
}

function VacancyQueue({ items }: { items: ModerationVacancy[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const decide = useModerationStore((s) => s.decideVacancy);
  const actor = useCurrentActor();
  const canApprove = useCan('approveVacancies');

  const selected = useMemo(() => items.find((v) => v.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  useEffect(() => {
    if (!selected && items[0]) setSelectedId(items[0].id);
  }, [items, selected]);

  function act(status: 'approved' | 'returned' | 'rejected') {
    if (!selected) return;
    const idx = items.findIndex((v) => v.id === selected.id);
    decide(selected.id, status, actor);
    const next = items[idx + 1] ?? items[idx - 1];
    setSelectedId(next?.id ?? null);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!canApprove || !selected) return;
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key.toLowerCase() === 'a') act('approved');
      if (e.key.toLowerCase() === 'd') act('rejected');
      if (e.key === 'ArrowRight') {
        const idx = items.findIndex((v) => v.id === selected.id);
        setSelectedId(items[idx + 1]?.id ?? items[0]?.id ?? null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, items, canApprove]);

  if (items.length === 0) return <EmptyPanel title="Очередь пуста" description="Новых вакансий на проверку нет." />;

  return (
    <div className="grid grid-cols-[1fr_1.15fr] gap-5 h-full min-h-0">
      <div className="overflow-y-auto pr-1 space-y-2.5 pb-6">
        {items.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedId(v.id)}
            className={cn(
              'w-full text-left rounded-card border p-4 transition-colors',
              v.id === selected?.id ? 'border-text bg-white' : 'border-border-soft bg-white hover:border-border',
            )}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <p className="font-bold text-[15px] truncate">{v.position} · {v.companyName}</p>
              {v.flag && <Badge tone={FLAG_TONE_MAP[v.flag.tone]}>{v.flag.label}</Badge>}
            </div>
            <p className="text-[13px] text-text-faint">{timeAgo(v.submittedMinAgo)} · {v.city}</p>
          </button>
        ))}
      </div>

      {selected && (
        <Card className="p-6 h-fit sticky top-0">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <Avatar name={selected.companyName} size={44} square />
              <div>
                <p className="font-bold text-[18px] leading-tight">{selected.position}</p>
                <p className="text-[13px] text-text-muted mt-0.5">
                  {selected.companyName} · ИНН {selected.companyInn} · {selected.shiftsPosted} смен опубликовано · ★ {selected.companyRating}
                </p>
              </div>
            </div>
            <Badge tone="warning">На проверке</Badge>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-5">
            <Stat label="Ставка" value={`${selected.hourlyRate} ₽/ч`} />
            <Stat label="Смена" value={`${selected.durationHours} ч`} />
            <Stat label="Адрес" value={selected.city} />
            <Stat label="Опыт" value={selected.experienceReq} />
          </div>

          {selected.flag?.tone === 'danger' && selected.flag.label === 'Ставка ниже МРОТ' && (
            <div className="flex gap-2.5 rounded-xl bg-danger-soft text-danger px-4 py-3 mb-4">
              <AlertTriangle size={17} className="shrink-0 mt-0.5" />
              <div className="text-[13px] leading-relaxed">
                <p className="font-bold">Автопроверка: ставка ниже минимальной</p>
                <p>
                  {selected.hourlyRate} ₽/ч при региональном минимуме {selected.regionalMinWage} ₽/ч. Требуется правка работодателем или
                  отклонение.
                </p>
              </div>
            </div>
          )}
          {selected.flag && selected.flag.label !== 'Ставка ниже МРОТ' && (
            <div className="flex gap-2.5 rounded-xl bg-warning-soft text-warning px-4 py-3 mb-4">
              <AlertTriangle size={17} className="shrink-0 mt-0.5" />
              <p className="text-[13px] leading-relaxed font-medium">{selected.flag.label} — проверьте вручную перед одобрением.</p>
            </div>
          )}

          <p className="text-[14px] leading-relaxed text-text-muted mb-6">{selected.description}</p>

          <div className="flex items-center gap-2.5 mb-2">
            <Button variant="primary" className="flex-1" disabled={!canApprove} onClick={() => act('approved')}>
              <Check size={16} /> Одобрить
            </Button>
            <Button variant="outline" className="flex-1" disabled={!canApprove} onClick={() => act('returned')}>
              <Undo2 size={16} /> Вернуть на правку
            </Button>
            <Button variant="danger" className="flex-1" disabled={!canApprove} onClick={() => act('rejected')}>
              <X size={16} /> Отклонить
            </Button>
          </div>
          <p className="text-center text-[12px] text-text-faint">A — одобрить · D — отклонить · → следующая</p>
        </Card>
      )}
    </div>
  );
}

function ComplaintQueue({ items }: { items: ComplaintItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const decide = useModerationStore((s) => s.decideComplaint);
  const actor = useCurrentActor();
  const canModerate = useCan('blockUsers');
  const selected = useMemo(() => items.find((c) => c.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  useEffect(() => {
    if (!selected && items[0]) setSelectedId(items[0].id);
  }, [items, selected]);

  function act(status: 'approved' | 'returned' | 'rejected') {
    if (!selected) return;
    const idx = items.findIndex((c) => c.id === selected.id);
    decide(selected.id, status, actor);
    setSelectedId((items[idx + 1] ?? items[idx - 1])?.id ?? null);
  }

  if (items.length === 0) return <EmptyPanel title="Жалоб нет" description="Все обращения обработаны." />;

  return (
    <div className="grid grid-cols-[1fr_1.15fr] gap-5 h-full min-h-0">
      <div className="overflow-y-auto pr-1 space-y-2.5 pb-6">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedId(c.id)}
            className={cn(
              'w-full text-left rounded-card border p-4 transition-colors',
              c.id === selected?.id ? 'border-text bg-white' : 'border-border-soft bg-white hover:border-border',
            )}
          >
            <p className="font-bold text-[15px] mb-1">{c.targetName}</p>
            <p className="text-[13px] text-text-muted mb-1 truncate">{c.reason}</p>
            <p className="text-[12px] text-text-faint">{timeAgo(c.submittedMinAgo)} · от {c.reporterName}</p>
          </button>
        ))}
      </div>

      {selected && (
        <Card className="p-6 h-fit sticky top-0">
          <div className="flex items-center gap-3 mb-5">
            <Avatar name={selected.targetName} size={44} square />
            <div>
              <p className="font-bold text-[18px] leading-tight">{selected.targetName}</p>
              <p className="text-[13px] text-text-muted mt-0.5">
                {selected.targetType === 'employer' ? 'Работодатель' : 'Соискатель'} · жалоба от {selected.reporterName}
              </p>
            </div>
          </div>

          <Badge tone="warning" className="mb-4">{selected.reason}</Badge>
          <p className="text-[14px] leading-relaxed text-text-muted mb-6">{selected.text}</p>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" className="flex-1" disabled={!canModerate} onClick={() => act('rejected')}>
              Нет нарушения
            </Button>
            <Button variant="dark" className="flex-1" disabled={!canModerate} onClick={() => act('returned')}>
              Предупредить
            </Button>
            <Button variant="danger" className="flex-1" disabled={!canModerate} onClick={() => act('approved')}>
              Заблокировать
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function DocumentQueue({ items }: { items: DocumentReview[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const decide = useModerationStore((s) => s.decideDocument);
  const actor = useCurrentActor();
  const canVerify = useCan('verifyDocuments');
  const selected = useMemo(() => items.find((d) => d.id === selectedId) ?? items[0] ?? null, [items, selectedId]);

  useEffect(() => {
    if (!selected && items[0]) setSelectedId(items[0].id);
  }, [items, selected]);

  function act(status: 'approved' | 'returned' | 'rejected') {
    if (!selected) return;
    const idx = items.findIndex((d) => d.id === selected.id);
    decide(selected.id, status, actor);
    setSelectedId((items[idx + 1] ?? items[idx - 1])?.id ?? null);
  }

  if (items.length === 0) return <EmptyPanel title="Документов на проверке нет" description="Все загруженные документы рассмотрены." />;

  return (
    <div className="grid grid-cols-[1fr_1.15fr] gap-5 h-full min-h-0">
      <div className="overflow-y-auto pr-1 space-y-2.5 pb-6">
        {items.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedId(d.id)}
            className={cn(
              'w-full text-left rounded-card border p-4 transition-colors',
              d.id === selected?.id ? 'border-text bg-white' : 'border-border-soft bg-white hover:border-border',
            )}
          >
            <p className="font-bold text-[15px] mb-1">{d.applicantName}</p>
            <p className="text-[13px] text-text-muted mb-1">{d.docType}</p>
            <p className="text-[12px] text-text-faint">{timeAgo(d.submittedMinAgo)} · {d.applicantCity}</p>
          </button>
        ))}
      </div>

      {selected && (
        <Card className="p-6 h-fit sticky top-0">
          <div className="flex items-center gap-3 mb-5">
            <Avatar name={selected.applicantName} size={44} />
            <div>
              <p className="font-bold text-[18px] leading-tight">{selected.applicantName}</p>
              <p className="text-[13px] text-text-muted mt-0.5">
                {selected.applicantCity} · ★ {selected.applicantRating}
              </p>
            </div>
          </div>

          <Badge tone="info" className="mb-3">{selected.docType}</Badge>
          <div
            className="w-full h-64 rounded-2xl border border-border-soft flex items-center justify-center text-text-faint text-[13px] mb-6"
            style={{
              background:
                'repeating-linear-gradient(135deg, var(--color-surface-2) 0px, var(--color-surface-2) 10px, #fff 10px, #fff 20px)',
            }}
          >
            изображение документа
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="primary" className="flex-1" disabled={!canVerify} onClick={() => act('approved')}>
              <Check size={16} /> Одобрить
            </Button>
            <Button variant="outline" className="flex-1" disabled={!canVerify} onClick={() => act('returned')}>
              <Undo2 size={16} /> Запросить другое
            </Button>
            <Button variant="danger" className="flex-1" disabled={!canVerify} onClick={() => act('rejected')}>
              <X size={16} /> Отклонить
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] text-text-faint mb-0.5">{label}</p>
      <p className="text-[14px] font-bold">{value}</p>
    </div>
  );
}
