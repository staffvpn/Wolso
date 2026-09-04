import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Mail, Plus, Star, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { DetailRow } from '@/components/ui/DetailRow';
import { CancelSheet } from '@/components/CancelSheet';
import { PersonalShiftSheet } from '@/components/PersonalShiftSheet';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { usePersonalShiftsStore } from '@/store/usePersonalShiftsStore';
import { resolveCompany } from '@/data/companies';
import { foundViaLabel } from '@/data/foundVia';
import { formatDateRange, formatDayMonth, formatMoney, isSameDay, localDateStr, weekdayShort } from '@/lib/format';
import { hapticNotify, hapticSelect } from '@/lib/telegram';
import { cn } from '@/lib/cn';
import type { Application, PersonalShift, Shift } from '@/types';

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

/** Одна запись календаря. Источник — часть типа, а не поле-флаг: так
 *  ни один экран не может случайно показать личную смену как работу через
 *  Wolso, потому что у неё просто нет ни отклика, ни компании. */
type Entry =
  | { source: 'wolso'; app: Application; shift: Shift }
  | { source: 'personal'; personal: PersonalShift };

function entryKey(e: Entry) {
  return e.source === 'wolso' ? `w:${e.app.id}` : `p:${e.personal.id}`;
}

function entryDate(e: Entry) {
  return e.source === 'wolso' ? e.shift.date : e.personal.date;
}

/** Отработана ли запись. У смены Wolso это решает работодатель, закрывая
 *  её; у личной — сам человек кнопкой «Отработал». По дате это больше не
 *  выводится: смену переносят, срывают и просто не выходят, а календарь
 *  всё равно записывал её в отработанные и в заработок за месяц. */
function entryDone(e: Entry) {
  if (e.source === 'wolso') return e.app.workStage === 'employer_closed' || e.app.workStage === 'reviewed';
  return e.personal.status === 'worked';
}

function entryCoversDay(e: Entry, day: Date) {
  if (e.source === 'wolso') return shiftCoversDay(e.shift, day);
  return stripTime(new Date(e.personal.date)) === stripTime(day);
}

function entryPay(e: Entry) {
  return e.source === 'wolso' ? e.shift.totalPay : e.personal.pay;
}

function entryHours(e: Entry) {
  const s = e.source === 'wolso' ? e.shift : e.personal;
  return Math.max(0, s.endHour - s.startHour);
}

