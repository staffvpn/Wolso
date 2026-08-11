import type { Filters, Shift } from '@/types';
import { SHIFTS } from '@/data/shifts';
import { getCompany } from '@/data/companies';
import { delay } from './delay';

export function matchesFilters(shift: Shift, filters: Filters): boolean {
  if (filters.positions.length > 0 && !filters.positions.includes(shift.position)) return false;
  if (shift.hourlyRate < filters.rateFrom) return false;
  if (filters.radiusKm !== 'city' && shift.distanceKm > filters.radiusKm) return false;
  if (filters.urgentOnly && shift.urgency !== 'urgent') return false;
  if (filters.employmentType && shift.employmentType !== filters.employmentType) return false;
  if (filters.timeOfDay.length > 0 && !filters.timeOfDay.includes(shift.timeOfDay)) return false;
  if (filters.verifiedOnly && !getCompany(shift.companyId).verified) return false;

  if (filters.when !== 'custom') {
    const today = new Date();
    const target = new Date(today);
    if (filters.when === 'tomorrow') target.setDate(today.getDate() + 1);
    if (shift.date !== target.toISOString().slice(0, 10)) return false;
  }

  return true;
}

/** Simulated GET /shifts?filters=... */
export async function fetchShifts(filters: Filters): Promise<Shift[]> {
  await delay();
  return SHIFTS.filter((s) => matchesFilters(s, filters));
}

/** Simulated POST /shifts/:id/apply */
export async function applyToShift(_shiftId: string): Promise<{ ok: true }> {
  await delay(320);
  return { ok: true };
}
