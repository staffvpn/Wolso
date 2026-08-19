import { BottomSheet } from './ui/BottomSheet';
import { SectionLabel } from './ui/Card';
import { formatMoney, relativeDayRange } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Vacancy } from '@/types';

interface VacancyPickSheetProps {
  open: boolean;
  onClose: () => void;
  vacancies: Vacancy[];
  selectedId: string | null;
  onSelect: (vacancy: Vacancy) => void;
}

/** Which open shift is "Поиск" staffing right now — every invite swiped
 *  right goes straight onto this one, so it has to be a real, active
 *  vacancy rather than a loose position filter. */
export function VacancyPickSheet({ open, onClose, vacancies, selectedId, onSelect }: VacancyPickSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="text-[19px] font-bold mb-1">На какую смену ищете?</h2>
      <p className="text-[13px] text-text-muted mb-5 leading-relaxed">
        Свайп вправо сразу пригласит анкету на выбранную смену.
      </p>

      <SectionLabel>Активные вакансии</SectionLabel>
      <div className="space-y-2 mt-2">
        {vacancies.map((v) => (
          <button
            key={v.id}
            onClick={() => {
              onSelect(v);
              onClose();
            }}
            className={cn(
              'w-full text-left rounded-2xl border p-3.5 transition-colors',
              v.id === selectedId ? 'border-accent bg-accent-soft' : 'border-border-soft bg-surface',
            )}
          >
            <p className="font-semibold text-[14px]">{v.positionLabel}</p>
            <p className="text-[13px] text-text-muted mt-0.5">
              {relativeDayRange(v.date, v.endDate)} {String(v.startHour).padStart(2, '0')}:{String(v.startMin).padStart(2, '0')} · {formatMoney(v.hourlyRate)}/ч
            </p>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
