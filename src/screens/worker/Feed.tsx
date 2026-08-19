import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Map as MapIcon, Rocket, X, Check, ChevronLeft, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/ui/Logo';
import { IconButton } from '@/components/ui/IconButton';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { LogoBadge } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SafeImage } from '@/components/ui/SafeImage';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/deck/SwipeDeck';
import { ShiftCard } from '@/components/deck/ShiftCard';
import { FilterSheet } from '@/components/FilterSheet';
import { useShiftsStore } from '@/store/useShiftsStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { useEntitlementsStore } from '@/store/useEntitlementsStore';
import { resolveCompany } from '@/data/companies';
import { formatDistance, formatMoney, localDateStr, relativeDayRange, shiftDaysCount, pluralizeShifts, timeRange } from '@/lib/format';
import { FEATURES } from '@/lib/features';
import { hapticSelect } from '@/lib/telegram';
import { cn } from '@/lib/cn';
import type { Shift } from '@/types';

export function Feed() {
  const navigate = useNavigate();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const { deck, index, loading, lastApplied, loadDeck, swipe, clearLastApplied } = useShiftsStore();
  const filters = useFiltersStore((s) => s.filters);
  const unread = useNotificationsStore((s) => s.unreadCount());
  const loadNotifications = useNotificationsStore((s) => s.load);
  const openPaywall = useEntitlementsStore((s) => s.openPaywall);

  useEffect(() => {
    loadDeck();
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = useMemo(() => deck.slice(index), [deck, index]);
  const current = remaining[0];

  // The deck can empty out from under the detail view (last card
  // skipped/applied) — fall back to the swipe view instead of showing it blank.
  useEffect(() => {
    if (detailOpen && !current) setDetailOpen(false);
  }, [detailOpen, current]);

  const radiusLabel = filters.radiusKm === 'city' ? 'по всему городу' : `в радиусе ${filters.radiusKm} км`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-2 safe-top shrink-0">
        <div className="flex items-center gap-2">
          <Logo size={22} className="text-accent" />
          <span className="font-extrabold tracking-tight text-[15px]">WOLSO</span>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="dark" onClick={() => setFilterOpen(true)} className="h-9 px-3.5">
            Фильтры{filters.positions.length > 0 ? ` · ${filters.positions.length}` : ''}
          </Chip>
          {FEATURES.map && (
            <IconButton size={36} onClick={() => navigate('/w/map')} aria-label="Карта">
              <MapIcon size={17} />
            </IconButton>
          )}
          <IconButton size={36} onClick={() => navigate('/w/notifications')} aria-label="Уведомления" className="relative">
            <Bell size={17} />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger" />}
          </IconButton>
        </div>
      </div>

      {deck.length > 0 && (
        <p className="px-5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-text-faint shrink-0">
          Смена {Math.min(index + 1, deck.length)} из {deck.length} · {radiusLabel}
        </p>
      )}

      <SwipeDeck
        ref={deckRef}
        items={remaining}
        keyOf={(s) => s.id}
        loading={loading}
        renderCard={(shift) => <ShiftCard shift={shift} onOpenDetail={() => setDetailOpen(true)} />}
        onSwiped={(_shift, direction) => swipe(direction)}
        empty={
          <EmptyState
            title="Смены закончились"
            description={`Вы посмотрели все ${deck.length} смен по вашим фильтрам. Расширьте радиус или снизьте порог ставки — покажем ещё.`}
            actions={
              <>
                <Button
                  fullWidth
                  onClick={() => {
                    useFiltersStore.getState().setRadius(5);
                    loadDeck();
                  }}
                >
                  Расширить радиус до 5 км
                </Button>
                <Button fullWidth variant="dark">
                  Уведомить о новых
                </Button>
              </>
            }
          />
        }
      />

      {current && (
        <div className="flex items-center justify-center gap-4 px-5 py-4 shrink-0">
          <IconButton size={56} onClick={() => deckRef.current?.swipeLeft()} aria-label="Пропустить">
            <X size={22} className="text-text-muted" />
          </IconButton>
          <Button size="lg" className="flex-1 max-w-[220px]" onClick={() => deckRef.current?.swipeRight()}>
            <Check size={18} /> Откликнуться
          </Button>
          <IconButton size={56} onClick={() => openPaywall('boost')} aria-label="Поднять отклик" className="text-warning">
            <Rocket size={20} />
          </IconButton>
        </div>
      )}

      <p className="text-center text-[11px] text-text-faint pb-2 shrink-0">
        свайп вправо — отклик · влево — пропустить
      </p>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} onApply={loadDeck} />

      <AnimatePresence>
        {detailOpen && current && (
          <ShiftDetailOverlay
            shift={current}
            onClose={() => setDetailOpen(false)}
            onSkip={() => deckRef.current?.swipeLeft()}
            onApply={() => {
              // Closes right away so the success screen (below) takes over
              // cleanly instead of flashing the next card first.
              setDetailOpen(false);
              deckRef.current?.swipeRight();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lastApplied && <ApplySuccessOverlay shift={lastApplied} onClose={clearLastApplied} />}
      </AnimatePresence>
    </div>
  );
}

/** Full-screen read of the card currently on top of the deck — opened by
 *  tapping it. Stays open across "Пропустить" so you can keep paging
 *  through the deck without dropping back to the swipe view each time;
 *  "Откликнуться" closes it in favor of the existing apply-success screen. */
function ShiftDetailOverlay({
  shift,
  onClose,
  onSkip,
  onApply,
}: {
  shift: Shift;
  onClose: () => void;
  onSkip: () => void;
  onApply: () => void;
}) {
  const company = resolveCompany(shift);
  const day = relativeDayRange(shift.date, shift.endDate);
  const days = shiftDaysCount(shift.date, shift.endDate);
  const durationH = shift.endHour - shift.startHour;
  const isFavorite = useFavoritesStore((s) => s.shiftIds.includes(shift.id));
  const toggleFavorite = useFavoritesStore((s) => s.toggleShift);

  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = [company.avatarUrl, ...(company.photos ?? []).map((p) => p.url)].filter((p): p is string => !!p);
  const hasPhotos = photos.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
      className="absolute inset-0 z-[300] bg-bg flex flex-col safe-top safe-bottom"
    >
      <div className="flex items-center gap-2 px-3 pt-2 pb-1 shrink-0">
        <IconButton size={40} onClick={onClose} aria-label="Назад">
          <ChevronLeft size={20} />
        </IconButton>
        <span className="flex-1" />
        <IconButton
          size={40}
          onClick={() => {
            hapticSelect();
            toggleFavorite(shift.id);
          }}
          aria-label="В избранное"
        >
          <Heart size={18} className={cn(isFavorite ? 'fill-danger text-danger' : 'text-text-muted')} />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        <div className="relative h-80 shrink-0 bg-surface-2 overflow-hidden">
          {hasPhotos ? (
            <SafeImage key={photos[photoIndex]} src={photos[photoIndex]} alt={company.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <LogoBadge initial={company.logoInitial} color={company.logoColor} size={72} />
            </div>
          )}

          {photos.length > 1 && (
            <div className="absolute top-3 inset-x-3 flex gap-1">
              {photos.map((_, i) => (
                <div key={i} className={cn('h-[3px] flex-1 rounded-full', i === photoIndex ? 'bg-white' : 'bg-white/30')} />
              ))}
            </div>
          )}

          {hasPhotos && photos.length > 1 && (
            <>
              <button
                onClick={() => setPhotoIndex((i) => (i === 0 ? Math.max(photos.length - 1, 0) : i - 1))}
                aria-label="Предыдущее фото"
                className="absolute inset-y-0 left-0 w-1/2"
              />
              <button
                onClick={() => setPhotoIndex((i) => (i >= photos.length - 1 ? 0 : i + 1))}
                aria-label="Следующее фото"
                className="absolute inset-y-0 right-0 w-1/2"
              />
            </>
          )}
        </div>

        <div className="px-5">
          <div className="flex items-center gap-3 mt-4">
            <div className="min-w-0">
              <p className="font-bold text-[16px] truncate">{company.name}</p>
              <p className="text-[13px] text-text-muted truncate">
                {[company.address, shift.distanceKm !== undefined && formatDistance(shift.distanceKm), company.rating > 0 && `★ ${company.rating}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <h2 className="text-[26px] font-extrabold mt-5">{shift.positionLabel}</h2>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge tone={shift.urgency === 'urgent' ? 'warning' : 'dark'}>
              {day} {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')}
            </Badge>
            <Badge tone="dark">{durationH} часов</Badge>
            {days > 1 && <Badge tone="dark">{days} {pluralizeShifts(days)}</Badge>}
            {shift.meal && <Badge tone="dark">Питание</Badge>}
          </div>

          <div className="mt-5">
            <span className="text-[32px] font-extrabold leading-none">{formatMoney(shift.totalPay)}</span>
            <span className="text-[14px] text-text-muted ml-2">за смену · {shift.hourlyRate} ₽/ч</span>
          </div>

          <p className="text-[14px] leading-relaxed text-text-muted mt-4">{shift.description}</p>
          <p className="text-[12px] text-text-faint mt-2">
            {timeRange(shift.startHour, shift.startMin, shift.endHour, shift.endMin)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-5 py-4 shrink-0 border-t border-border-soft">
        <IconButton size={56} onClick={onSkip} aria-label="Пропустить">
          <X size={22} className="text-text-muted" />
        </IconButton>
        <Button size="lg" className="flex-1 max-w-[220px]" onClick={onApply}>
          <Check size={18} /> Откликнуться
        </Button>
      </div>
    </motion.div>
  );
}

function ApplySuccessOverlay({ shift, onClose }: { shift: Shift; onClose: () => void }) {
  const navigate = useNavigate();
  const company = resolveCompany(shift);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[400] bg-accent flex flex-col safe-top safe-bottom"
    >
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.05 }}
          className="h-16 w-16 rounded-full border-[3px] border-accent-fg flex items-center justify-center mb-5"
        >
          <Check size={30} className="text-accent-fg" strokeWidth={3} />
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-[26px] font-extrabold text-accent-fg"
        >
          Отклик отправлен
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[14px] text-accent-fg/80 mt-2 leading-relaxed max-w-[290px]"
        >
          {company.name} получил вашу заявку на смену {shift.date === localDateStr() ? 'сегодня' : shift.date}. Ответ
          придёт в этот чат Telegram.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="w-full bg-accent-fg/10 rounded-2xl p-4 mt-8 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center font-bold text-white" style={{ background: company.logoColor }}>
              {company.logoInitial}
            </div>
            <div className="text-left">
              <p className="font-bold text-accent-fg text-[14px]">{shift.positionLabel} · {company.name}</p>
              <p className="text-[12px] text-accent-fg/70">{formatMoney(shift.totalPay)} за смену</p>
            </div>
          </div>
          <span className="text-[12px] font-bold text-accent-fg bg-accent-fg/15 rounded-full px-2.5 py-1">Ждём ответ</span>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34 }}
        className="px-6 pb-6 flex flex-col gap-2.5"
      >
        <Button fullWidth variant="dark" onClick={onClose}>
          Смотреть дальше
        </Button>
        <Button
          fullWidth
          variant="ghost"
          className="text-accent-fg"
          onClick={() => {
            onClose();
            navigate('/w/responses');
          }}
        >
          Мои отклики
        </Button>
      </motion.div>
    </motion.div>
  );
}
