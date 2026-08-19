import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { fetchMyWorkerReviews, fetchMyCompanyReviews } from '@/services/reviewsApi';
import { formatDayMonth } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Review } from '@/types';

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= value ? 'fill-accent text-accent' : 'text-border'} />
      ))}
    </span>
  );
}

/** The list behind the rating on either profile — reviews other people
 *  left about you. Same screen for both roles, only the wording and which
 *  endpoint it reads from differ. */
export function Reviews({ role }: { role: 'worker' | 'employer' }) {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = role === 'worker' ? fetchMyWorkerReviews : fetchMyCompanyReviews;
    load()
      .then((r) => !cancelled && setReviews(r))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [role]);

  const average = useMemo(() => {
    if (!reviews || reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }, [reviews]);

  // How many of each star value there are — the little distribution bars.
  const spread = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of reviews ?? []) if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++;
    return counts;
  }, [reviews]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Отзывы" onBack={() => navigate(-1)} />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        {error && (
          <EmptyState title="Не удалось загрузить" description="Проверьте связь и попробуйте открыть экран заново." />
        )}

        {!error && reviews === null && <p className="text-[13px] text-text-faint text-center py-8">Загружаем…</p>}

        {!error && reviews !== null && reviews.length === 0 && (
          <EmptyState
            title="Пока нет отзывов"
            description={
              role === 'worker'
                ? 'Работодатели оставят отзыв после того, как закроют вашу первую смену.'
                : 'Сотрудники оставят отзыв после того, как вы закроете смену.'
            }
          />
        )}

        {!error && reviews !== null && reviews.length > 0 && (
          <>
            <div className="rounded-card bg-surface border border-border-soft p-4 mt-1 mb-5">
              <div className="flex items-center gap-4">
                <div className="text-center shrink-0">
                  <p className="text-[32px] font-extrabold leading-none">{average.toFixed(1)}</p>
                  <div className="mt-1.5">
                    <Stars value={Math.round(average)} size={13} />
                  </div>
                  <p className="text-[12px] text-text-faint mt-1">{reviews.length} отзывов</p>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = spread[star - 1];
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-[11px] text-text-faint w-2 tabular-nums">{star}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-text-faint w-4 text-right tabular-nums">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {reviews.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03 }}
                  className="rounded-card bg-surface border border-border-soft p-4"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={r.authorName}
                      src={r.authorAvatarUrl}
                      size={40}
                      className={cn(role === 'worker' && 'rounded-2xl')}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[14px] truncate">{r.authorName}</p>
                      <p className="text-[12px] text-text-faint truncate">
                        {r.positionLabel} · {formatDayMonth(new Date(r.shiftDate))}
                      </p>
                    </div>
                    <Stars value={r.rating} />
                  </div>

                  {r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {r.tags.map((tag) => (
                        <span key={tag} className="text-[12px] text-text-muted bg-surface-2 rounded-full px-2.5 py-1">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.comment && (
                    <p className="text-[14px] text-text leading-relaxed mt-3 whitespace-pre-line">{r.comment}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
