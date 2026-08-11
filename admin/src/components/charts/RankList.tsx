import { motion } from 'framer-motion';
import { formatNumber } from '@/lib/format';

interface RankListProps {
  items: { label: string; count: number }[];
}

export function RankList({ items }: RankListProps) {
  const max = Math.max(...items.map((i) => i.count));
  return (
    <div className="space-y-3.5">
      {items.map((item, i) => (
        <div key={item.label}>
          <div className="flex items-center justify-between text-[13px] mb-1.5">
            <span className="font-medium text-text">{item.label}</span>
            <span className="font-semibold text-text-muted">{formatNumber(item.count)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.count / max) * 100}%` }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: i % 2 === 0 ? 'var(--color-text)' : 'var(--color-accent)' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
