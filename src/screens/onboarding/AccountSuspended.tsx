import { Ban } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { formatDayMonth } from '@/lib/format';

/** Shown instead of the whole app once staff have blocked the account.
 *  Deliberately a dead end with no way past it — the point is that a
 *  blocked person can't use Wolso, which is exactly what wasn't true
 *  before: the block was written to the database and never enforced.
 *
 *  The reason is shown because "вас заблокировали" on its own tells
 *  someone nothing and just sends them to support. */
export function AccountSuspended() {
  const suspension = useAuthStore((s) => s.suspension);
  const at = suspension?.at ? new Date(suspension.at) : null;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-4 text-center safe-top safe-bottom">
      <div className="h-14 w-14 rounded-full bg-danger-soft flex items-center justify-center">
        <Ban size={26} className="text-danger" />
      </div>

      <div className="space-y-1.5">
        <h1 className="font-extrabold text-[20px]">Доступ закрыт</h1>
        <p className="text-[14px] text-text-muted max-w-[300px] leading-relaxed">
          Ваш аккаунт заблокирован администрацией Wolso.
          {at && !Number.isNaN(at.getTime()) ? ` ${formatDayMonth(at)}.` : ''}
        </p>
      </div>

      {suspension?.reason && (
        <div className="w-full max-w-[320px] rounded-2xl bg-surface border border-border p-4 text-left">
          <p className="text-[12px] font-semibold text-danger mb-1">Причина</p>
          <p className="text-[14px] leading-relaxed whitespace-pre-line">{suspension.reason}</p>
        </div>
      )}

      <p className="text-[13px] text-text-faint max-w-[300px] leading-relaxed">
        Если считаете это ошибкой — напишите в поддержку в Telegram.
      </p>
    </div>
  );
}
