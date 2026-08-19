import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Minus, Plus } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionLabel } from '@/components/ui/Card';
import { POSITIONS, MARKET_AVG_RATE } from '@/data/positions';
import { useEmployerStore } from '@/store/useEmployerStore';
import { formatDayMonth, pluralizeShifts } from '@/lib/format';
import type { Position } from '@/types';

const KEY_POSITIONS = POSITIONS.slice(0, 8);
const REQUIREMENT_POOL = ['Опыт от 1 года', 'Медкнижка', 'Без опыта', 'Своя форма'];
const MAX_DAYS = 14;

function isoDate(daysFromNow: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function addDays(date: string, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = isoDate(0);
const TOMORROW = isoDate(1);

export function NewVacancy() {
  const navigate = useNavigate();
  const createVacancy = useEmployerStore((s) => s.createVacancy);

  const [position, setPosition] = useState<Position>('barista');
  const [startDate, setStartDate] = useState(TODAY);
  const [days, setDays] = useState(1);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(19);
  const [rate, setRate] = useState(450);
  const [requirements, setRequirements] = useState<string[]>(['Опыт от 1 года', 'Медкнижка']);
  const [description, setDescription] = useState('');
  const [publishing, setPublishing] = useState(false);

  const marketAvg = MARKET_AVG_RATE[position];
  const positionLabel = POSITIONS.find((p) => p.id === position)!.label;
  const endDate = days > 1 ? addDays(startDate, days - 1) : startDate;

  function toggleRequirement(r: string) {
    setRequirements((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  /** One vacancy, however many days it covers — "нужен человек на 3 дня"
   *  is one posting with a date range, not three separate shifts each
   *  needing their own candidate pool and their own invite. */
  async function publish() {
    setPublishing(true);
    const vac = await createVacancy({
      position,
      positionLabel,
      date: startDate,
      endDate: days > 1 ? endDate : undefined,
      startHour,
      startMin: 0,
      endHour,
      endMin: 0,
      hourlyRate: rate,
      requirements,
      description: description.trim(),
      urgent: false, // paid feature — locked for now, see the toggle below
    });
    setPublishing(false);
    navigate(`/e/vacancies/${vac.id}`, { replace: true });
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
            Смена публикуется сразу — если человек нужен на несколько дней подряд, это одна вакансия, не несколько
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Chip tone="dark" selected={startDate === TODAY} onClick={() => setStartDate(TODAY)}>
              Сегодня
            </Chip>
            <Chip tone="dark" selected={startDate === TOMORROW} onClick={() => setStartDate(TOMORROW)}>
              Завтра
            </Chip>
            <input
              type="date"
              min={TODAY}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 min-w-[140px] rounded-full bg-surface-2 border border-border px-3.5 py-1.5 text-[13px] font-semibold outline-none focus:border-accent"
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-surface border border-border px-4 py-3 mb-3">
            <div>
              <p className="font-semibold text-[15px]">
                {days === 1 ? 'Один день' : `${days} ${pluralizeShifts(days)} подряд`}
              </p>
              <p className="text-[12px] text-text-faint mt-0.5">
                {days === 1 ? formatDayMonth(new Date(startDate)) : `${formatDayMonth(new Date(startDate))} – ${formatDayMonth(new Date(endDate))}`}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setDays((d) => Math.max(1, d - 1))}
                disabled={days <= 1}
                aria-label="Меньше дней"
                className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center disabled:opacity-30"
              >
                <Minus size={15} />
              </button>
              <span className="w-7 text-center font-bold text-[15px]">{days}</span>
              <button
                onClick={() => setDays((d) => Math.min(MAX_DAYS, d + 1))}
                disabled={days >= MAX_DAYS}
                aria-label="Больше дней"
                className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center disabled:opacity-30"
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
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
        <Button fullWidth disabled={publishing} onClick={publish}>
          {publishing ? 'Публикуем…' : days > 1 ? `Опубликовать · ${days} ${pluralizeShifts(days)}` : 'Опубликовать'}
        </Button>
      </div>
    </div>
  );
}
