import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, Mail, X } from 'lucide-react';
import { IconButton } from '../ui/IconButton';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { SafeImage } from '../ui/SafeImage';
import { formatExperience, formatRating } from '@/lib/format';
import { cn } from '@/lib/cn';
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

/** Full anketa for a candidate, laid out the same way a shift's detail
 *  view is: a tall photo header you tap through, then the details as real
 *  sections down the page. It used to just drop the compact swipe card
 *  into a bordered box, which meant "открыть кандидата" showed no more
 *  than the deck already did. */
export function CandidateDetailOverlay({
  candidate,
  onClose,
  onAccept,
  onDecline,
  onMessage,
  acceptLabel = 'Взять на смену',
}: CandidateDetailOverlayProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = candidate.photos;
  const hasPhotos = photos.length > 0;
  const experience = candidate.experience ?? [];

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

      <div className="flex-1 min-h-0 overflow-y-auto pb-4">
        <div className="relative h-80 shrink-0 bg-surface-2 overflow-hidden">
          {hasPhotos ? (
            <SafeImage key={photos[photoIndex]} src={photos[photoIndex]} alt={candidate.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <Avatar name={candidate.name} size={88} />
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
                onClick={() => setPhotoIndex((i) => (i === 0 ? photos.length - 1 : i - 1))}
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
          <h2 className="text-[26px] font-extrabold mt-4">
            {candidate.name}
            {candidate.age && <span className="font-semibold text-text-muted">, {candidate.age}</span>}
          </h2>
          <p className="text-[13px] text-text-muted mt-0.5">
            {[candidate.positionLabel, candidate.city].filter(Boolean).join(' · ')}
          </p>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge tone="accent">{formatRating(candidate.rating)}</Badge>
            <Badge tone="dark">{candidate.shiftsCompleted} смен отработано</Badge>
          </div>

          {candidate.bio && (
            <div className="mt-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-1.5">О себе</p>
              <p className="text-[14px] leading-relaxed text-text whitespace-pre-line">{candidate.bio}</p>
            </div>
          )}

          {experience.length > 0 && (
            <div className="mt-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2">Опыт работы</p>
              <div className="flex flex-col gap-1.5">
                {experience.map((e) => (
                  <div key={`${e.positionLabel}-${e.months}`} className="flex items-baseline justify-between gap-3 text-[14px]">
                    <span className="text-text">{e.positionLabel}</span>
                    <span className="text-text-faint shrink-0">{formatExperience(e.months)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {candidate.skills && (
            <div className="mt-5">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-1.5">Навыки</p>
              <p className="text-[14px] leading-relaxed text-text-muted whitespace-pre-line">{candidate.skills}</p>
            </div>
          )}
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
