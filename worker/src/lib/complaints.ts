import type { Env } from '../types';

/** Кто и на что жалуется. Три предмета, потому что три вещи, на которые
 *  вообще имеет смысл жаловаться: человек, заведение и конкретная смена
 *  (текст вакансии — обман по ставке, требования не по делу). */
export type ComplaintTarget = 'worker' | 'company' | 'shift';

export const COMPLAINT_REASONS = [
  'no_show',
  'rude',
  'misleading',
  'unsafe',
  'fake_profile',
  'payment',
  'other',
] as const;

export type ComplaintReason = (typeof COMPLAINT_REASONS)[number];

export function asComplaintReason(value: unknown): ComplaintReason | null {
  return COMPLAINT_REASONS.includes(value as ComplaintReason) ? (value as ComplaintReason) : null;
}

export function asComplaintTarget(value: unknown): ComplaintTarget | null {
  return value === 'worker' || value === 'company' || value === 'shift' ? value : null;
}

/** Whether migration 0031 has been applied. Same probe-first pattern as
 *  everywhere else in this codebase: migrations are run by hand, so the
 *  deployed code can be a migration ahead of the database, and naming a
 *  table that doesn't exist throws — which Hono flattens into a bare
 *  internal_error 500. This is exactly how the «Данные» screen broke: it
 *  still counts a `complaints` table that migration 0011 dropped. */
let tableConfirmed = false;

export async function complaintsTableExists(env: Env): Promise<boolean> {
  if (tableConfirmed) return true;
  try {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'complaints'").first();
    tableConfirmed = !!row;
    return tableConfirmed;
  } catch {
    return false;
  }
}

let notesTableConfirmed = false;

export async function userNotesTableExists(env: Env): Promise<boolean> {
  if (notesTableConfirmed) return true;
  try {
    const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user_notes'").first();
    notesTableConfirmed = !!row;
    return notesTableConfirmed;
  } catch {
    return false;
  }
}
