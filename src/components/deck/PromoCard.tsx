import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { SafeImage } from '../ui/SafeImage';
import { openExternal, hapticSelect } from '@/lib/telegram';
import type { Promo } from '@/store/usePromoStore';

const SWIPE_TO_DISMISS = 90;

/** Рекламная карточка между сменами.
 *
 *  Лежит отдельным слоем поверх колоды, а не внутри неё: `deck` — массив
 *  смен, и свайп вправо по нему отправляет отклик. Поэтому свайп здесь
 *  свой и делает ровно одно — закрывает, как крестик. Переход на канал
 *  только по кнопке: человек свайпает вправо на автомате, ожидая отклика,
 *  и выкидывать его за это в чужой канал — способ собрать переходы,
 *  которых никто не хотел, и испортить статистику, которую потом несёшь
 *  партнёру.
 *
 *  Подпись «Реклама» обязательна и не убирается: карточка стоит в одном
 *  ряду со сменами и обязана отличаться от них с первого взгляда. */
export function PromoCard({ promo, onDismiss, onClick }: { promo: Promo; onDismiss: () => void; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      drag="x"
      dragElastic={0.7}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > SWIPE_TO_DISMISS) onDismiss();
      }}
      className="absolute inset-x-5 inset-y-0 z-[120] touch-none"
    >
      <div className="relative h-full w-full rounded-card overflow-hidden bg-surface border border-border-soft shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)] flex flex-col">
        <div className="relative h-[46%] shrink-0 bg-surface-2 overflow-hidden">
          {promo.imageUrl ? (
            <SafeImage src={promo.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-accent-soft to-surface-2" />
          )}

          <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wide bg-black/45 backdrop-blur text-white rounded-full px-2.5 py-1">
            Реклама
          </span>

          <button
            onClick={() => {
              hapticSelect();
              onDismiss();
            }}
            aria-label="Закрыть рекламу"
            className="absolute top-2.5 right-2.5 h-9 w-9 rounded-full bg-black/45 backdrop-blur flex items-center justify-center"
          >
            <X size={18} className="text-white" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col p-5">
          <h2 className="text-[22px] font-extrabold leading-tight">{promo.title}</h2>
          {promo.text && (
            <p className="text-[14px] leading-relaxed text-text-muted mt-2.5 whitespace-pre-line line-clamp-5">{promo.text}</p>
          )}

          <div className="flex-1" />

          {/* Рекламодатель и токен маркировки — мелким шрифтом под кнопкой,
              как и положено. Для своего канала оба пустые и строки нет. */}
          {(promo.advertiser || promo.erid) && (
            <p className="text-[11px] text-text-faint mb-2.5">{[promo.advertiser, promo.erid].filter(Boolean).join(' · ')}</p>
          )}

          <Button
            fullWidth
            onClick={() => {
              onClick();
              openExternal(promo.url, promo.kind);
            }}
          >
            {promo.ctaLabel}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
