import { Star, Crown, Zap } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { usePaywallStore } from '@/store/usePaywallStore';

export function PaywallSheet() {
  const open = usePaywallStore((s) => s.open);
  const close = usePaywallStore((s) => s.closePaywall);
  const purchase = usePaywallStore((s) => s.purchase);
  const status = usePaywallStore((s) => s.purchaseStatus);
  const error = usePaywallStore((s) => s.purchaseError);

  return (
    <BottomSheet open={open} onClose={close}>
      <div className="flex flex-col items-center text-center gap-4 pt-1 pb-2">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-accent-2))' }}
        >
          <Zap size={24} className="text-white" />
        </div>
        <div className="space-y-1">
          <h3 className="text-[19px] font-bold">Бесплатный разбор закончился</h3>
          <p className="text-[14px] leading-relaxed text-text-muted max-w-[280px]">
            Дальше — за звёзды Telegram. Один разбор или безлимит на месяц.
          </p>
        </div>

        <div className="w-full flex flex-col gap-2.5 mt-1">
          <button
            type="button"
            disabled={status === 'pending'}
            onClick={() => purchase('credit')}
            className="w-full rounded-2xl border border-border bg-surface p-4 flex items-center justify-between active:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <div className="text-left">
              <p className="font-bold text-[15px]">Один разбор</p>
              <p className="text-[12px] text-text-faint">Разово, без подписки</p>
            </div>
            <div className="flex items-center gap-1 font-extrabold text-[16px]">
              <Star size={15} className="text-monetize" fill="currentColor" />
              79
            </div>
          </button>

          <button
            type="button"
            disabled={status === 'pending'}
            onClick={() => purchase('pro')}
            className="w-full rounded-2xl p-4 flex items-center justify-between text-left relative overflow-hidden disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(236,72,153,0.18))', border: '1px solid rgba(139,92,246,0.4)' }}
          >
            <div>
              <div className="flex items-center gap-1.5">
                <Crown size={14} className="text-accent" />
                <p className="font-bold text-[15px]">Pro на месяц</p>
              </div>
              <p className="text-[12px] text-text-faint">Безлимит разборов во всех режимах</p>
            </div>
            <div className="flex items-center gap-1 font-extrabold text-[16px]">
              <Star size={15} className="text-monetize" fill="currentColor" />
              249
            </div>
          </button>
        </div>

        {error && <p className="text-danger text-[13px] font-medium">{error}</p>}

        <Button variant="ghost" fullWidth onClick={close} className="mt-1">
          {status === 'pending' ? 'Ждём оплату…' : 'Не сейчас'}
        </Button>
      </div>
    </BottomSheet>
  );
}
