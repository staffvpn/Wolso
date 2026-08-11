import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { useWalletStore } from '@/store/useWalletStore';
import { getShift } from '@/data/shifts';
import { getCompany } from '@/data/companies';
import { formatMoney, isSameDay, weekdayShort } from '@/lib/format';
import { cn } from '@/lib/cn';

export function Shifts() {
  const navigate = useNavigate();
  const applications = useApplicationsStore((s) => s.applications);
  const checkIn = useApplicationsStore((s) => s.checkIn);
  const checkOut = useApplicationsStore((s) => s.checkOut);
  const monthTotal = useWalletStore((s) => s.monthTotal);

  const confirmed = useMemo(
    () => applications.filter((a) => a.status === 'accepted' && a.workStage !== 'reviewed'),
    [applications],
  );
  const shiftsCompletedCount = useMemo(
    () => applications.filter((a) => a.workStage === 'completed' || a.workStage === 'reviewed').length,
    [applications],
  );

  const today = new Date();
  const weekDays = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - today.getDay() + 1 + i);
    return d;
  });

  const withDates = confirmed
    .map((a) => ({ app: a, shift: getShift(a.shiftId) }))
    .filter((x): x is { app: (typeof confirmed)[number]; shift: NonNullable<ReturnType<typeof getShift>> } => !!x.shift)
    .sort((a, b) => a.shift.date.localeCompare(b.shift.date));

  const todays = withDates.filter((x) => isSameDay(new Date(x.shift.date), today));
  const upcoming = withDates.filter((x) => !isSameDay(new Date(x.shift.date), today));

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Мои смены" />

      <div className="px-5 flex gap-3 shrink-0">
        <Card className="flex-1 p-4">
          <p className="text-[22px] font-extrabold">{formatMoney(monthTotal)}</p>
          <p className="text-[12px] text-text-muted mt-0.5">заработано в этом месяце</p>
        </Card>
        <Card className="p-4 min-w-[92px] flex flex-col justify-center items-center">
          <p className="text-[22px] font-extrabold">{shiftsCompletedCount}</p>
          <p className="text-[12px] text-text-muted mt-0.5 text-center">смен отработано</p>
        </Card>
      </div>

      <div className="flex gap-2 px-5 py-4 shrink-0">
        {weekDays.map((d) => {
          const active = isSameDay(d, today);
          const hasShift = withDates.some((x) => isSameDay(new Date(x.shift.date), d));
          return (
            <div
              key={d.toISOString()}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 rounded-2xl py-2.5',
                active ? 'bg-accent text-accent-fg' : 'bg-surface border border-border-soft',
              )}
            >
              <span className={cn('text-[11px] font-medium', active ? 'text-accent-fg/80' : 'text-text-faint')}>{weekdayShort(d)}</span>
              <span className="text-[15px] font-bold">{d.getDate()}</span>
              {hasShift && <span className={cn('h-1 w-1 rounded-full', active ? 'bg-accent-fg' : 'bg-accent')} />}
            </div>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-5">
        {todays.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2.5">Сегодня</p>
            <div className="space-y-3">
              {todays.map(({ app, shift }) => {
                const company = getCompany(shift.companyId);
                return (
                  <motion.div key={app.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-card bg-surface border border-border-soft p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge tone="accent">Через 40 минут</Badge>
                      <span className="text-[13px] text-text-muted">
                        {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')}–{String(shift.endHour).padStart(2, '0')}:{String(shift.endMin).padStart(2, '0')}
                      </span>
                    </div>
                    <p className="font-bold text-[17px]">{shift.positionLabel} · {company.name}</p>
                    <p className="text-[13px] text-text-muted mt-0.5">{company.address} · спросить менеджера</p>

                    <div className="flex items-center gap-2 mt-4">
                      {app.workStage === 'upcoming' && (
                        <Button className="flex-1" onClick={() => checkIn(app.id)}>
                          Отметиться на смене
                        </Button>
                      )}
                      {app.workStage === 'checked_in' && (
                        <Button
                          className="flex-1"
                          onClick={() => {
                            checkOut(app.id);
                            navigate(`/w/checkout/${app.id}`);
                          }}
                        >
                          Завершить смену
                        </Button>
                      )}
                      <Button variant="dark" size="icon" aria-label="Написать">
                        <Mail size={17} />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2.5">Дальше</p>
            <div className="space-y-2.5">
              {upcoming.map(({ app, shift }) => {
                const company = getCompany(shift.companyId);
                const d = new Date(shift.date);
                return (
                  <div key={app.id} className="flex items-center gap-3 rounded-card bg-surface border border-border-soft p-3.5">
                    <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-xl bg-surface-2 py-1.5">
                      <span className="text-[10px] text-text-faint uppercase">{weekdayShort(d)}</span>
                      <span className="text-[15px] font-bold">{d.getDate()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[14px] truncate">{shift.positionLabel} · {company.name}</p>
                      <p className="text-[12px] text-text-muted truncate">
                        {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')}–{String(shift.endHour).padStart(2, '0')}:{String(shift.endMin).padStart(2, '0')} · {formatMoney(shift.totalPay)}
                      </p>
                    </div>
                    <MapPin size={16} className="text-text-faint shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {todays.length === 0 && upcoming.length === 0 && (
          <EmptyState
            title="Нет подтверждённых смен"
            description="Как только работодатель примет ваш отклик, смена появится здесь."
          />
        )}
      </div>
    </div>
  );
}
