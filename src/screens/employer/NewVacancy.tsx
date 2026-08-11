import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Slider } from '@/components/ui/Slider';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/Card';
import { POSITIONS } from '@/data/positions';
import { useEmployerStore } from '@/store/useEmployerStore';
import type { Position } from '@/types';

const KEY_POSITIONS = POSITIONS.slice(0, 8);
const DATE_OPTIONS = ['Сегодня', 'Завтра', 'Выбрать дату'];
const REQUIREMENT_POOL = ['Опыт от 1 года', 'Медкнижка', 'Без опыта', 'Своя форма'];

export function NewVacancy() {
  const navigate = useNavigate();
  const createVacancy = useEmployerStore((s) => s.createVacancy);

  const [position, setPosition] = useState<Position>('barista');
  const [dateOption, setDateOption] = useState(DATE_OPTIONS[0]);
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(19);
  const [rate, setRate] = useState(450);
  const [requirements, setRequirements] = useState<string[]>(['Опыт от 1 года', 'Медкнижка']);
  const [description, setDescription] = useState('');
  const [urgent, setUrgent] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const marketAvg = 430;
  const reach = useMemo(() => Math.round(120 + (rate - 300) * 0.3 + (urgent ? 40 : 0)), [rate, urgent]);

  function toggleRequirement(r: string) {
    setRequirements((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function publish() {
    setPublishing(true);
    const today = new Date().toISOString().slice(0, 10);
    const vac = await createVacancy({
      position,
      positionLabel: POSITIONS.find((p) => p.id === position)!.label,
      date: today,
      startHour,
      startMin: 0,
      endHour,
      endMin: 0,
      hourlyRate: rate,
      requirements,
      description: description.trim(),
      urgent,
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
          <div className="flex flex-wrap gap-2 mb-3">
            {DATE_OPTIONS.map((d) => (
              <Chip key={d} tone="dark" selected={dateOption === d} onClick={() => setDateOption(d)}>
                {d}
              </Chip>
            ))}
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
          <p className="text-accent text-[13px] font-medium mt-2">Средняя ставка {position === 'barista' ? 'бариста' : 'по позиции'} рядом — {marketAvg} ₽</p>
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

        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-[15px]">Срочно</p>
            <p className="text-[13px] text-text-muted">Поднять смену вверх ленты</p>
          </div>
          <Toggle checked={urgent} onChange={setUrgent} />
        </label>
      </div>

      <div className="px-5 pb-5 pt-2 shrink-0">
        <Button fullWidth disabled={publishing} onClick={publish}>
          {publishing ? 'Публикуем…' : `Опубликовать · увидят ${reach} человек`}
        </Button>
      </div>
    </div>
  );
}
