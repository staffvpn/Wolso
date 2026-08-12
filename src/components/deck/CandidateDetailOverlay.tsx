import { motion } from 'framer-motion';
import { Check, ChevronLeft, Mail, X } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { CandidateCard } from './CandidateCard';
import type { CandidateProfile } from '@/types';

interface CandidateDetailOverlayProps {
  candidate: CandidateProfile;
  onClose: () => void;
  /** Any of these left undefined just hides that action — lets the same
   *  overlay serve both "review an applicant" (accept/decline/message)
   *  and a plain "message this person" context with fewer buttons. */
  onAccept?: () => void;
  onDecline?: () => void;
  onMessage?: () => void;
  acceptLabel?: string;
}

/** Full anketa for a candidate — CandidateCard already shows everything
 *  (photos, bio, skills), this just gives it its own screen with real
 *  space instead of a cramped list row, plus the same decide/message
 *  actions available wherever this candidate is shown compactly. */
export function CandidateDetailOverlay({
  candidate,
  onClose,
  onAccept,
  onDecline,
  onMessage,
  acceptLabel = 'Взять на смену',
}: CandidateDetailOverlayProps) {
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
      </div>

      <div className="flex-1 min-h-0 px-5 pb-4">
        <div className="h-full rounded-card overflow-hidden border border-border-soft">
          <CandidateCard candidate={candidate} />
        </div>
      </div>

      {(onAccept || onDecline || onMessage) && (
        <div className="flex items-center justify-center gap-3 px-5 py-4 shrink-0 border-t border-border-soft">
          {onDecline && (
            <IconButton size={56} onClick={onDecline} aria-label="Отклонить">
              <X size={22} className="text-text-muted" />
            </IconButton>
          )}
          {onAccept && (
            <Button size="lg" className="flex-1 max-w-[220px]" onClick={onAccept}>
              <Check size={18} /> {acceptLabel}
            </Button>
          )}
          {onMessage && (
            <IconButton size={56} onClick={onMessage} aria-label="Написать">
              <Mail size={19} />
            </IconButton>
          )}
        </div>
      )}
    </motion.div>
  );
}
