import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, SectionLabel } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useDataStore } from '@/store/useDataStore';
import { useCan } from '@/store/useSessionStore';

interface ClearAction {
  scope: string;
  title: string;
  description: string;
  count: (stats: NonNullable<ReturnType<typeof useDataStore.getState>['stats']>) => number | null;
  confirmLabel: string;
  typeToConfirm?: string;
}

const ACTIONS: ClearAction[] = [
  {
    scope: 'applications',
    title: 'Отклики и приглашения',
    description: 'Все заявки на смены — отклики, приглашения, подтверждённые и отменённые.',
    count: (s) => s.applications,
    confirmLabel: 'Очистить отклики',
  },
  {
    scope: 'chats',
    title: 'Чаты и сообщения',
    description: 'Вся переписка между работодателями и соискателями.',
    count: (s) => s.chats,
    confirmLabel: 'Очистить чаты',
  },
  {
    scope: 'notifications',
    title: 'Уведомления',
    description: 'История уведомлений в приложении у всех пользователей.',
    count: (s) => s.notifications,
    confirmLabel: 'Очистить уведомления',
  },
  {
    scope: 'support',
    title: 'Обращения в поддержку',
    description: 'Все тикеты поддержки и переписка по ним.',
    count: (s) => s.supportThreads,
    confirmLabel: 'Очистить обращения',
  },
  {
    scope: 'complaints',
    title: 'Жалобы',
    description: 'Все поданные жалобы на пользователей.',
    count: (s) => s.complaints,
    confirmLabel: 'Очистить жалобы',
  },
  {
    scope: 'auditLog',
    title: 'Журнал действий',
    description: 'История действий команды в этой панели.',
    count: (s) => s.auditLog,
    confirmLabel: 'Очистить журнал',
  },
  {
    scope: 'ratings',
    title: 'Рейтинги и статистика смен',
    description: 'Сбросит рейтинг и счётчик отработанных смен у всех соискателей и работодателей до значений по умолчанию.',
    count: () => null,
    confirmLabel: 'Сбросить рейтинги',
  },
  {
    scope: 'vacancies',
    title: 'Все вакансии и смены',
    description: 'Удалит все опубликованные вакансии вместе с откликами и чатами по ним. Пользователи и команда останутся.',
    count: (s) => s.shifts,
    confirmLabel: 'Удалить вакансии',
    typeToConfirm: 'УДАЛИТЬ ВАКАНСИИ',
  },
  {
    scope: 'users',
    title: 'Все пользователи',
    description: 'Удалит вообще всех соискателей и работодателей вместе со всеми их вакансиями, откликами, чатами и уведомлениями. Команда админки не затрагивается.',
    count: (s) => s.workers + s.companies,
    confirmLabel: 'Удалить всех пользователей',
    typeToConfirm: 'УДАЛИТЬ ВСЕХ',
  },
];

export function DataManagement() {
  const stats = useDataStore((s) => s.stats);
  const load = useDataStore((s) => s.load);
  const clear = useDataStore((s) => s.clear);
  const canManage = useCan('manageData');
  const [confirming, setConfirming] = useState<ClearAction | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pb-10">
      <PageHeader title="Данные" subtitle="Инструменты для очистки тестовых данных — платформа сейчас в тесте" />

      {stats && (
        <div className="px-4 sm:px-8 pb-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Соискатели" value={stats.workers} />
          <StatCard label="Работодатели" value={stats.companies} />
          <StatCard label="Вакансии" value={stats.shifts} />
          <StatCard label="Отклики" value={stats.applications} />
          <StatCard label="Чаты" value={stats.chats} footnote={`${stats.messages} сообщений`} />
          <StatCard label="Уведомления" value={stats.notifications} />
          <StatCard label="Поддержка" value={stats.supportThreads} />
          <StatCard label="Аудит-лог" value={stats.auditLog} />
        </div>
      )}

      <div className="px-4 sm:px-8">
        <Card className="p-6 border-danger/30">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-danger" />
            <SectionLabel className="text-danger">Опасная зона</SectionLabel>
          </div>
          <p className="text-[13px] text-text-muted mb-5 leading-relaxed">
            Эти действия необратимы и выполняются сразу на всей платформе — восстановить удалённое нельзя.
            {!canManage && ' Доступно только владельцу.'}
          </p>

          <div className="divide-y divide-border-soft">
            {ACTIONS.map((action) => {
              const count = stats ? action.count(stats) : null;
              return (
                <div key={action.scope} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-text">
                      {action.title}
                      {count !== null && <span className="text-text-faint font-normal"> · {count}</span>}
                    </p>
                    <p className="text-[13px] text-text-muted mt-0.5 leading-relaxed">{action.description}</p>
                  </div>
                  <Button variant="danger" className="shrink-0" disabled={!canManage} onClick={() => setConfirming(action)}>
                    {action.confirmLabel}
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {confirming && (
        <ConfirmModal
          open
          onClose={() => setConfirming(null)}
          title={confirming.confirmLabel}
          description={confirming.description}
          confirmLabel={confirming.confirmLabel}
          typeToConfirm={confirming.typeToConfirm}
          onConfirm={() => clear(confirming.scope)}
        />
      )}
    </div>
  );
}
