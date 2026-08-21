import type { EmploymentType } from '@/types';

/** Shared so the employer's "what kind of work is this" picker, the
 *  worker's filter, and the badge on every card all speak the same
 *  vocabulary — they used to each hardcode their own labels. */
export const EMPLOYMENT_TYPES: { id: EmploymentType; label: string }[] = [
  { id: 'shift', label: 'Смена' },
  { id: 'permanent', label: 'Постоянная работа' },
];

/** Short form for the badge on a card, where "Постоянная работа" would
 *  crowd out the rest of the row. The fallback in employmentTypeLabel
 *  covers postings created back when "Стажировка" was still an option. */
export const EMPLOYMENT_TYPE_SHORT: Record<EmploymentType, string> = {
  shift: 'Смена',
  permanent: 'Постоянно',
};

export function employmentTypeLabel(type: EmploymentType | undefined): string {
  return type ? EMPLOYMENT_TYPE_SHORT[type] ?? 'Смена' : 'Смена';
}
