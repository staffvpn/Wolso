import { useMemo } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ChevronLeft, List, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { IconButton } from '@/components/ui/IconButton';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { resolveCompany } from '@/data/companies';
import { relativeDayRange } from '@/lib/format';
import { useShiftsStore } from '@/store/useShiftsStore';
import { FEATURES } from '@/lib/features';

const PIN_POSITIONS = [
  { top: '18%', left: '58%' },
  { top: '32%', left: '24%' },
  { top: '48%', left: '48%', selected: true },
  { top: '58%', left: '72%' },
  { top: '68%', left: '20%' },
];

export function FeedMap() {
  const navigate = useNavigate();
  const deck = useShiftsStore((s) => s.deck);

  const nearby = useMemo(() => deck.slice(0, 8), [deck]);
  const preview = nearby.slice(0, 2);

  if (!FEATURES.map) return <Navigate to="/w/feed" replace />;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-5 pt-4 pb-3 safe-top shrink-0">
        <IconButton onClick={() => navigate(-1)} aria-label="Назад">
          <ChevronLeft size={20} />
        </IconButton>
        <div className="flex-1 flex items-center gap-2 h-11 rounded-2xl bg-surface border border-border px-3.5 text-text-muted text-[14px]">
          <Search size={16} />
          Смены на карте
        </div>
        <IconButton onClick={() => navigate(-1)} aria-label="Списком">
          <List size={18} />
        </IconButton>
      </div>

      <div
        className="relative flex-1 min-h-0 mx-5 rounded-card overflow-hidden border border-border-soft"
        style={{
          backgroundColor: 'var(--color-surface)',
          backgroundImage:
            'linear-gradient(var(--color-border-soft) 1px, transparent 1px), linear-gradient(90deg, var(--color-border-soft) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      >
        {PIN_POSITIONS.map((pin, i) => {
          const shift = nearby[i];
          if (!shift) return null;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 24 }}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1"
              style={{ top: pin.top, left: pin.left }}
            >
              {pin.selected && <span className="h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-accent/25" />}
              <span
                className={
                  pin.selected
                    ? 'rounded-full bg-accent text-accent-fg text-[12px] font-bold px-3 py-1.5 shadow-lg'
                    : 'rounded-full bg-white text-black text-[12px] font-bold px-3 py-1.5 shadow-lg'
                }
              >
                {shift.hourlyRate} ₽/ч
              </span>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="shrink-0 mx-5 -mt-6 mb-4 rounded-t-sheet bg-bg-elevated border border-border-soft relative z-10 px-5 pt-4 pb-2"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-[15px]">{nearby.length} смен в этом районе</p>
          <button onClick={() => navigate(-1)} className="text-[13px] font-medium text-accent">
            Списком
          </button>
        </div>
        <div className="space-y-3 pb-2">
          {preview.map((shift) => {
            const company = resolveCompany(shift);
            return (
              <div key={shift.id} className="flex items-center gap-3">
                {company.avatarUrl ? (
                  <Avatar src={company.avatarUrl} name={company.name} size={38} className="rounded-2xl" />
                ) : (
                  <LogoBadge initial={company.logoInitial} color={company.logoColor} size={38} />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[14px] truncate">{shift.positionLabel} · {company.name}</p>
                  <p className="text-[12px] text-text-muted truncate">
                    {relativeDayRange(shift.date, shift.endDate)} {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')} · 7 мин пешком
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-[14px]">{shift.hourlyRate} ₽</p>
                  <p className="text-[11px] text-text-faint">в час</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
