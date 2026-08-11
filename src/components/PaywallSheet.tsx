import { Sparkles, Rocket, Undo2, Zap, HeadphonesIcon } from 'lucide-react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { PREMIUM_FEATURE_COPY, useEntitlementsStore, type PremiumFeature } from '@/store/useEntitlementsStore';

const ICONS: Record<PremiumFeature, typeof Rocket> = {
  boost: Rocket,
  undo: Undo2,
  unlimited_swipes: Zap,
  top_vacancy: Sparkles,
  priority_support: HeadphonesIcon,
};

export function PaywallSheet() {
  const feature = useEntitlementsStore((s) => s.paywallFeature);
  const close = useEntitlementsStore((s) => s.closePaywall);

  const Icon = feature ? ICONS[feature] : Sparkles;
  const copy = feature ? PREMIUM_FEATURE_COPY[feature] : null;

  return (
    <BottomSheet open={!!feature} onClose={close}>
      {copy && (
        <div className="flex flex-col items-center text-center gap-4 pt-2 pb-2">
          <div className="h-16 w-16 rounded-2xl bg-accent-soft flex items-center justify-center text-accent">
            <Icon size={28} />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1 rounded-full bg-warning-soft text-warning text-[12px] font-bold px-2.5 py-1 mb-1">
              Скоро в Wolso Pro
            </div>
            <h3 className="text-[19px] font-bold">{copy.title}</h3>
            <p className="text-[14px] leading-relaxed text-text-muted max-w-[300px]">{copy.description}</p>
          </div>
          <Button fullWidth onClick={close} className="mt-2">
            Понятно
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
