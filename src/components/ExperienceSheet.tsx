import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { POSITIONS } from '@/data/positions';
import type { Position } from '@/types';

/** Picking a duration off a list beats typing one in. The old form asked
 *  for a number and a unit ("Сколько?" + мес./лет) next to a dropdown and
 *  a bare "+", which left people guessing at all three: what the number
 *  meant, that the dropdown was theirs to change, and that anything
 *  happened only after pressing plus. These are the ranges people actually
 *  answer with when asked how long they've done something. */
const PRESETS: { label: string; months: number }[] = [
  { label: 'Меньше 3 месяцев', months: 2 },
  { label: '3–6 месяцев', months: 5 },
  { label: 'Полгода — год', months: 9 },
  { label: '1–2 года', months: 18 },
  { label: '3–5 лет', months: 42 },
  { label: 'Больше 5 лет', months: 72 },
];

interface Props {
  /** The position being described — null keeps the sheet closed. */
  position: Position | null;
  onClose: () => void;
  onPick: (months: number) => Promise<void> | void;
}

export function ExperienceSheet({ position, onClose, onPick }: Props) {
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const label = position ? POSITIONS.find((p) => p.id === position)?.label : '';

  // A fresh sheet every time, rather than whatever was typed for the last
  // position still sitting in the field.
  useEffect(() => {
    if (position) setCustom('');
  }, [position]);

  async function pick(months: number) {
    if (busy) return;
    setBusy(true);
    try {
      await onPick(months);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const customYears = Number(custom.replace(',', '.'));
  const customValid = customYears > 0 && customYears <= 50;

  return (
    <BottomSheet open={position !== null} onClose={onClose}>
      <h2 className="text-[18px] font-extrabold leading-tight">Сколько работали?</h2>
      <p className="text-[14px] text-text-muted mt-1">Должность: {label}</p>

      <div className="flex flex-col gap-2 mt-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            disabled={busy}
            onClick={() => pick(p.months)}
            className="h-12 px-4 rounded-2xl bg-surface border border-border text-[15px] font-medium text-left active:bg-surface-hover disabled:opacity-60"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        <p className="text-[13px] text-text-muted mb-2">Или укажите точно, в годах</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Например, 2.5"
            className="flex-1 h-12 rounded-2xl bg-surface border border-border px-3.5 text-[15px] outline-none focus:border-accent placeholder:text-text-faint"
          />
          <Button size="md" disabled={!customValid || busy} onClick={() => pick(Math.round(customYears * 12))}>
            Добавить
          </Button>
        </div>
      </div>

      <Chip className="w-full mt-5" onClick={onClose}>
        Отмена
      </Chip>
    </BottomSheet>
  );
}
