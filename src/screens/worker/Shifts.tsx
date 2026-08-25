import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Mail, Star, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DetailRow } from '@/components/ui/DetailRow';
import { CancelSheet } from '@/components/CancelSheet';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { resolveCompany } from '@/data/companies';
import { formatDateRange, formatDayMonth, formatMoney, isSameDay, weekdayShort } from '@/lib/format';
import { hapticNotify, hapticSelect } from '@/lib/telegram';
import { cn } from '@/lib/cn';
import type { Application, Shift } from '@/types';

const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAY_HEADS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** True if `day` falls anywhere within the shift's date (or date range,
 *  for a multi-day posting) — a shift spanning several days should show
 *  as "today" on every one of those days, and mark all of them on the
 *  calendar, not just its first day. */
function shiftCoversDay(shift: Shift, day: Date) {
  const d = stripTime(day);
  const start = stripTime(new Date(shift.date));
  const end = shift.endDate ? stripTime(new Date(shift.endDate)) : start;
  return d >= start && d <= end;
}

function timeUntil(shift: Shift): string | null {
  const start = new Date(shift.date);
  start.setHours(shift.startHour, shift.startMin, 0, 0);
  const diffMin = Math.round((start.getTime() - Date.now()) / 60000);
  if (diffMin < 0) return 'Уже началась';
  if (diffMin < 60) return `Через ${diffMin} минут`;
  return `Через ${Math.round(diffMin / 60)} ч`;
}

