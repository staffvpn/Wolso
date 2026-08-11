import { useState } from 'react';
import type { Candidate } from '@/types';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { cn } from '@/lib/cn';

/** Tinder-style card: tap the left/right edge of the photo to cycle through
 *  the avatar + portfolio photos, everything else scrolls for the rest of
 *  the anketa (bio, skills, alcohol/smoking). */
export function CandidateCard({ candidate }: { candidate: Candidate }) {
  const [index, setIndex] = useState(0);
  const photos = candidate.photos;
  const hasPhotos = photos.length > 0;

  function prev() {
    setIndex((i) => (i === 0 ? Math.max(photos.length - 1, 0) : i - 1));
  }
  function next() {
    setIndex((i) => (i >= photos.length - 1 ? 0 : i + 1));
  }

  return (
    <div className="flex flex-col h-full">
      <div className="relative h-[42%] shrink-0 bg-surface-2 overflow-hidden">
        {hasPhotos ? (
          <img src={photos[index]} alt={candidate.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Avatar name={candidate.name} size={72} />
          </div>
        )}

        {photos.length > 1 && (
          <div className="absolute top-3 inset-x-3 flex gap-1">
            {photos.map((_, i) => (
              <div key={i} className={cn('h-[3px] flex-1 rounded-full', i === index ? 'bg-white' : 'bg-white/30')} />
            ))}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-4 right-4 text-white pointer-events-none">
          <h2 className="text-[21px] font-extrabold drop-shadow">
            {candidate.name}
            {candidate.age && <span className="font-semibold opacity-90">, {candidate.age}</span>}
          </h2>
          <p className="text-[13px] opacity-90">{candidate.positionLabel} · {candidate.city}</p>
        </div>

        {hasPhotos && photos.length > 1 && (
          <>
            <button onClick={prev} aria-label="Предыдущее фото" className="absolute inset-y-0 left-0 w-1/2" />
            <button onClick={next} aria-label="Следующее фото" className="absolute inset-y-0 right-0 w-1/2" />
          </>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent">★ {candidate.rating.toFixed(1)} · {candidate.shiftsCompleted} смен</Badge>
          {candidate.medBook && <Badge tone="dark">Медкнижка</Badge>}
          {candidate.smoking && <Badge tone="neutral">{candidate.smoking === 'yes' ? 'Курит' : 'Не курит'}</Badge>}
          {candidate.alcohol && <Badge tone="neutral">{candidate.alcohol === 'yes' ? 'Употребляет алкоголь' : 'Не употребляет алкоголь'}</Badge>}
        </div>

        {candidate.bio && <p className="text-[14px] text-text leading-relaxed">{candidate.bio}</p>}

        {candidate.skills && (
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-1">Навыки</p>
            <p className="text-[13px] text-text-muted leading-relaxed">{candidate.skills}</p>
          </div>
        )}
      </div>
    </div>
  );
}
