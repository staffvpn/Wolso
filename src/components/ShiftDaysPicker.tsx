import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Chip } from '@/components/ui/Chip';
import { formatDays, localDateStr } from '@/lib/format';
import { hapticSelect } from '@/lib/telegram';
import { cn } from '@/lib/cn';

const MONTHS_NOM = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const WEEKDAY_HEADS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function dayString(d: Date) {
  return localDateStr(d);
}

function addDays(iso: string, days: number) {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86400000).toISOString().slice(0, 10);
}

/** Все дни между крайними выбранными, включительно — для «заполнить
 *  промежуток», когда человеку проще ткнуть 13-е и 17-е, чем нажать пять
 *  дней подряд. */
function fill(days: string[]): string[] {
  if (days.length < 2) return days;
  const out: string[] = [];
  for (let d = days[0]; d <= days[days.length - 1]; d = addDays(d, 1)) out.push(d);
  return out;
}

interface Props {
  value: string[];
  onChange: (days: string[]) => void;
  maxDays?: number;
}

/** Выбор дней разовой смены. Календарь, а не «дата + счётчик дней»: тем
 *  счётчиком описывался только сплошной отрезок, и работодателю, которому
 *  человек нужен 13-го и 27-го, приходилось публиковать две отдельные
 *  вакансии и потом сводить одного и того же человека из двух наборов
 *  откликов. Здесь дни просто отмечаются — подряд, вразнобой, как есть. */
export function ShiftDaysPicker({ value, onChange, maxDays = 31 }: Props) {
  const today = useMemo(() => new Date(), []);
  const todayStr = dayString(today);
  const [month, setMonth] = useState(() => {
    const first = value[0] ? new Date(`${value[0]}T00:00:00Z`) : today;
    return new Date(first.getFullYear(), first.getMonth(), 1);
  });

  const selected = new Set(value);

  const firstWeekday = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
  ];

  function toggle(iso: string) {
    hapticSelect();
    if (selected.has(iso)) {
      onChange(value.filter((d) => d !== iso));
      return;
    }
    if (value.length >= maxDays) return;
    onChange([...value, iso].sort());
  }

  function shiftMonth(delta: number) {
    hapticSelect();
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  const filled = fill(value);
  const canFill = value.length >= 2 && filled.length > value.length && filled.length <= maxDays;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <Chip tone="dark" selected={selected.has(todayStr)} onClick={() => toggle(todayStr)}>
          Сегодня
        </Chip>
        <Chip tone="dark" selected={selected.has(addDays(todayStr, 1))} onClick={() => toggle(addDays(todayStr, 1))}>
          Завтра
        </Chip>
        {/* Отметить 13-е и 17-е и нажать одну кнопку быстрее, чем ткнуть
            пять дней подряд. */}
        {canFill && (
          <Chip tone="dark" onClick={() => onChange(filled)}>
            Заполнить подряд
          </Chip>
        )}
        {value.length > 0 && (
          <Chip tone="dark" onClick={() => onChange([])}>
            Очистить
          </Chip>
        )}
      </div>

      <div className="rounded-2xl bg-surface border border-border p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Предыдущий месяц"
            className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center"
          >
            <ChevronLeft size={15} />
          </button>
          <p className="font-semibold text-[14px]">
            {MONTHS_NOM[month.getMonth()]} {month.getFullYear()}
          </p>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Следующий месяц"
            className="h-8 w-8 rounded-full bg-surface-2 flex items-center justify-center"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_HEADS.map((w) => (
            <span key={w} className="text-[10px] text-text-faint text-center py-0.5">{w}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <span key={`blank-${i}`} />;
            const iso = dayString(day);
            // Вчерашний день закрыть некем: смену в прошлое не публикуют.
            const past = iso < todayStr;
            const isSelected = selected.has(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={past}
                aria-pressed={isSelected}
                onClick={() => toggle(iso)}
                className={cn(
                  'aspect-square rounded-xl flex items-center justify-center text-[13px] font-semibold transition-colors',
                  isSelected && 'bg-accent text-accent-fg',
                  !isSelected && !past && 'bg-surface-2 text-text',
                  past && 'text-text-faint opacity-40',
                  !isSelected && !past && iso === todayStr && 'ring-1 ring-accent',
                )}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[13px] mt-2 leading-relaxed">
        {value.length === 0 ? (
          <span className="text-danger">Отметьте хотя бы один день</span>
        ) : (
          <span className="text-text-muted">
            Выбрано {value.length} {value.length === 1 ? 'день' : value.length < 5 ? 'дня' : 'дней'} ·{' '}
            <span className="text-text font-semibold">{formatDays(value, 6)}</span>
          </span>
        )}
      </p>
    </div>
  );
}
