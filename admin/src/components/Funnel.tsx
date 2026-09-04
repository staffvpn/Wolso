import type { FunnelStep } from '@/services/funnelApi';

/** Воронка: сколько людей дошло до каждого шага и сколько потерялось
 *  между ними. Отдельные счётчики «смен за 30 дней» и «откликов за 30
 *  дней» показывают объём, но не то, где всё ломается, — а на ранней
 *  стадии продукта важно именно это.
 *
 *  Проценты считаются от первого шага (сколько всего пришло), а не от
 *  предыдущего: «до смены дошли 4%» — это то число, которое имеет смысл,
 *  а «с шага на шаг перешли 60%» без остальных шагов не значит ничего.
 *  Потеря между соседними шагами показана отдельно, мелким. */
export function Funnel({ steps }: { steps: FunnelStep[] }) {
  const total = steps[0]?.count ?? 0;

  if (total === 0) {
    return <p className="text-[13px] text-text-faint py-4">За этот период никто не регистрировался.</p>;
  }

  return (
    <div className="space-y-2.5">
      {steps.map((s, i) => {
        const share = Math.round((s.count / total) * 100);
        const prev = i > 0 ? steps[i - 1].count : null;
        const lost = prev !== null ? prev - s.count : 0;
        return (
          <div key={s.step}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[13px] text-text">{s.step}</span>
              <span className="text-[13px] shrink-0">
                <span className="font-bold">{s.count}</span>
                <span className="text-text-faint"> · {share}%</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(share, 1)}%` }} />
            </div>
            {lost > 0 && (
              <p className="text-[11px] text-text-faint mt-1">
                потеряли {lost} на этом шаге
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
