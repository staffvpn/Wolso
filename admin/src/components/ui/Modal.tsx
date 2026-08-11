import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { IconButton } from './IconButton';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, description, children, width = 440 }: ModalProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="relative w-full rounded-2xl bg-white shadow-2xl max-h-[86vh] flex flex-col"
            style={{ maxWidth: width }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border-soft shrink-0">
              <div>
                <h2 className="text-[17px] font-bold text-text">{title}</h2>
                {description && <p className="text-[13px] text-text-muted mt-1">{description}</p>}
              </div>
              <IconButton onClick={onClose} aria-label="Закрыть">
                <X size={18} />
              </IconButton>
            </div>
            <div className="px-6 py-5 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
