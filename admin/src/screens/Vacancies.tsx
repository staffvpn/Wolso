import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyPanel } from '@/components/EmptyPanel';
import { useVacanciesStore } from '@/store/useVacanciesStore';
import { useCurrentActor } from '@/store/useModerationStore';
import { useCan } from '@/store/useSessionStore';
import { formatMoney, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { VacancyRecord } from '@/types';

const STATUS_BADGE: Record<VacancyRecord['status'], { label: string; tone: 'accent' | 'warning' | 'neutral' | 'danger' }> = {
  active: { label: 'Активна', tone: 'accent' },
  moderation: { label: 'На модерации', tone: 'warning' },
  closed: { label: 'Закрыта', tone: 'neutral' },
  rejected: { label: 'Отклонена', tone: 'danger' },
};

export function Vacancies() {
  const navigate = useNavigate();
  const vacancies = useVacanciesStore((s) => s.vacancies);
  const closeVacancy = useVacanciesStore((s) => s.closeVacancy);
  const actor = useCurrentActor();
  const canManage = useCan('approveVacancies');
  const [status, setStatus] = useState<'all' | VacancyRecord['status']>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => (status === 'all' ? vacancies : vacancies.filter((v) => v.status === status)), [vacancies, status]);
  const selected = filtered.find((v) => v.id === selectedId) ?? null;

  const counts = useMemo(
    () => ({
      all: vacancies.length,
      active: vacancies.filter((v) => v.status === 'active').length,
      moderation: vacancies.filter((v) => v.status === 'moderation').length,
      closed: vacancies.filter((v) => v.status === 'closed').length,
      rejected: vacancies.filter((v) => v.status === 'rejected').length,
    }),
    [vacancies],
  );

  return (
    <div className="pb-10 flex flex-col h-full min-h-0">
      <PageHeader title="Вакансии и смены" subtitle={`${vacancies.length} всего`} />

      <div className="px-8 pb-5 shrink-0">
        <Tabs
          value={status}
          onChange={(v) => setStatus(v as typeof status)}
          options={[
            { id: 'all', label: 'Все', count: counts.all },
            { id: 'active', label: 'Активные', count: counts.active },
            { id: 'moderation', label: 'На модерации', count: counts.moderation },
            { id: 'closed', label: 'Закрытые', count: counts.closed },
            { id: 'rejected', label: 'Отклонённые', count: counts.rejected },
          ]}
        />
      </div>

      <div className="flex-1 min-h-0 px-8 grid grid-cols-[1.6fr_1fr] gap-5">
        <Card className="overflow-hidden flex flex-col">
          <div className="grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_1fr] px-5 py-3 border-b border-border-soft text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            <span>Вакансия</span>
            <span>Город</span>
            <span>Ставка</span>
            <span>Отклики</span>
            <span>Статус</span>
          </div>
          <div className="overflow-y-auto divide-y divide-border-soft">
            {filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  'w-full grid grid-cols-[1.6fr_1fr_0.8fr_0.8fr_1fr] items-center px-5 py-3 text-left hover:bg-surface-2 transition-colors',
                  selectedId === v.id && 'bg-surface-2',
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={v.companyName} size={30} square />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-text truncate">{v.position}</span>
                    <span className="block text-[12px] text-text-faint truncate">{v.companyName}</span>
                  </span>
                </span>
                <span className="text-[13px] text-text-muted">{v.city}</span>
                <span className="text-[13px] font-semibold text-text">{v.hourlyRate} ₽/ч</span>
                <span className="text-[13px] text-text-muted">{v.responses}</span>
                <span>
                  <Badge tone={STATUS_BADGE[v.status].tone}>{STATUS_BADGE[v.status].label}</Badge>
                </span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-5 py-8 text-center text-[13px] text-text-faint">Ничего не найдено</p>}
          </div>
        </Card>

        <Card className="p-6 h-fit sticky top-0">
          {!selected && <EmptyPanel title="Выберите вакансию" description="Нажмите на строку слева, чтобы увидеть подробности." />}
          {selected && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={selected.companyName} size={44} square />
                <div>
                  <p className="font-bold text-[17px] leading-tight">{selected.position}</p>
                  <p className="text-[13px] text-text-muted mt-0.5">{selected.companyName} · {selected.city}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-5">
                <Badge tone={STATUS_BADGE[selected.status].tone}>{STATUS_BADGE[selected.status].label}</Badge>
                <Badge tone="neutral">{formatMoney(selected.hourlyRate)}/ч</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                  <p className="text-[11px] text-text-faint mb-0.5">Отклики</p>
                  <p className="text-[14px] font-bold">{selected.responses}</p>
                </div>
                <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                  <p className="text-[11px] text-text-faint mb-0.5">Опубликовано</p>
                  <p className="text-[14px] font-bold">{timeAgo(selected.publishedMinAgo)}</p>
                </div>
              </div>

              {selected.status === 'moderation' && (
                <Button variant="outline" className="w-full" onClick={() => navigate('/moderation')}>
                  Открыть в модерации
                </Button>
              )}
              {selected.status === 'active' && (
                <Button variant="danger" className="w-full" disabled={!canManage} onClick={() => closeVacancy(selected.id, actor)}>
                  Закрыть вакансию
                </Button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
