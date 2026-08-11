import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { haptic } from '@/lib/telegram';

export interface DeckCardHandle {
  fling: (direction: 'left' | 'right') => void;
}

interface DeckCardProps {
  index: number;
  active: boolean;
  onSwiped: (direction: 'left' | 'right') => void;
  children: ReactNode;
}

const SWIPE_THRESHOLD = 110;
const VELOCITY_THRESHOLD = 600;
const FLY_DISTANCE = 560;

export const DeckCard = forwardRef<DeckCardHandle, DeckCardProps>(function DeckCard(
  { index, active, onSwiped, children },
  ref,
) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-16, 16]);
  const rightStamp = useTransform(x, [10, SWIPE_THRESHOLD], [0, 1]);
  const leftStamp = useTransform(x, [-SWIPE_THRESHOLD, -10], [1, 0]);
  const dragCardOpacity = useTransform(x, [-FLY_DISTANCE, 0, FLY_DISTANCE], [0, 1, 0]);

  useImperativeHandle(ref, () => ({
    fling: (direction) => {
      haptic(direction === 'right' ? 'medium' : 'light');
      animate(x, direction === 'right' ? FLY_DISTANCE : -FLY_DISTANCE, {
        type: 'spring',
        stiffness: 260,
        damping: 26,
      }).then(() => onSwiped(direction));
    },
  }));

  const stackScale = 1 - index * 0.045;
  const stackY = index * 14;
  const stackOpacity = 1 - index * 0.35;

  return (
    <motion.div
      className="absolute inset-x-0 top-0 bottom-0"
      style={{ zIndex: 100 - index }}
      initial={active ? { scale: stackScale, y: stackY, opacity: 0 } : false}
      animate={{ scale: stackScale, y: stackY, opacity: stackOpacity }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
    >
      <motion.div
        className="h-full w-full touch-none"
        style={active ? { x, rotate, opacity: dragCardOpacity } : undefined}
        drag={active ? 'x' : false}
        dragElastic={0.7}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={(_, info) => {
          const passedDistance = Math.abs(info.offset.x) > SWIPE_THRESHOLD;
          const passedVelocity = Math.abs(info.velocity.x) > VELOCITY_THRESHOLD;
          if (passedDistance || passedVelocity) {
            const direction = info.offset.x > 0 ? 'right' : 'left';
            haptic(direction === 'right' ? 'medium' : 'light');
            animate(x, direction === 'right' ? FLY_DISTANCE : -FLY_DISTANCE, {
              type: 'spring',
              stiffness: 260,
              damping: 26,
              velocity: info.velocity.x,
            }).then(() => onSwiped(direction));
          } else {
            animate(x, 0, { type: 'spring', stiffness: 420, damping: 32 });
          }
        }}
      >
        <div className="relative h-full w-full rounded-card overflow-hidden bg-surface border border-border-soft shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)]">
          {children}

          {active && (
            <>
              <motion.div
                style={{ opacity: rightStamp }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-accent pointer-events-none"
              >
                <div className="h-16 w-16 rounded-full border-[3px] border-accent-fg flex items-center justify-center">
                  <Check size={30} className="text-accent-fg" strokeWidth={3} />
                </div>
                <span className="text-accent-fg text-[22px] font-extrabold">Откликаюсь</span>
              </motion.div>
              <motion.div
                style={{ opacity: leftStamp }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-bg-elevated/95 pointer-events-none"
              >
                <div className="h-16 w-16 rounded-full border-[3px] border-text-faint flex items-center justify-center">
                  <X size={30} className="text-text-faint" strokeWidth={3} />
                </div>
                <span className="text-text-muted text-[22px] font-extrabold">Пропуск</span>
              </motion.div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
});
