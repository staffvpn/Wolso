import type { Filters, Shift } from '@/types';
import { apiFetch } from '@/lib/apiClient';

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.positions.length) params.set('positions', filters.positions.join(','));
  if (filters.rateFrom) params.set('rateFrom', String(filters.rateFrom));
  if (filters.radiusKm !== 'city') params.set('radiusKm', String(filters.radiusKm));
  if (filters.urgentOnly) params.set('urgentOnly', 'true');
  if (filters.employmentType) params.set('employmentType', filters.employmentType);
  if (filters.when) params.set('when', filters.when);
  if (filters.timeOfDay.length) params.set('timeOfDay', filters.timeOfDay.join(','));
  return params.toString();
}

interface ShiftApiResponse {
  id: number;
  companyId: number;
  position: string;
  positionLabel: string;
  date: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  hourlyRate: number;
  totalPay: number;
  description: string;
  meal: boolean;
  urgency: string;
  employmentType: string;
  timeOfDay: string;
  requirements: string[];
  status: string;
  moderationFlag: { label: string; tone: string } | null;
  createdAt: string;
  company?: {
    id: number;
    name: string;
    address?: string;
    city?: string;
    logoInitial?: string;
    logoColor?: string;
    rating?: number;
    reviewsCount?: number;
  };
}

function fromApi(s: ShiftApiResponse): Shift {
  return {
    id: String(s.id),
    companyId: String(s.companyId),
    position: s.position as Shift['position'],
    positionLabel: s.positionLabel,
    date: s.date,
    startHour: s.startHour,
    startMin: s.startMin,
    endHour: s.endHour,
    endMin: s.endMin,
    hourlyRate: s.hourlyRate,
    totalPay: s.totalPay,
    // Real distance needs a location source (Telegram's location API or
    // manual city/address geocoding) — not wired up yet, so we simply
    // don't claim a number. UI hides the distance chip when it's absent.
    distanceKm: undefined,
    description: s.description,
    tags: [],
    meal: s.meal,
    urgency: (s.urgency as Shift['urgency']) ?? 'normal',
    employmentType: s.employmentType as Shift['employmentType'],
    timeOfDay: s.timeOfDay as Shift['timeOfDay'],
    company: s.company
      ? {
          id: String(s.company.id),
          name: s.company.name,
          address: s.company.address ?? '',
          logoInitial: s.company.logoInitial ?? '?',
          logoColor: s.company.logoColor ?? '#999',
          rating: s.company.rating ?? 0,
          reviewsCount: s.company.reviewsCount ?? 0,
        }
      : undefined,
  };
}

export async function fetchShifts(filters: Filters): Promise<Shift[]> {
  const query = buildQuery(filters);
  const { shifts } = await apiFetch<{ shifts: ShiftApiResponse[] }>(`/shifts${query ? `?${query}` : ''}`);
  return shifts.map(fromApi);
}

export async function applyToShift(shiftId: string): Promise<{ ok: true }> {
  await apiFetch('/applications', { method: 'POST', body: { shiftId: Number(shiftId) } });
  return { ok: true };
}
