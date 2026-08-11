import { motion } from 'framer-motion';
import type { DashboardDay } from '@/types';

interface BarChartProps {
  data: DashboardDay[];
  height?: number;
}

export function BarChart({ data, height = 200 }: BarChartProps) {
  const max = Math.max(...data.flatMap((d) => [d.shifts, d.responses]));

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-text-muted">
          <span className="h-2.5 w-2.5 rounded-sm bg-text" /> смены
        </span>
        <span className="flex items-center gap-1.5 text-[12px] font-medium text-text-muted">
          <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> отклики
        </span>
      </div>
      <div className="flex items-end justify-between gap-3" style={{ height }}>
        {data.map((d, i) => (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center gap-1" style={{ height: height - 24 }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.shifts / max) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.04, ease: 'easeOut' }}
                className="w-[38%] rounded-t-md bg-text"
              />
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(d.responses / max) * 100}%` }}
                transition={{ duration: 0.5, delay: i * 0.04 + 0.05, ease: 'easeOut' }}
                className="w-[38%] rounded-t-md bg-accent"
              />
            </div>
            <span className="text-[12px] font-medium text-text-faint">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
