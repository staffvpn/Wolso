import { useState } from 'react';
import type { Shift } from '@/types';
import { resolveCompany } from '@/data/companies';
import { LogoBadge } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { SafeImage } from '../ui/SafeImage';
import { formatDistance, formatMoney, relativeDayRange, shiftDaysCount, pluralizeShifts, timeRange } from '@/lib/format';
import { ChevronRight, Heart } from 'lucide-react';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { cn } from '@/lib/cn';
import { hapticSelect } from '@/lib/telegram';
import { employmentTypeLabel } from '@/data/employmentTypes';

export function ShiftCard({ shift, onOpenDetail }: { shift: Shift; onOpenDetail?: () => void }) {
  const company = resolveCompany(shift);
  const day = relativeDayRange(shift.date, shift.endDate);
  const days = shiftDaysCount(shift.date, shift.endDate);
  const durationH = shift.endHour - shift.startHour;
  const isFavorite = useFavoritesStore((s) => s.shiftIds.includes(shift.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleShift);

  // Avatar first, then any gallery photos the employer uploaded — same
  // Tinder-style tap-through as CandidateCard, so a shift with real photos
  // of the venue actually shows them instead of just a logo badge.
  const [index, setIndex] = useState(0);
  const photos = [company.avatarUrl, ...(company.photos ?? []).map((p) => p.url)].filter((p): p is string => !!p);
  const hasPhotos = photos.length > 0;

  function prev() {
    setIndex((i) => (i === 0 ? Math.max(photos.length - 1, 0) : i - 1));
  }
  function next() {
    setIndex((i) => (i >= photos.length - 1 ? 0 : i + 1));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="relative h-[34%] shrink-0 bg-surface-2 overflow-hidden">
        {hasPhotos ? (
          <SafeImage key={photos[index]} src={photos[index]} alt={company.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <LogoBadge initial={company.logoInitial} color={company.logoColor} size={72} />
          </div>
        )}

        {photos.length > 1 && (
          <div className="absolute top-3 inset-x-3 flex gap-1">
            {photos.map((_, i) => (
              <div key={i} className={cn('h-[3px] flex-1 rounded-full', i === index ? 'bg-white' : 'bg-white/30')} />
            ))}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute bottom-2.5 left-4 right-14 text-white pointer-events-none">
          <p className="font-bold text-[15px] truncate drop-shadow">{company.name}</p>
          <p className="text-[12px] opacity-90 truncate">
            {[company.address, shift.distanceKm !== undefined && formatDistance(shift.distanceKm), company.rating > 0 && `★ ${company.rating}`]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <button
          onClick={() => {
            hapticSelect();
            toggleFavorite(shift.id);
          }}
          aria-label="В избранное"
          className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
        >
          <Heart size={17} className={cn(isFavorite ? 'fill-danger text-danger' : 'text-white')} />
        </button>

        {hasPhotos && photos.length > 1 && (
          <>
            <button onClick={prev} aria-label="Предыдущее фото" className="absolute inset-y-0 left-0 w-1/2" />
            <button onClick={next} aria-label="Следующее фото" className="absolute inset-y-0 right-0 w-1/2" />
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-5 relative">
        <h2 className="text-[24px] font-extrabold">{shift.positionLabel}</h2>

        <div className="flex flex-wrap gap-2 mt-3">
          <Badge tone={shift.employmentType === 'permanent' ? 'accent' : 'dark'}>
            {employmentTypeLabel(shift.employmentType)}
          </Badge>
          <Badge tone={shift.urgency === 'urgent' ? 'warning' : 'dark'}>
            {day} {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')}
          </Badge>
          <Badge tone="dark">{durationH} часов</Badge>
          {days > 1 && <Badge tone="dark">{days} {pluralizeShifts(days)}</Badge>}
          {shift.meal && <Badge tone="dark">Питание</Badge>}
        </div>

        <div className="mt-4">
          <span className="text-[30px] font-extrabold leading-none">{formatMoney(shift.totalPay)}</span>
          <span className="text-[14px] text-text-muted ml-2">
            за смену · {shift.hourlyRate} ₽/ч
          </span>
        </div>

        {/* Card doesn't scroll — DeckCard clips it at the rounded corners, so
         *  a long description just ends at the card edge. A tap used to open
         *  the full-screen detail view here, but that made real swipes get
         *  occasionally misread as taps — a dedicated button is unambiguous. */}
        <p className="text-[14px] leading-relaxed text-text-muted mt-3 line-clamp-3">{shift.description}</p>
        <p className="text-[12px] text-text-faint mt-2">
          {timeRange(shift.startHour, shift.startMin, shift.endHour, shift.endMin)}
        </p>

        <div className="flex-1" />

        {onOpenDetail && (
          <button
            onClick={onOpenDetail}
            className="absolute bottom-4 right-4 flex items-center gap-0.5 h-8 pl-3 pr-2.5 rounded-full bg-surface-2/95 backdrop-blur border border-border-soft text-[12px] font-semibold text-text shadow-sm"
          >
            Подробнее <ChevronRight size={13} className="text-text-faint" />
          </button>
        )}
      </div>
    </div>
  );
}
