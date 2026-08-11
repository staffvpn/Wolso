import type { Shift } from '@/types';
import { resolveCompany } from '@/data/companies';
import { LogoBadge } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { formatDistance, formatMoney, relativeDay, timeRange } from '@/lib/format';
import { ShieldCheck, Heart } from 'lucide-react';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { cn } from '@/lib/cn';
import { hapticSelect } from '@/lib/telegram';

export function ShiftCard({ shift }: { shift: Shift }) {
  const company = resolveCompany(shift);
  const day = relativeDay(new Date(shift.date));
  const durationH = shift.endHour - shift.startHour;
  const isFavorite = useFavoritesStore((s) => s.shiftIds.includes(shift.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleShift);

  return (
    <div className="flex flex-col h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <LogoBadge initial={company.logoInitial} color={company.logoColor} size={44} />
          <div className="min-w-0">
            <p className="font-bold text-[16px] truncate">{company.name}</p>
            <p className="text-[13px] text-text-muted truncate">
              {[company.address, shift.distanceKm !== undefined && formatDistance(shift.distanceKm), company.rating > 0 && `★ ${company.rating}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {company.verified && (
            <Badge tone="accent">
              <ShieldCheck size={12} /> Проверено
            </Badge>
          )}
          <button
            onClick={() => {
              hapticSelect();
              toggleFavorite(shift.id);
            }}
            aria-label="В избранное"
          >
            <Heart size={19} className={cn(isFavorite ? 'fill-danger text-danger' : 'text-text-faint')} />
          </button>
        </div>
      </div>

      <h2 className="text-[26px] font-extrabold mt-5">{shift.positionLabel}</h2>

      <div className="flex flex-wrap gap-2 mt-3">
        <Badge tone={shift.urgency === 'urgent' ? 'warning' : 'dark'}>
          {day} {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')}
        </Badge>
        <Badge tone="dark">{durationH} часов</Badge>
        {shift.meal && <Badge tone="dark">Питание</Badge>}
      </div>

      <div className="mt-5">
        <span className="text-[32px] font-extrabold leading-none">{formatMoney(shift.totalPay)}</span>
        <span className="text-[14px] text-text-muted ml-2">
          за смену · {shift.hourlyRate} ₽/ч
        </span>
      </div>

      <p className="text-[14px] leading-relaxed text-text-muted mt-4">{shift.description}</p>
      <p className="text-[12px] text-text-faint mt-2">
        {timeRange(shift.startHour, shift.startMin, shift.endHour, shift.endMin)}
      </p>

      <div className="flex-1" />
    </div>
  );
}
