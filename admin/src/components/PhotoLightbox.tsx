import { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxPhoto {
  id: string;
  url: string;
}

/** Full-size view of a photo someone uploaded. The dashboard only ever
 *  showed 64px thumbnails, which is enough to see that a photo exists and
 *  not enough to see what's in it — the whole point of looking at an
 *  anketa.
 *
 *  Rendered through a portal because the panel it's opened from lives
 *  inside a scrolling, overflow-hidden card: a fixed overlay nested in
 *  there gets clipped instead of covering the page. */
export function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: LightboxPhoto[];
  index: number;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const count = photos.length;
  const go = useCallback(
    (delta: number) => onIndexChange((index + delta + count) % count),
    [index, count, onIndexChange],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go]);

  const photo = photos[index];
  if (!photo) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Просмотр фото"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 sm:p-8"
    >
      <button
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        <X size={20} />
      </button>

      {count > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            aria-label="Предыдущее фото"
            className="absolute left-3 sm:left-6 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            aria-label="Следующее фото"
            className="absolute right-3 sm:right-6 h-11 w-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Clicking the picture itself must not close: the backdrop is the
          dismiss target, and people click the photo to look at it. */}
      <img
        src={photo.url}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full object-contain rounded-lg"
      />

      {count > 1 && (
        <span className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[13px] font-medium text-white/80 tabular-nums">
          {index + 1} / {count}
        </span>
      )}
    </div>,
    document.body,
  );
}
