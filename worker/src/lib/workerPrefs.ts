import type { Env } from '../types';

/** What kind of work a person is after. 'any' — both, which is what every
 *  anketa written before this existed means (see migration 0029): assuming
 *  either extreme on their behalf would quietly hide them from half the
 *  employers. */
export type LookingFor = 'any' | 'shift' | 'permanent';

const VALUES: LookingFor[] = ['any', 'shift', 'permanent'];

export function asLookingFor(value: unknown): LookingFor | null {
  return VALUES.includes(value as LookingFor) ? (value as LookingFor) : null;
}

/** A digit in a name is never a name. This exists because people were
 *  typing phone numbers, Telegram handles and "Иван 89031234567" into the
 *  field — the anketa is what an employer reads before deciding whether to
 *  trust someone with a shift, and that reads as spam.
 *
 *  Deliberately only about digits: apostrophes and hyphens are ordinary in
 *  real names (Д'Артаньян, Римский-Корсаков), and non-Cyrillic letters are
 *  ordinary for people who don't have Russian names. */
export function nameHasDigits(name: string): boolean {
  return /\d/.test(name);
}

/** Whether migration 0029 has been applied. Same reasoning as
 *  hiddenProfiles.ts — migrations are applied by hand, so the deployed code
 *  can be a migration ahead of the database, and naming a column that
 *  doesn't exist turns a whole screen into a bare 500. `true` is cached for
 *  the isolate's lifetime; `false` is re-checked, so running the SQL takes
 *  effect without a redeploy. */
let columnConfirmed = false;

export async function lookingForColumnExists(env: Env): Promise<boolean> {
  if (columnConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(workers)').all<{ name: string }>();
    columnConfirmed = results.some((r) => r.name === 'looking_for');
    return columnConfirmed;
  } catch {
    return false;
  }
}

/** A WHERE fragment keeping only workers open to `wanted`, or an empty
 *  string while the migration is pending (in which case nobody is filtered
 *  out, which is the same result the column's 'any' default would give).
 *  Takes no user input — the caller passes its own table alias, and
 *  `wanted` is validated by asLookingFor first. */
export async function matchesLookingForSql(env: Env, alias: string, wanted: LookingFor | null): Promise<string> {
  if (!wanted || wanted === 'any') return '';
  if (!(await lookingForColumnExists(env))) return '';
  return `AND ${alias}.looking_for IN ('any', '${wanted}')`;
}
