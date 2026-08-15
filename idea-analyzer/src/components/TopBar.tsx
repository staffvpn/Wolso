import { History, Star, Crown } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEntitlementStore } from '@/store/useEntitlementStore';
import { hapticSelect } from '@/lib/telegram';

export function TopBar() {
  const entitlement = useEntitlementStore((s) => s.entitlement);
  const navigate = useNavigate();
  const location = useLocation();
  const onHistory = location.pathname === '/history';

  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1 safe-top shrink-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[18px]">🧠</span>
        <span className="font-extrabold text-[16px] tracking-tight">Разнеси мою идею</span>
      </div>

      <div className="flex items-center gap-2">
        {entitlement?.isPro ? (
          <div className="flex items-center gap-1 rounded-full bg-accent-soft text-accent text-[12px] font-bold px-2.5 py-1.5">
            <Crown size={13} /> Pro
          </div>
        ) : (
          entitlement && (
            <div className="flex items-center gap-1 rounded-full bg-surface-2 border border-border-soft text-text-muted text-[12px] font-bold px-2.5 py-1.5">
              <Star size={12} className="text-monetize" fill="currentColor" />
              {entitlement.credits}
            </div>
          )
        )}
        <button
          type="button"
          onClick={() => {
            hapticSelect();
            navigate(onHistory ? '/' : '/history');
          }}
          className="h-9 w-9 rounded-full bg-surface-2 border border-border-soft flex items-center justify-center text-text-muted active:bg-surface-hover"
          aria-label="История разборов"
        >
          <History size={16} />
        </button>
      </div>
    </div>
  );
}
