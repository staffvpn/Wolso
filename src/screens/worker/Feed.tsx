import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Map as MapIcon, Rocket, X, Check, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IconButton } from '@/components/ui/IconButton';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/deck/SwipeDeck';
import { ShiftCard } from '@/components/deck/ShiftCard';
import { FilterSheet } from '@/components/FilterSheet';
import { useShiftsStore } from '@/store/useShiftsStore';
import { useFiltersStore } from '@/store/useFiltersStore';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { useEntitlementsStore } from '@/store/useEntitlementsStore';
import { resolveCompany } from '@/data/companies';
import { formatMoney } from '@/lib/format';
import { FEATURES } from '@/lib/features';
import type { Shift } from '@/types';

export function Feed() {
  const navigate = useNavigate();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [filterOpen, setFilterOpen] = useState(false);

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

  const radiusLabel = filters.radiusKm === 'city' ? 'по всему городу' : `в радиусе ${filters.radiusKm} км`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-2 safe-top shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-accent-soft flex items-center justify-center">
            <Circle size={13} className="fill-accent text-accent" />
          </div>
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
        renderCard={(shift) => <ShiftCard shift={shift} />}
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
        {lastApplied && <ApplySuccessOverlay shift={lastApplied} onClose={clearLastApplied} />}
      </AnimatePresence>
    </div>
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
          {company.name} получил вашу заявку на смену {shift.date === new Date().toISOString().slice(0, 10) ? 'сегодня' : shift.date}. Ответ
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
