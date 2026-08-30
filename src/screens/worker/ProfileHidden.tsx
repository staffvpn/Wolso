import { EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useProfileStore } from '@/store/useProfileStore';

/** Shown in place of the shift deck once staff have hidden the anketa.
 *  Unlike AccountSuspended this isn't a dead end — the rest of the app
 *  stays available, because hiding doesn't cancel anything already agreed:
 *  the person still has their chats, confirmed shifts and reviews.
 *
 *  It exists so the restriction isn't silent. The server refuses new
 *  responses from a hidden anketa (see applications.ts), and a swipe that
 *  quietly failed would leave someone swiping into a void for days. */
export function ProfileHidden() {
  const navigate = useNavigate();
  const reason = useProfileStore((s) => s.hiddenReason);

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-4 text-center safe-top safe-bottom">
      <div className="h-14 w-14 rounded-full bg-surface-2 flex items-center justify-center">
        <EyeOff size={26} className="text-text-muted" />
      </div>

      <div className="space-y-1.5">
        <h1 className="font-extrabold text-[20px]">Анкета скрыта</h1>
        <p className="text-[14px] text-text-muted max-w-[300px] leading-relaxed">
          Пока анкета скрыта, работодатели не видят её в поиске, а откликаться на новые смены нельзя. Смены, о которых вы
          уже договорились, и чаты остались на месте.
        </p>
      </div>

      {reason && (
        <div className="w-full max-w-[320px] rounded-2xl bg-surface border border-border p-4 text-left">
          <p className="text-[12px] font-semibold text-text-muted mb-1">Что не так</p>
          <p className="text-[14px] leading-relaxed whitespace-pre-line">{reason}</p>
        </div>
      )}

      <Button variant="dark" onClick={() => navigate('/w/profile')}>
        Открыть анкету
      </Button>

      <p className="text-[13px] text-text-faint max-w-[300px] leading-relaxed">
        Поправьте анкету и напишите в поддержку — её вернут в поиск.
      </p>
    </div>
  );
}
