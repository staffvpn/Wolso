import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, User, Users } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionLabel } from '@/components/ui/Card';
import { ShiftDaysPicker } from '@/components/ShiftDaysPicker';
import { POSITIONS, MARKET_AVG_RATE } from '@/data/positions';
import { useEmployerStore } from '@/store/useEmployerStore';
import { formatDays, localDateStr, pluralizeShifts, shiftDays } from '@/lib/format';
import { ApiError } from '@/lib/apiClient';
import { EMPLOYMENT_TYPES } from '@/data/employmentTypes';
import { cn } from '@/lib/cn';
import type { EmploymentType, Position } from '@/types';

const KEY_POSITIONS = POSITIONS.slice(0, 8);
const REQUIREMENT_POOL = ['Опыт от 1 года', 'Медкнижка', 'Без опыта', 'Своя форма'];
/** Дольше месяца одной разовой вакансией — это уже постоянная работа, для
 *  которой рядом есть свой тип. Тот же предел стоит на сервере. */
const MAX_DAYS = 31;

const TODAY = localDateStr();

/** Doubles as the edit form: same fields, same rules, so a posting can't be
 *  created one way and corrected another. With :vacancyId in the URL it
 *  loads that vacancy's values and saves over it instead of publishing a
 *  new one. */
export function NewVacancy() {
  const navigate = useNavigate();
  const { vacancyId } = useParams<{ vacancyId: string }>();
  const createVacancy = useEmployerStore((s) => s.createVacancy);
  const updateVacancy = useEmployerStore((s) => s.updateVacancy);
  const vacancies = useEmployerStore((s) => s.vacancies);
  const loadAll = useEmployerStore((s) => s.loadAll);
  const editing = vacancyId ? vacancies.find((v) => v.id === vacancyId) : undefined;

  const [position, setPosition] = useState<Position>('barista');
  // No default: the employer has to say whether this is a one-off shift or
  // an ongoing job before they can publish — it changes what the posting
  // means, and guessing 'shift' for them was hiding that choice entirely.
  const [employmentType, setEmploymentType] = useState<EmploymentType | null>(null);
  /** Дни разовой смены — произвольный набор, не отрезок: работодателю
   *  бывает нужен человек 13-го и 27-го, и это одна вакансия. */
  const [selectedDays, setSelectedDays] = useState<string[]>([TODAY]);
  /** Один человек на все выбранные дни — или на каждый день свой. Второе
   *  публикует по вакансии на день, каждую со своими откликами. */
  const [splitPerDay, setSplitPerDay] = useState(false);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(19);
  const [rate, setRate] = useState(450);
  const [requirements, setRequirements] = useState<string[]>(['Опыт от 1 года', 'Медкнижка']);
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The vacancy list may not be in the store yet on a cold open of the edit
  // URL (a reload, or a link followed straight in).
  useEffect(() => {
    if (vacancyId && !editing) loadAll();
  }, [vacancyId, editing, loadAll]);

  // Fill the form from the vacancy being edited, once. Keyed on the id so
  // it doesn't fight the user's own typing on every re-render.
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  useEffect(() => {
    if (!editing || filledFrom === editing.id) return;
    setPosition(editing.position);
    setEmploymentType(editing.employmentType ?? 'shift');
    setSelectedDays(shiftDays(editing));
    // Правится всегда одна конкретная вакансия: разложить её задним числом
    // на несколько отдельных нельзя, не потеряв уже собранные отклики.
    setSplitPerDay(false);
    setStartHour(editing.startHour);
    setEndHour(editing.endHour);
    setRate(editing.hourlyRate);
    setRequirements(editing.requirements ?? []);
    setDescription(editing.description);
    setFilledFrom(editing.id);
  }, [editing, filledFrom]);

  const marketAvg = MARKET_AVG_RATE[position];
  const positionLabel = POSITIONS.find((p) => p.id === position)!.label;
  const days = selectedDays.length;
  const startDate = selectedDays[0] ?? TODAY;
  const endDate = days > 1 ? selectedDays[days - 1]! : startDate;

  /** An ongoing job isn't tied to a day the way a shift is — asking "когда"
   *  only makes sense for a one-off, so the dates appear only once «Смена»
   *  is picked (the type starts unchosen, and a date section for a posting
   *  whose kind isn't decided yet is just noise). Switching to «Постоянная
   *  работа» also resets whatever dates were already chosen, so a stale
   *  range can't be published from a section that's no longer visible. */
  const isShift = employmentType === 'shift';
  const isPermanent = employmentType === 'permanent';

  function chooseEmploymentType(id: EmploymentType) {
    setEmploymentType(id);
    if (id === 'permanent') {
      setSelectedDays([TODAY]);
      setSplitPerDay(false);
    }
  }

  function toggleRequirement(r: string) {
    setRequirements((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  /** По умолчанию — одна вакансия на все выбранные дни: «нужен человек на
   *  13-е, 14-е и 15-е» это один человек и один набор откликов, а не три
   *  отдельные смены. Когда на каждый день нужен свой человек, работодатель
   *  говорит это явно (splitPerDay), и тогда публикуется по вакансии на
   *  день — со своими откликами у каждой. */
  async function publish() {
    if (!employmentType) return;
    if (isShift && selectedDays.length === 0) {
      setError('Отметьте хотя бы один день.');
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      if (editing) {
        await updateVacancy(editing.id, {
          position,
          positionLabel,
          date: startDate,
          endDate: days > 1 ? endDate : null,
          dates: isShift ? selectedDays : undefined,
          startHour,
          endHour,
          hourlyRate: rate,
          requirements,
          employmentType,
          description: description.trim(),
        });
        navigate(`/e/vacancies/${editing.id}`, { replace: true });
        return;
      }

      const vac = await createVacancy({
        position,
        positionLabel,
        date: startDate,
        endDate: days > 1 ? endDate : undefined,
        dates: isShift ? selectedDays : undefined,
        splitPerDay: isShift && days > 1 ? splitPerDay : false,
        startHour,
        startMin: 0,
        endHour,
        endMin: 0,
        hourlyRate: rate,
        requirements,
        employmentType,
        description: description.trim(),
        urgent: false, // paid feature — locked for now, see the toggle below
      });
      navigate(`/e/vacancies/${vac.id}`, { replace: true });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(
        code === 'not_editable'
          ? 'Смена уже закрыта — её условия менять нельзя.'
          : code === 'migration_required'
            ? // Сервер отказался разносить дни с пропусками, а не растянул их
              // в две недели подряд: пусть лучше не опубликуется, чем
              // опубликуется не то. Подряд идущие дни при этом работают.
              'Смены на разные дни с пропусками пока не включены на сервере. Выберите дни подряд или напишите в поддержку.'
            : code === 'rate_limited'
              ? 'Слишком много вакансий за час. Попробуйте позже или опубликуйте меньше дней сразу.'
              : 'Не получилось сохранить. Попробуйте ещё раз.',
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title={editing ? 'Редактировать' : 'Новая смена'} onBack={() => navigate(-1)} />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 space-y-6">
        <div>
          <SectionLabel>Кто нужен</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {KEY_POSITIONS.map((p) => (
              <Chip key={p.id} selected={position === p.id} onClick={() => setPosition(p.id)}>
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>
            Тип работы <span className="text-danger">*</span>
          </SectionLabel>
          <div className="flex flex-wrap gap-2">
            {EMPLOYMENT_TYPES.map((et) => (
              <Chip key={et.id} selected={employmentType === et.id} onClick={() => chooseEmploymentType(et.id)}>
                {et.label}
              </Chip>
            ))}
          </div>
        </div>

        {employmentType && (
        <div>
          <SectionLabel>{isPermanent ? 'График работы' : 'Когда'}</SectionLabel>
          {isPermanent && (
            <p className="text-[13px] text-text-muted mb-3 leading-relaxed">
              У постоянной работы нет конкретного дня, но часы всё равно нужны — по ним считается оплата, и соискатель
              сразу видит, во сколько выходить
            </p>
          )}
          {isShift && (
          <>
          <p className="text-[13px] text-text-muted mb-3 leading-relaxed">
            Отметьте все дни, когда нужен человек — подряд или вразнобой. 13-е и 27-е это одна вакансия, а не две
          </p>

          <ShiftDaysPicker value={selectedDays} onChange={setSelectedDays} maxDays={MAX_DAYS} />

          {/* Вопрос возникает только когда дней больше одного, и он
              настоящий: одна вакансия на все дни — это один человек и один
              набор откликов, отдельные вакансии — свой человек на каждый
              день. Раньше выбора не было, и второй вариант приходилось
              собирать руками из нескольких публикаций. */}
          {days > 1 && !editing && (
            <div className="mt-4">
              <p className="text-[13px] text-text-muted mb-2 leading-relaxed">Кто нужен на эти дни?</p>
              <div className="flex flex-col gap-2">
                <CoverageOption
                  active={!splitPerDay}
                  icon={<User size={16} />}
                  title="Один человек на все дни"
                  hint={`Одна вакансия · ${formatDays(selectedDays, 4)}`}
                  onClick={() => setSplitPerDay(false)}
                />
                <CoverageOption
                  active={splitPerDay}
                  icon={<Users size={16} />}
                  title="На каждый день свой человек"
                  hint={`${days} ${pluralizeShifts(days)}, у каждой свои отклики`}
                  onClick={() => setSplitPerDay(true)}
                />
              </div>
            </div>
          )}
          {days > 1 && editing && (
            <p className="text-[12px] text-text-faint mt-2 leading-relaxed">
              У опубликованной вакансии можно менять дни, но не разделять её на отдельные — иначе уже собранные отклики
              оказались бы неизвестно к какому дню
            </p>
          )}
          <div className="h-3" />
          </>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-2xl bg-surface border border-border px-3.5 py-3">
              <p className="text-[11px] text-text-faint mb-1">Начало</p>
              <input
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) => setStartHour(Number(e.target.value))}
                className="bg-transparent w-full outline-none font-bold text-[16px]"
              />
            </div>
            <div className="flex-1 rounded-2xl bg-surface border border-border px-3.5 py-3">
              <p className="text-[11px] text-text-faint mb-1">Конец</p>
              <input
                type="number"
                min={0}
                max={23}
                value={endHour}
                onChange={(e) => setEndHour(Number(e.target.value))}
                className="bg-transparent w-full outline-none font-bold text-[16px]"
              />
            </div>
          </div>
        </div>
        )}

        <div>
          <SectionLabel>Оплата</SectionLabel>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[28px] font-extrabold">{rate} ₽</span>
            {/* The hours are now asked for whichever type is picked, so the
                derived total is always real — only its wording changes:
                an ongoing job is paid per working day, not per shift. */}
            <span className="text-[13px] text-text-muted">
              в час
              {employmentType && ` · ${rate * (endHour - startHour)} ₽ ${isPermanent ? 'за день' : 'за смену'}`}
            </span>
          </div>
          <Slider min={200} max={1000} step={10} value={rate} onChange={setRate} className="mt-3" />
          <p className="text-accent text-[13px] font-medium mt-2">
            Средняя ставка по позиции «{positionLabel}» рядом — {marketAvg} ₽
          </p>
        </div>

        <div>
          <SectionLabel>Требования</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {REQUIREMENT_POOL.map((r) => (
              <Chip key={r} tone="dark" selected={requirements.includes(r)} onClick={() => toggleRequirement(r)}>
                {r}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Описание</SectionLabel>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Что нужно будет делать, какие навыки пригодятся — соискатели видят это в карточке смены"
            rows={4}
            className="w-full rounded-2xl bg-surface border border-border p-3.5 text-[14px] text-text placeholder:text-text-faint resize-none outline-none focus:border-accent"
          />
        </div>

        <label className="flex items-center justify-between gap-3 opacity-60">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-[15px]">Срочно</p>
              <Badge tone="neutral" className="gap-1">
                <Lock size={10} /> скоро в PRO
              </Badge>
            </div>
            <p className="text-[13px] text-text-muted">Поднимет смену вверх ленты — доступно в платной версии</p>
          </div>
          <Toggle checked={false} onChange={() => {}} disabled />
        </label>
      </div>

      <div className="px-5 pb-5 pt-2 shrink-0">
        {error && <p className="text-[13px] text-danger mb-2 leading-relaxed">{error}</p>}
        <Button fullWidth disabled={publishing || !employmentType || (isShift && days === 0)} onClick={publish}>
          {publishing
            ? editing
              ? 'Сохраняем…'
              : 'Публикуем…'
            : !employmentType
              ? 'Выберите тип работы'
              : isShift && days === 0
                ? 'Отметьте дни'
                : editing
                  ? 'Сохранить изменения'
                  : days > 1
                    ? splitPerDay
                      ? `Опубликовать ${days} ${pluralizeShifts(days)}`
                      : `Опубликовать · ${days} ${pluralizeShifts(days)} одному человеку`
                    : 'Опубликовать'}
        </Button>
      </div>
    </div>
  );
}

/** «Один человек на все дни» против «свой человек на каждый день» — выбор
 *  крупными строками, а не парой чипов: от него зависит, одна вакансия
 *  уйдёт в ленту или несколько, и прочитать его надо целиком. */
function CoverageOption({
  active,
  icon,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'w-full text-left flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-colors',
        active ? 'bg-accent-soft border-accent' : 'bg-surface border-border',
      )}
    >
      <span className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0', active ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-text-muted')}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn('block font-semibold text-[14px]', active && 'text-accent')}>{title}</span>
        <span className="block text-[12px] text-text-faint truncate">{hint}</span>
      </span>
    </button>
  );
}
