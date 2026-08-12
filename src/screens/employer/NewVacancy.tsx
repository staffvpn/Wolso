import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Plus, X } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionLabel } from '@/components/ui/Card';
import { POSITIONS, MARKET_AVG_RATE } from '@/data/positions';
import { useEmployerStore } from '@/store/useEmployerStore';
import { formatDayMonth } from '@/lib/format';
import type { Position } from '@/types';

const KEY_POSITIONS = POSITIONS.slice(0, 8);
const REQUIREMENT_POOL = ['Опыт от 1 года', 'Медкнижка', 'Без опыта', 'Своя форма'];

function isoDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const TODAY = isoDate(0);
const TOMORROW = isoDate(1);

/** Genitive plural for "N смена/смены/смен". */
function shiftsWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'смена';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'смены';
  return 'смен';
}

export function NewVacancy() {
  const navigate = useNavigate();
  const createVacancy = useEmployerStore((s) => s.createVacancy);

  const [position, setPosition] = useState<Position>('barista');
  const [selectedDates, setSelectedDates] = useState<string[]>([TODAY]);
  const [pickerDate, setPickerDate] = useState('');
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(19);
  const [rate, setRate] = useState(450);
  const [requirements, setRequirements] = useState<string[]>(['Опыт от 1 года', 'Медкнижка']);
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);

  const marketAvg = MARKET_AVG_RATE[position];
  const positionLabel = POSITIONS.find((p) => p.id === position)!.label;

  const canPublish = selectedDates.length > 0;

  function toggleRequirement(r: string) {
    setRequirements((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  function toggleQuickDate(date: string) {
    setSelectedDates((prev) => (prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort()));
  }

  function addPickedDate() {
    if (!pickerDate) return;
    setSelectedDates((prev) => (prev.includes(pickerDate) ? prev : [...prev, pickerDate].sort()));
    setPickerDate('');
  }

  function removeDate(date: string) {
    setSelectedDates((prev) => prev.filter((d) => d !== date));
  }

  /** The calendar only marks which day(s) work is needed — publishing
   *  happens immediately regardless of the date. Picking several days
   *  posts one shift per day, all live right away. */
  async function publish() {
    if (!canPublish) return;
    setPublishing(true);
    let firstId: string | null = null;
    for (const date of selectedDates) {
      const vac = await createVacancy({
        position,
        positionLabel,
        date,
        startHour,
        startMin: 0,
        endHour,
        endMin: 0,
        hourlyRate: rate,
        requirements,
        description: description.trim(),
        urgent: false, // paid feature — locked for now, see the toggle below
      });
      firstId ??= vac.id;
    }
    setPublishing(false);
    navigate(selectedDates.length === 1 && firstId ? `/e/vacancies/${firstId}` : '/e/vacancies', { replace: true });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Новая смена" onBack={() => navigate(-1)} />

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
          <SectionLabel>Когда</SectionLabel>
          <p className="text-[13px] text-text-muted mb-3 leading-relaxed">
            Отметьте один или несколько дней — смена публикуется сразу, дата в карточке просто показывает, на какой день ищете человека
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Chip tone="dark" selected={selectedDates.includes(TODAY)} onClick={() => toggleQuickDate(TODAY)}>
              Сегодня
            </Chip>
            <Chip tone="dark" selected={selectedDates.includes(TOMORROW)} onClick={() => toggleQuickDate(TOMORROW)}>
              Завтра
            </Chip>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input
              type="date"
              min={TODAY}
              value={pickerDate}
              onChange={(e) => setPickerDate(e.target.value)}
              className="flex-1 rounded-2xl bg-surface border border-border px-3.5 py-3 text-[15px] font-semibold outline-none focus:border-accent"
            />
            <button
              onClick={addPickedDate}
              disabled={!pickerDate}
              aria-label="Добавить дату"
              className="h-[46px] w-[46px] rounded-2xl bg-accent-soft text-accent flex items-center justify-center shrink-0 disabled:opacity-40"
            >
              <Plus size={18} />
            </button>
          </div>
          {selectedDates.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {selectedDates.map((d) => (
                <span
                  key={d}
                  className="flex items-center gap-1.5 h-9 pl-3.5 pr-2 rounded-full bg-surface-2 border border-border text-[13px] font-semibold"
                >
                  {formatDayMonth(new Date(d))}
                  <button onClick={() => removeDate(d)} aria-label="Убрать дату" className="h-5 w-5 rounded-full flex items-center justify-center text-text-faint">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
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

        <div>
          <SectionLabel>Оплата</SectionLabel>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[28px] font-extrabold">{rate} ₽</span>
            <span className="text-[13px] text-text-muted">в час · {rate * (endHour - startHour)} ₽ за смену</span>
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
        <Button fullWidth disabled={publishing || !canPublish} onClick={publish}>
          {publishing
            ? 'Публикуем…'
            : !canPublish
              ? 'Выберите дату'
              : selectedDates.length > 1
                ? `Опубликовать · ${selectedDates.length} ${shiftsWord(selectedDates.length)}`
                : 'Опубликовать'}
        </Button>
      </div>
    </div>
  );
}
