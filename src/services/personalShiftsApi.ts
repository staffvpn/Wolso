import { apiFetch } from '@/lib/apiClient';
import type { PersonalShift } from '@/types';

interface ApiRow {
  id: number;
  placeName: string;
  address: string;
  positionLabel: string;
  date: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  pay: number;
  notes: string;
}

function fromApi(r: ApiRow): PersonalShift {
  return { ...r, id: String(r.id) };
}

export type PersonalShiftInput = Omit<PersonalShift, 'id'>;

export async function fetchPersonalShifts(): Promise<PersonalShift[]> {
  const { shifts } = await apiFetch<{ shifts: ApiRow[] }>('/personal-shifts');
  return shifts.map(fromApi);
}

export async function createPersonalShift(input: PersonalShiftInput): Promise<PersonalShift> {
  const { shift } = await apiFetch<{ shift: ApiRow }>('/personal-shifts', { method: 'POST', body: input });
  return fromApi(shift);
}

/** Частичная правка: экран может прислать одну изменённую оплату, когда
 *  человек уточняет, сколько на самом деле заплатили за уже отработанную
 *  смену. Сервер сливает это с тем, что лежит, и проверяет результат. */
export async function updatePersonalShift(id: string, input: Partial<PersonalShiftInput>): Promise<PersonalShift> {
  const { shift } = await apiFetch<{ shift: ApiRow }>(`/personal-shifts/${id}`, { method: 'PATCH', body: input });
  return fromApi(shift);
}

export async function deletePersonalShift(id: string): Promise<void> {
  await apiFetch(`/personal-shifts/${id}`, { method: 'DELETE' });
}
