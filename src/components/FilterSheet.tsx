import { useEffect, useState } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { Chip } from './ui/Chip';
import { Toggle } from './ui/Toggle';
import { Slider } from './ui/Slider';
import { Button } from './ui/Button';
import { SectionLabel } from './ui/Card';
import { useFiltersStore } from '@/store/useFiltersStore';
import { POSITIONS, TOP_POSITIONS } from '@/data/positions';
import { fetchShifts } from '@/services/shiftsApi';

interface FilterSheetProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
}

const EMPLOYMENT_TYPES: { id: 'shift' | 'permanent' | 'internship'; label: string }[] = [
  { id: 'shift', label: 'Смены' },
  { id: 'permanent', label: 'Постоянно' },
  { id: 'internship', label: 'Стажировка' },
];

const TIME_OF_DAY: { id: 'morning' | 'day' | 'evening' | 'night'; label: string }[] = [
  { id: 'morning', label: 'Утро' },
  { id: 'day', label: 'День' },
  { id: 'evening', label: 'Вечер' },
  { id: 'night', label: 'Ночь' },
];

const RADIUS_OPTIONS: { id: number | 'city'; label: string }[] = [
  { id: 1, label: '1 км' },
  { id: 3, label: '3 км' },
  { id: 5, label: '5 км' },
  { id: 'city', label: 'Весь город' },
];

export function FilterSheet({ open, onClose, onApply }: FilterSheetProps) {
  const { filters, togglePosition, setRateFrom, setRadius, setUrgentOnly, setEmploymentType, setWhen, toggleTimeOfDay, reset } =
    useFiltersStore();
  const [showAllPositions, setShowAllPositions] = useState(false);
  const [matchCount, setMatchCount] = useState<number | null>(null);

  // Live count from the server as the draft filters change, debounced so we
  // don't fire a request per keystroke/tap.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchShifts(filters)
        .then((shifts) => {
          if (!cancelled) setMatchCount(shifts.length);
        })
        .catch(() => {
          if (!cancelled) setMatchCount(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, open]);

  const shownPositions = showAllPositions ? POSITIONS : TOP_POSITIONS;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[19px] font-bold">Фильтры</h2>
        <button onClick={reset} className="text-[14px] font-medium text-text-muted">
          Сбросить
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <SectionLabel>Должность</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {shownPositions.map((p) => (
              <Chip key={p.id} selected={filters.positions.includes(p.id)} onClick={() => togglePosition(p.id)}>
                {p.label}
              </Chip>
            ))}
            {!showAllPositions && (
              <Chip onClick={() => setShowAllPositions(true)}>Ещё {POSITIONS.length - TOP_POSITIONS.length}</Chip>
            )}
          </div>
        </div>

        <div>
          <SectionLabel>Тип занятости</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {EMPLOYMENT_TYPES.map((t) => (
              <Chip key={t.id} tone="dark" selected={filters.employmentType === t.id} onClick={() => setEmploymentType(t.id)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Когда</SectionLabel>
          <div className="flex flex-wrap gap-2">
            <Chip selected={filters.when === 'today'} onClick={() => setWhen('today')}>Сегодня</Chip>
            <Chip selected={filters.when === 'tomorrow'} onClick={() => setWhen('tomorrow')}>Завтра</Chip>
            <Chip tone="dark" selected={filters.when === 'custom'} onClick={() => setWhen('custom')}>Выбрать даты</Chip>
          </div>
        </div>

        <div>
          <SectionLabel>Время смены</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {TIME_OF_DAY.map((t) => (
              <Chip key={t.id} tone="dark" selected={filters.timeOfDay.includes(t.id)} onClick={() => toggleTimeOfDay(t.id)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <SectionLabel className="mb-0">Ставка от</SectionLabel>
          </div>
          <div className="flex items-baseline gap-1 mb-3">
            <span className="text-[26px] font-extrabold">{filters.rateFrom} ₽</span>
            <span className="text-[13px] text-text-muted">в час</span>
          </div>
          <Slider min={200} max={1000} step={10} value={filters.rateFrom} onChange={setRateFrom} />
          <div className="flex justify-between text-[12px] text-text-faint mt-1.5">
            <span>200 ₽</span>
            <span>1000 ₽</span>
          </div>
        </div>

        <div>
          <SectionLabel>Радиус</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {RADIUS_OPTIONS.map((r) => (
              <Chip key={String(r.id)} selected={filters.radiusKm === r.id} onClick={() => setRadius(r.id)}>
                {r.label}
              </Chip>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between gap-3 py-1">
          <div>
            <p className="font-semibold text-[15px]">Только срочные</p>
            <p className="text-[13px] text-text-muted">Смены, которые начинаются сегодня</p>
          </div>
          <Toggle checked={filters.urgentOnly} onChange={setUrgentOnly} />
        </label>
      </div>

      <div className="pt-6">
        <Button
          fullWidth
          onClick={() => {
            onApply();
            onClose();
          }}
        >
          Показать{matchCount !== null ? ` ${matchCount}` : ''} смен
        </Button>
      </div>
    </BottomSheet>
  );
}