function timeRangeOf(shift: Shift) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(shift.startHour)}:${pad(shift.startMin)}–${pad(shift.endHour)}:${pad(shift.endMin)}`;
}

type Entry = { app: Application; shift: Shift };

export function Shifts() {
  const applications = useApplicationsStore((s) => s.applications);
  const load = useApplicationsStore((s) => s.load);
  const checkIn = useApplicationsStore((s) => s.checkIn);
  const cancelApplication = useApplicationsStore((s) => s.cancelApplication);
  const [cancelling, setCancelling] = useState<Application | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withShift = (list: Application[]): Entry[] =>
    list.map((a) => ({ app: a, shift: a.shift })).filter((x): x is Entry => !!x.shift);

  const confirmed = useMemo(
    () => withShift(applications.filter((a) => a.status === 'accepted' && a.workStage !== 'employer_closed' && a.workStage !== 'reviewed'))
      .sort((a, b) => a.shift.date.localeCompare(b.shift.date)),
    [applications],
  );

  // Shifts the employer has closed — the actual work history, moved here
  // out of "Мои отклики" where a finished shift used to sit forever
  // claiming "Вы подтвердили".
  const completed = useMemo(
    () => withShift(applications.filter((a) => a.workStage === 'employer_closed' || a.workStage === 'reviewed'))
      .sort((a, b) => b.shift.date.localeCompare(a.shift.date)),
    [applications],
  );

  const today = new Date();
  const todays = confirmed.filter((x) => shiftCoversDay(x.shift, today));
  const upcoming = confirmed.filter((x) => !shiftCoversDay(x.shift, today));

  // Everything with a date goes on the calendar, past work included —
  // that's the point of opening it on an old month.
  const allDated = useMemo(() => [...confirmed, ...completed], [confirmed, completed]);

  const totalEarned = useMemo(() => completed.reduce((sum, x) => sum + x.shift.totalPay, 0), [completed]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar
        title="Мои смены"
        right={
          <button
            onClick={() => {
              hapticSelect();
              setCalendarOpen(true);
            }}
            aria-label="Календарь"
            className="h-10 w-10 rounded-full bg-surface-2 flex items-center justify-center"
          >
            <CalendarDays size={18} />
          </button>
        }
      />

      <div className="px-5 flex gap-3 shrink-0">
        <Card className="flex-1 p-4">
          <p className="text-[22px] font-extrabold">{completed.length}</p>
          <p className="text-[12px] text-text-muted mt-0.5">смен отработано</p>
        </Card>
        <Card className="flex-1 p-4">
          <p className="text-[22px] font-extrabold">{confirmed.length}</p>
          <p className="text-[12px] text-text-muted mt-0.5">подтверждённых впереди</p>
        </Card>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-4 space-y-5">
        {todays.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2.5">Сегодня</p>
            <div className="space-y-3">
              {todays.map(({ app, shift }) => {
                const company = resolveCompany(shift);
                return (
                  <motion.div key={app.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-card bg-surface border border-border-soft p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Badge tone="accent">{timeUntil(shift)}</Badge>
                      <span className="text-[13px] text-text-muted">{timeRangeOf(shift)}</span>
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
                        <Badge tone="neutral" className="flex-1 justify-center py-2.5">
                          Ждём, когда работодатель закроет смену
                        </Badge>
                      )}
                      <Button variant="dark" size="icon" aria-label="Написать">
                        <Mail size={17} />
                      </Button>
                    </div>
                    {app.workStage === 'upcoming' && (
                      <button
                        onClick={() => {
                          hapticNotify('warning');
                          setCancelling(app);
                        }}
                        className="text-[13px] font-semibold text-danger mt-3"
                      >
                        Не смогу выйти
                      </button>
                    )}
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
                const company = resolveCompany(shift);
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
                        {shift.endDate ? `${formatDateRange(shift.date, shift.endDate)} · ` : ''}
                        {timeRangeOf(shift)} · {formatMoney(shift.totalPay)}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        hapticNotify('warning');
                        setCancelling(app);
                      }}
                      className="text-[12px] font-semibold text-danger shrink-0"
                    >
                      Отменить
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint">
                Отработанные · {completed.length}
              </p>
              <p className="text-[12px] text-text-faint">заработано {formatMoney(totalEarned)}</p>
            </div>
            <div className="space-y-2.5">
              {completed.map(({ app, shift }) => (
                <CompletedShiftRow key={app.id} app={app} shift={shift} />
              ))}
            </div>
          </div>
        )}

        {todays.length === 0 && upcoming.length === 0 && completed.length === 0 && (
          <EmptyState
            title="Нет подтверждённых смен"
            description="Как только работодатель примет ваш отклик, смена появится здесь."
          />
        )}
      </div>

      <AnimatePresence>
        {calendarOpen && <CalendarOverlay entries={allDated} onClose={() => setCalendarOpen(false)} />}
      </AnimatePresence>

      {cancelling && (
        <CancelSheet
          open
          onClose={() => setCancelling(null)}
          title="Не сможете выйти на смену?"
          description="Работодатель получит уведомление с причиной, чат по этой смене закроется."
          confirmLabel="Отменить смену"
          onSubmit={(reason) => cancelApplication(cancelling.id, reason)}
        />
      )}
    </div>
  );
}

/** A finished shift, with everything about it — where, when, how long, how
 *  much, and the employer's rating once they've left one. Expands to show
 *  their written review rather than truncating it in the row. */
function CompletedShiftRow({ app, shift }: { app: Application; shift: Shift }) {
  const company = resolveCompany(shift);
  const [open, setOpen] = useState(false);
  const d = new Date(shift.date);
  const hours = shift.endHour - shift.startHour;

  return (
    <div className="rounded-card bg-surface border border-border-soft overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-3.5 text-left">
        <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-xl bg-surface-2 py-1.5">
          <span className="text-[10px] text-text-faint uppercase">{weekdayShort(d)}</span>
          <span className="text-[15px] font-bold">{d.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[14px] truncate">{shift.positionLabel} · {company.name}</p>
          <p className="text-[12px] text-text-muted truncate">
            {formatDateRange(shift.date, shift.endDate)} · {timeRangeOf(shift)} · {formatMoney(shift.totalPay)}
          </p>
        </div>
        <ChevronRight size={16} className={cn('text-text-faint shrink-0 transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 -mt-1 space-y-2.5">
          <div className="rounded-xl bg-surface-2 px-3 py-2.5 space-y-1">
            <DetailRow label="Заведение" value={company.name} />
            {company.address && <DetailRow label="Адрес" value={company.address} />}
            <DetailRow label="Должность" value={shift.positionLabel} />
            <DetailRow label="Дата" value={formatDateRange(shift.date, shift.endDate)} />
            <DetailRow label="Время" value={`${timeRangeOf(shift)} · ${hours} ч`} />
            <DetailRow label="Ставка" value={`${formatMoney(shift.hourlyRate)}/ч`} />
            <DetailRow label="Итого" value={formatMoney(shift.totalPay)} />
          </div>

          {app.workStage === 'employer_closed' && (
            <Badge tone="warning" className="w-full justify-center py-2">
              Оставьте отзыв о работодателе
            </Badge>
          )}
          {app.workStage === 'reviewed' && (
            <div className="flex items-center gap-1.5 text-[12px] text-text-faint">
              <Star size={12} className="fill-accent text-accent" /> Вы уже оставили отзыв
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A real month calendar: days with shifts are marked, tapping one lists
 *  everything on it. Replaces a fixed six-day strip that couldn't be
 *  scrolled or tapped and only ever showed the current week. */
function CalendarOverlay({ entries, onClose }: { entries: Entry[]; onClose: () => void }) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(today);

  // Monday-first grid: how many blanks before the 1st, and how many days.
  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  const shiftsOn = (day: Date) => entries.filter((e) => shiftCoversDay(e.shift, day));
  const selectedShifts = selected ? shiftsOn(selected) : [];

  function shiftMonth(delta: number) {
    hapticSelect();
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      className="absolute inset-0 z-[300] bg-bg flex flex-col safe-top safe-bottom"
    >
      <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
        <h2 className="text-[18px] font-bold">Календарь смен</h2>
        <button onClick={onClose} aria-label="Закрыть" className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center">
          <X size={17} />
        </button>
      </div>

      <div className="flex items-center justify-between px-5 py-2 shrink-0">
        <button onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц" className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center">
          <ChevronLeft size={17} />
        </button>
        <p className="font-semibold text-[15px]">
          {MONTHS_NOM[month.getMonth()]} {month.getFullYear()}
        </p>
        <button onClick={() => shiftMonth(1)} aria-label="Следующий месяц" className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center">
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="px-5 shrink-0">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_HEADS.map((w) => (
            <span key={w} className="text-[11px] text-text-faint text-center py-1">{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <span key={`blank-${i}`} />;
            const count = shiftsOn(day).length;
            const isToday = isSameDay(day, today);
            const isSelected = selected != null && isSameDay(day, selected);
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  hapticSelect();
                  setSelected(day);
                }}
                className={cn(
                  'aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-[14px] font-semibold transition-colors',
                  count > 0 && !isSelected && 'bg-accent text-accent-fg',
                  count === 0 && !isSelected && 'bg-surface text-text-muted',
                  isSelected && 'bg-text text-bg',
                  isToday && !isSelected && count === 0 && 'ring-1 ring-accent',
                )}
              >
                {day.getDate()}
                {count > 1 && (
                  <span className={cn('text-[9px] font-bold leading-none', isSelected ? 'text-bg/70' : 'text-accent-fg/80')}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-4">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2.5">
          {selected ? formatDayMonth(selected) : 'Выберите день'}
        </p>

        {selectedShifts.length === 0 && (
          <p className="text-[13px] text-text-faint">В этот день смен нет.</p>
        )}

        <div className="space-y-2.5">
          {selectedShifts.map(({ app, shift }) => {
            const company = resolveCompany(shift);
            const done = app.workStage === 'employer_closed' || app.workStage === 'reviewed';
            return (
              <div key={app.id} className="rounded-card bg-surface border border-border-soft p-3.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-semibold text-[14px] truncate">{shift.positionLabel} · {company.name}</p>
                  <Badge tone={done ? 'neutral' : 'accent'}>{done ? 'Отработана' : 'Подтверждена'}</Badge>
                </div>
                <p className="text-[12px] text-text-muted">
                  {timeRangeOf(shift)} · {formatMoney(shift.totalPay)}
                </p>
                {company.address && <p className="text-[12px] text-text-faint mt-0.5 truncate">{company.address}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