function personalTimeRange(p: PersonalShift) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(p.startHour)}:${pad(p.startMin)}–${pad(p.endHour)}:${pad(p.endMin)}`;
}

/** Чем красить день в календаре. Цвет говорит про источник: зелёный —
 *  работа через Wolso, синий — своя. Заливка говорит про статус:
 *  отработанный день закрашен целиком, запланированный только подсвечен —
 *  так «что уже было» и «что ещё предстоит» различимы, не отнимая у цвета
 *  его единственное значение. День, где есть и то и другое, красится
 *  пополам, а не выбирает победителя. */
function dayClasses(dayEntries: Entry[]): string {
  const hasWolso = dayEntries.some((e) => e.source === 'wolso');
  const hasPersonal = dayEntries.some((e) => e.source === 'personal');
  const worked = dayEntries.some(entryDone);

  if (hasWolso && hasPersonal) {
    return worked
      ? 'bg-[linear-gradient(135deg,var(--color-accent)_0_50%,var(--color-info)_50%_100%)] text-accent-fg'
      : 'bg-[linear-gradient(135deg,var(--color-accent-soft)_0_50%,var(--color-info-soft)_50%_100%)] text-text';
  }
  if (hasPersonal) return worked ? 'bg-info text-info-fg' : 'bg-info-soft text-info ring-1 ring-info/40';
  return worked ? 'bg-accent text-accent-fg' : 'bg-accent-soft text-accent ring-1 ring-accent/40';
}

export function Shifts() {
  const applications = useApplicationsStore((s) => s.applications);
  const load = useApplicationsStore((s) => s.load);
  const checkIn = useApplicationsStore((s) => s.checkIn);
  const cancelApplication = useApplicationsStore((s) => s.cancelApplication);
  const personal = usePersonalShiftsStore((s) => s.shifts);
  const loadPersonal = usePersonalShiftsStore((s) => s.load);
  const updatePersonal = usePersonalShiftsStore((s) => s.update);
  const [cancelling, setCancelling] = useState<Application | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [personalSheet, setPersonalSheet] = useState<{ editing: PersonalShift | null; date?: string } | null>(null);

  useEffect(() => {
    load();
    loadPersonal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Отметить личную смену отработанной — из карточки или строки, без
   *  открытия формы. Ошибку глушим: список останется как был, и человек
   *  увидит, что переключение не сработало. */
  function markWorked(shift: PersonalShift) {
    hapticNotify('success');
    void updatePersonal(shift.id, { status: 'worked' }).catch(() => {});
  }

  const withShift = (list: Application[]): Entry[] =>
    list
      .map((a) => (a.shift ? ({ source: 'wolso', app: a, shift: a.shift } as Entry) : null))
      .filter((x): x is Entry => x !== null);

  const confirmed = useMemo(
    () => withShift(applications.filter((a) => a.status === 'accepted' && a.workStage !== 'employer_closed' && a.workStage !== 'reviewed'))
      .sort((a, b) => entryDate(a).localeCompare(entryDate(b))),
    [applications],
  );

  // Shifts the employer has closed — the actual work history, moved here
  // out of "Мои отклики" where a finished shift used to sit forever
  // claiming "Вы подтвердили".
  const completed = useMemo(
    () => withShift(applications.filter((a) => a.workStage === 'employer_closed' || a.workStage === 'reviewed'))
      .sort((a, b) => entryDate(b).localeCompare(entryDate(a))),
    [applications],
  );

  const today = new Date();

  // Личные смены — те же записи календаря, просто другого происхождения.
  // Разделение на «впереди» и «отработана» у них по статусу, который
  // человек ставит сам: подтверждать их некому.
  const personalEntries = useMemo<Entry[]>(() => personal.map((p) => ({ source: 'personal', personal: p })), [personal]);
  const personalUpcoming = useMemo(
    () => personalEntries.filter((e) => !entryDone(e)).sort((a, b) => entryDate(a).localeCompare(entryDate(b))),
    [personalEntries],
  );
  const personalDone = useMemo(
    () => personalEntries.filter((e) => entryDone(e)).sort((a, b) => entryDate(b).localeCompare(entryDate(a))),
    [personalEntries],
  );

  // Списки на экране объединённые: человеку нужен его рабочий день целиком,
  // а не отдельно «через Wolso» и отдельно «своё». Источник виден на самой
  // карточке меткой.
  const allUpcoming = useMemo(
    () => [...confirmed, ...personalUpcoming].sort((a, b) => entryDate(a).localeCompare(entryDate(b))),
    [confirmed, personalUpcoming],
  );
  const allCompleted = useMemo(
    () => [...completed, ...personalDone].sort((a, b) => entryDate(b).localeCompare(entryDate(a))),
    [completed, personalDone],
  );

  const todays = allUpcoming.filter((e) => entryCoversDay(e, today));
  const upcoming = allUpcoming.filter((e) => !entryCoversDay(e, today));

  // Everything with a date goes on the calendar, past work included —
  // that's the point of opening it on an old month.
  const allDated = useMemo(() => [...allUpcoming, ...allCompleted], [allUpcoming, allCompleted]);

  const totalEarned = useMemo(() => allCompleted.reduce((sum, e) => sum + entryPay(e), 0), [allCompleted]);

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
          <p className="text-[22px] font-extrabold">{allCompleted.length}</p>
          <p className="text-[12px] text-text-muted mt-0.5">смен отработано</p>
        </Card>
        <Card className="flex-1 p-4">
          <p className="text-[22px] font-extrabold">{allUpcoming.length}</p>
          <p className="text-[12px] text-text-muted mt-0.5">смен впереди</p>
        </Card>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 pb-4 space-y-5">
        {todays.length > 0 && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2.5">Сегодня</p>
            <div className="space-y-3">
              {todays.map((entry) => {
                if (entry.source === 'personal') {
                  return (
                    <PersonalShiftCard
                      key={entryKey(entry)}
                      shift={entry.personal}
                      onEdit={() => setPersonalSheet({ editing: entry.personal })}
                      onMarkWorked={() => markWorked(entry.personal)}
                    />
                  );
                }
                const { app, shift } = entry;
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
              {upcoming.map((entry) => {
                if (entry.source === 'personal') {
                  return (
                    <PersonalShiftRow
                      key={entryKey(entry)}
                      shift={entry.personal}
                      onEdit={() => setPersonalSheet({ editing: entry.personal })}
                      onMarkWorked={() => markWorked(entry.personal)}
                    />
                  );
                }
                const { app, shift } = entry;
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

        {allCompleted.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-2.5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint">
                Отработанные · {allCompleted.length}
              </p>
              <p className="text-[12px] text-text-faint">заработано {formatMoney(totalEarned)}</p>
            </div>
            <div className="space-y-2.5">
              {allCompleted.map((entry) =>
                entry.source === 'personal' ? (
                  <PersonalShiftRow
                    key={entryKey(entry)}
                    shift={entry.personal}
                    onEdit={() => setPersonalSheet({ editing: entry.personal })}
                  />
                ) : (
                  <CompletedShiftRow key={entryKey(entry)} app={entry.app} shift={entry.shift} />
                ),
              )}
            </div>
          </div>
        )}

        {todays.length === 0 && upcoming.length === 0 && allCompleted.length === 0 && (
          <EmptyState
            title="Смен пока нет"
            description="Как только работодатель примет ваш отклик, смена появится здесь. А работу, которую вы нашли сами, можно занести кнопкой ниже."
          />
        )}
      </div>

      <AnimatePresence>
        {calendarOpen && (
          <CalendarOverlay
            entries={allDated}
            onClose={() => setCalendarOpen(false)}
            onAddPersonal={(date) => setPersonalSheet({ editing: null, date })}
            onEditPersonal={(shift) => setPersonalSheet({ editing: shift })}
          />
        )}
      </AnimatePresence>

      {/* Своя смена добавляется отсюда и из календаря: человек заносит её
          либо сразу после разговора, либо когда планирует неделю. */}
      <div className="px-5 pb-4 pt-1 shrink-0">
        <Button variant="dark" fullWidth onClick={() => setPersonalSheet({ editing: null })}>
          <Plus size={17} /> Добавить свою смену
        </Button>
      </div>

      <PersonalShiftSheet
        open={personalSheet !== null}
        editing={personalSheet?.editing}
        defaultDate={personalSheet?.date}
        onClose={() => setPersonalSheet(null)}
      />

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
function CalendarOverlay({
  entries,
  onClose,
  onAddPersonal,
  onEditPersonal,
}: {
  entries: Entry[];
  onClose: () => void;
  onAddPersonal: (date: string) => void;
  onEditPersonal: (shift: PersonalShift) => void;
}) {
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

  const shiftsOn = (day: Date) => entries.filter((e) => entryCoversDay(e, day));
  const selectedShifts = selected ? shiftsOn(selected) : [];

  /** Итоги за показанный месяц, с разделением по источнику. Считается по
   *  тому же списку, который рисует сетку, поэтому цифры под календарём и
   *  отметки на нём не могут разойтись. В счёт идут только отработанные:
   *  запланированная смена — это ещё не заработок. */
  const monthStats = useMemo(() => {
    const inMonth = entries.filter((e) => {
      const d = new Date(entryDate(e));
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth() && entryDone(e);
    });
    const wolso = inMonth.filter((e) => e.source === 'wolso');
    const own = inMonth.filter((e) => e.source === 'personal');
    return {
      days: new Set(inMonth.map((e) => entryDate(e))).size,
      wolsoCount: wolso.length,
      personalCount: own.length,
      hours: inMonth.reduce((sum, e) => sum + entryHours(e), 0),
      wolsoPay: wolso.reduce((sum, e) => sum + entryPay(e), 0),
      personalPay: own.reduce((sum, e) => sum + entryPay(e), 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, month]);

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
        <h2 className="text-[18px] font-bold">Рабочий календарь</h2>
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
            const dayEntries = shiftsOn(day);
            const count = dayEntries.length;
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
                  count > 0 && !isSelected && dayClasses(dayEntries),
                  count === 0 && !isSelected && 'bg-surface text-text-muted',
                  isSelected && 'bg-text text-bg',
                  isToday && !isSelected && count === 0 && 'ring-1 ring-accent',
                )}
              >
                {day.getDate()}
                {count > 1 && <span className="text-[9px] font-bold leading-none opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Легенда: цвет в календаре ничего не значит, пока не сказано, что
            он значит. Четыре состояния — ровно те, что рисует dayClasses. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2.5">
          <LegendDot className="bg-accent" label="Wolso — отработана" />
          <LegendDot className="bg-accent-soft ring-1 ring-accent/40" label="Wolso — впереди" />
          <LegendDot className="bg-info" label="Своя — отработана" />
          <LegendDot className="bg-info-soft ring-1 ring-info/40" label="Своя — впереди" />
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
          {selectedShifts.map((entry) => {
            if (entry.source === 'personal') {
              const p = entry.personal;
              return (
                <button
                  key={entryKey(entry)}
                  onClick={() => onEditPersonal(p)}
                  className="w-full text-left rounded-card bg-surface border border-dashed border-info/40 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="font-semibold text-[14px] truncate">{p.positionLabel} · {p.placeName}</p>
                    {/* Источник виден на каждой карточке: личная смена не
                        должна выглядеть как работа через Wolso. */}
                    <Badge tone="info">{p.status === 'worked' ? 'Своя · отработана' : 'Своя'}</Badge>
                  </div>
                  <p className="text-[12px] text-text-muted">
                    {personalTimeRange(p)}
                    {p.pay > 0 ? ` · ${formatMoney(p.pay)}` : ''}
                    {p.foundVia ? ` · ${foundViaLabel(p.foundVia)}` : ''}
                  </p>
                  {p.address && <p className="text-[12px] text-text-faint mt-0.5 truncate">{p.address}</p>}
                </button>
              );
            }
            const { app, shift } = entry;
            const company = resolveCompany(shift);
            const done = app.workStage === 'employer_closed' || app.workStage === 'reviewed';
            return (
              <div key={entryKey(entry)} className="rounded-card bg-surface border border-border-soft p-3.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-semibold text-[14px] truncate">{shift.positionLabel} · {company.name}</p>
                  <Badge tone={done ? 'neutral' : 'accent'}>{done ? 'Отработана' : 'Wolso'}</Badge>
                </div>
                <p className="text-[12px] text-text-muted">
                  {timeRangeOf(shift)} · {formatMoney(shift.totalPay)}
                </p>
                {company.address && <p className="text-[12px] text-text-faint mt-0.5 truncate">{company.address}</p>}
              </div>
            );
          })}
        </div>

        {selected && (
          <Button
            variant="dark"
            fullWidth
            className="mt-3"
            onClick={() => onAddPersonal(localDateStr(selected))}
          >
            <Plus size={16} /> Добавить свою смену
          </Button>
        )}

        {/* Итог месяца — под днём, а не наверху: сначала «что сегодня»,
            потом «сколько за месяц». */}
        <div className="mt-6 rounded-card bg-surface border border-border-soft p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-3">
            {MONTHS_NOM[month.getMonth()]} · итого
          </p>
          {monthStats.days === 0 ? (
            <p className="text-[13px] text-text-faint">В этом месяце отработанных смен пока нет.</p>
          ) : (
            <div className="space-y-1.5 text-[13px]">
              <div className="flex justify-between">
                <span className="text-text-muted">Рабочих дней</span>
                <span className="font-semibold">{monthStats.days}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Смен через Wolso</span>
                <span className="font-semibold">{monthStats.wolsoCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Личных смен</span>
                <span className="font-semibold">{monthStats.personalCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Часов</span>
                <span className="font-semibold">{monthStats.hours}</span>
              </div>
              <div className="h-px bg-border-soft my-2" />
              <div className="flex justify-between">
                <span className="text-text-muted">Wolso</span>
                <span className="font-semibold">{formatMoney(monthStats.wolsoPay)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Личные смены</span>
                <span className="font-semibold">{formatMoney(monthStats.personalPay)}</span>
              </div>
              <div className="flex justify-between text-[15px] pt-1">
                <span className="font-bold">Всего</span>
                <span className="font-extrabold">{formatMoney(monthStats.wolsoPay + monthStats.personalPay)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-text-faint">
      <span className={cn('h-2.5 w-2.5 rounded-[4px]', className)} />
      {label}
    </span>
  );
}

/** Личная смена на сегодня. Намеренно без кнопок «отметиться» и «не смогу
 *  выйти»: отмечаться не перед кем, отменять — тем более. Отметить
 *  отработанной можно прямо отсюда — ради одного переключателя открывать
 *  форму незачем. */
function PersonalShiftCard({ shift, onEdit, onMarkWorked }: { shift: PersonalShift; onEdit: () => void; onMarkWorked: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-card bg-surface border border-dashed border-info/40 p-4"
    >
      <button onClick={onEdit} className="w-full text-left">
        <div className="flex items-center justify-between mb-3">
          <Badge tone="info">Своя смена</Badge>
          <span className="text-[13px] text-text-muted">{personalTimeRange(shift)}</span>
        </div>
        <p className="font-bold text-[17px]">{shift.positionLabel} · {shift.placeName}</p>
        {shift.address && <p className="text-[13px] text-text-muted mt-0.5">{shift.address}</p>}
        {shift.pay > 0 && <p className="text-[13px] text-text-muted mt-0.5">{formatMoney(shift.pay)}</p>}
        {shift.foundVia && <p className="text-[13px] text-text-faint mt-0.5">Нашли: {foundViaLabel(shift.foundVia)}</p>}
        {shift.notes && <p className="text-[13px] text-text-faint mt-2 whitespace-pre-line">{shift.notes}</p>}
      </button>

      {shift.status === 'planned' ? (
        <Button variant="dark" fullWidth className="mt-3" onClick={onMarkWorked}>
          <Check size={17} /> Отработал
        </Button>
      ) : (
        <p className="text-[12px] text-text-faint mt-3">Отмечена как отработанная · нажмите, чтобы изменить</p>
      )}
    </motion.div>
  );
}

/** Компактная строка личной смены — и в «Дальше», и в «Отработанных».
 *  Пунктирная синяя рамка и метка «Своя» отличают её от смены Wolso с
 *  одного взгляда: выдавать своё за работу через платформу нельзя. */
function PersonalShiftRow({ shift, onEdit, onMarkWorked }: { shift: PersonalShift; onEdit: () => void; onMarkWorked?: () => void }) {
  const d = new Date(shift.date);
  return (
    <div className="flex items-center gap-3 rounded-card bg-surface border border-dashed border-info/40 p-3.5">
      <button onClick={onEdit} className="min-w-0 flex-1 text-left flex items-center gap-3">
        <div className="flex flex-col items-center justify-center w-11 shrink-0 rounded-xl bg-surface-2 py-1.5">
          <span className="text-[10px] text-text-faint uppercase">{weekdayShort(d)}</span>
          <span className="text-[15px] font-bold">{d.getDate()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[14px] truncate">{shift.positionLabel} · {shift.placeName}</p>
          <p className="text-[12px] text-text-muted truncate">
            {personalTimeRange(shift)}
            {shift.pay > 0 ? ` · ${formatMoney(shift.pay)}` : ''}
            {shift.foundVia ? ` · ${foundViaLabel(shift.foundVia)}` : ''}
          </p>
        </div>
      </button>
      {/* «Отработал» одной кнопкой — там, где смена ещё запланирована.
          У отработанной остаётся только метка. */}
      {shift.status === 'planned' && onMarkWorked ? (
        <button
          onClick={onMarkWorked}
          className="shrink-0 h-9 px-3 rounded-xl bg-info-soft text-info text-[12px] font-semibold flex items-center gap-1"
        >
          <Check size={14} /> Отработал
        </button>
      ) : (
        <Badge tone="info" className="shrink-0">Своя</Badge>
      )}
    </div>
  );
}
