import { useState } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { Chip } from './ui/Chip';
import { Button } from './ui/Button';
import { SectionLabel } from './ui/Card';
import { POSITIONS } from '@/data/positions';
import type { Position } from '@/types';

interface WorkerPositionSheetProps {
  open: boolean;
  onClose: () => void;
  selected: Position[];
  onApply: (positions: Position[]) => void;
}

/** Who am I hiring for — the one filter "find staff" actually needs. No
 *  rate/radius/time-of-day here, those describe a shift, not a person. */
export function WorkerPositionSheet({ open, onClose, selected, onApply }: WorkerPositionSheetProps) {
  const [draft, setDraft] = useState<Position[]>(selected);

  function toggle(p: Position) {
    setDraft((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[19px] font-bold">Кого ищете?</h2>
        {draft.length > 0 && (
          <button onClick={() => setDraft([])} className="text-[14px] font-medium text-text-muted">
            Сбросить
          </button>
        )}
      </div>

      <div>
        <SectionLabel>Должность</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {POSITIONS.map((p) => (
            <Chip key={p.id} selected={draft.includes(p.id)} onClick={() => toggle(p.id)}>
              {p.label}
            </Chip>
          ))}
        </div>
        <p className="text-[13px] text-text-muted mt-3 leading-relaxed">
          Покажем только тех, у кого в анкете есть выбранная должность — можно отметить сразу несколько.
        </p>
      </div>

      <div className="pt-6">
        <Button
          fullWidth
          disabled={draft.length === 0}
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          {draft.length === 0 ? 'Выберите должность' : 'Показать анкеты'}
        </Button>
      </div>
    </BottomSheet>
  );
}
