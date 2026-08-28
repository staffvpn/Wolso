import type { Env } from '../types';

/** Recomputes a rating from the reviews that actually exist right now.
 *
 *  Ratings are stored on the account, not derived on read, and until now
 *  they were only ever recalculated at the moment a review was *left*.
 *  Anything that made a review disappear — deleting the shift it hung off,
 *  deleting the vacancy, removing the review itself — left the old average
 *  frozen in place. That's how a worker keeps two stars after the only
 *  review behind them is gone.
 *
 *  COALESCE matters: AVG() over no rows is NULL, and `rating` is NOT NULL,
 *  so recomputing an account down to zero reviews would otherwise throw a
 *  constraint error instead of clearing the score. 0 is what the UI renders
 *  as «Без оценок». */
export async function recomputeWorkerRating(env: Env, workerId: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE workers SET rating = (
       SELECT COALESCE(AVG(employer_rating), 0) FROM applications
       WHERE worker_id = ? AND employer_rating IS NOT NULL
     ) WHERE id = ?`,
  )
    .bind(workerId, workerId)
    .run();
}

export async function recomputeCompanyRating(env: Env, companyId: number): Promise<void> {
  await env.DB.prepare(
    `UPDATE companies SET
       rating = (SELECT COALESCE(AVG(a.rating), 0) FROM applications a
                 JOIN shifts s ON s.id = a.shift_id
                 WHERE s.company_id = ? AND a.rating IS NOT NULL),
       reviews_count = (SELECT COUNT(*) FROM applications a
                        JOIN shifts s ON s.id = a.shift_id
                        WHERE s.company_id = ? AND a.rating IS NOT NULL)
     WHERE id = ?`,
  )
    .bind(companyId, companyId, companyId)
    .run();
}

/** Rebuilds every stored rating from scratch. Used by the dashboard's
 *  "пересчитать" action to repair scores that already went stale before
 *  the recompute calls above existed. */
export async function recomputeAllRatings(env: Env): Promise<{ workers: number; companies: number }> {
  await env.DB.prepare(
    `UPDATE workers SET rating = (
       SELECT COALESCE(AVG(a.employer_rating), 0) FROM applications a
       WHERE a.worker_id = workers.id AND a.employer_rating IS NOT NULL
     )`,
  ).run();

  await env.DB.prepare(
    `UPDATE companies SET
       rating = (SELECT COALESCE(AVG(a.rating), 0) FROM applications a
                 JOIN shifts s ON s.id = a.shift_id
                 WHERE s.company_id = companies.id AND a.rating IS NOT NULL),
       reviews_count = (SELECT COUNT(*) FROM applications a
                        JOIN shifts s ON s.id = a.shift_id
                        WHERE s.company_id = companies.id AND a.rating IS NOT NULL)`,
  ).run();

  const counts = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM workers) as workers, (SELECT COUNT(*) FROM companies) as companies',
  ).first<{ workers: number; companies: number }>();

  return { workers: counts?.workers ?? 0, companies: counts?.companies ?? 0 };
}
