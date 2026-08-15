import { MODES, MODE_ORDER } from '@/data/modes';
import type { Mode } from '@/types';
import { Chip } from './ui/Chip';
import { hapticSelect } from '@/lib/telegram';

export function ModePicker({ value, onChange }: { value: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto px-5 -mx-5 pb-1" style={{ scrollSnapType: 'x proximity' }}>
      {MODE_ORDER.map((id) => {
        const meta = MODES[id];
        const active = value === id;
        return (
          <div key={id} className="first:ml-5 last:mr-5" style={{ scrollSnapAlign: 'start' }}>
            <Chip
              active={active}
              activeColor={meta.colorVar}
              onClick={() => {
                hapticSelect();
                onChange(id);
              }}
            >
              <span>{meta.emoji}</span>
              {meta.label}
            </Chip>
          </div>
        );
      })}
    </div>
  );
}
