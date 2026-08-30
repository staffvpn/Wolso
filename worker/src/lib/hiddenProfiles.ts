import type { Env } from '../types';

/** Whether migration 0027 has been applied. Migrations here are run by
 *  hand, so the deployed code can be a migration ahead of the database —
 *  and a query naming a column D1 doesn't have throws, which Hono flattens
 *  into a bare internal_error 500. For the dashboard that means a button
 *  that looks dead; for `/employer/workers` it would mean the whole "найти
 *  сотрудников" deck failing for every employer until the SQL is run. Both
 *  are worth a cheap check first.
 *
 *  The `true` answer is cached for the lifetime of the isolate — a column
 *  never goes away again — but `false` is deliberately not, so applying the
 *  migration takes effect without redeploying. */
let columnConfirmed = false;

export async function hiddenColumnExists(env: Env): Promise<boolean> {
  if (columnConfirmed) return true;
  try {
    const { results } = await env.DB.prepare('PRAGMA table_info(workers)').all<{ name: string }>();
    columnConfirmed = results.some((r) => r.name === 'hidden');
    return columnConfirmed;
  } catch {
    return false;
  }
}

/** A WHERE fragment excluding hidden workers, or an empty string while the
 *  migration is still pending. Meant to be interpolated into SQL, so it
 *  takes no user input — the caller passes the table alias it uses. */
export async function excludeHiddenSql(env: Env, alias: string): Promise<string> {
  return (await hiddenColumnExists(env)) ? `AND ${alias}.hidden = 0` : '';
}

/** Whether this particular worker is hidden. Returns false while the
 *  migration is pending, so nothing is refused because of a column that
 *  doesn't exist yet. */
export async function workerIsHidden(env: Env, workerId: number): Promise<boolean> {
  if (!(await hiddenColumnExists(env))) return false;
  const row = await env.DB.prepare('SELECT hidden FROM workers WHERE id = ?').bind(workerId).first<{ hidden: number }>();
  return !!row?.hidden;
}
