import { type ReactNode } from 'react';
import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { createPortal } from 'react-dom';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
}

export function BottomSheet({ open, onClose, children, maxHeight = '88vh' }: BottomSheetProps) {
  const dragControls = useDragControls();

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[500] flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 800) onClose();
            }}
            className="relative w-full max-w-[560px] rounded-t-sheet bg-bg-elevated border-t border-x border-border flex flex-col"
            style={{ maxHeight }}
          >
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="w-full flex justify-center pt-2.5 pb-1.5 shrink-0 touch-none cursor-grab active:cursor-grabbing"
            >
              <div className="h-1.5 w-10 rounded-full bg-border" />
            </div>
            <div className="overflow-y-auto px-5 pb-5 safe-bottom">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
