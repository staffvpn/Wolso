import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Mail, Banknote, Star, UserPlus, UserCheck, UserX, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNotificationsStore } from '@/store/useNotificationsStore';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { AppNotification } from '@/types';

const ICONS: Record<AppNotification['kind'], typeof Check> = {
  accepted: Check,
  new_shifts: Zap,
  message: Mail,
  payout: Banknote,
  shift_closed: Star,
  invited: UserPlus,
  invite_accepted: UserCheck,
  invite_declined: UserX,
  cancelled_by_employer: XCircle,
  cancelled_by_worker: XCircle,
};

export function Notifications() {
  const navigate = useNavigate();
  const notifications = useNotificationsStore((s) => s.notifications);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const load = useNotificationsStore((s) => s.load);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar
        title="Уведомления"
        onBack={() => navigate(-1)}
        right={
          <button onClick={markAllRead} className="text-[13px] font-medium text-accent">
            Прочитать все
          </button>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {notifications.length === 0 ? (
          <EmptyState title="Пока ничего нет" />
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n, i) => {
              const Icon = ICONS[n.kind];
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.03 }}
                  className={cn('flex items-start gap-3 rounded-card p-4', n.read ? 'bg-surface' : 'bg-accent-soft')}
                >
                  <div
                    className={cn(
                      'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                      n.read ? 'bg-surface-2 text-text-muted' : 'bg-accent text-accent-fg',
                    )}
                  >
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px]">{n.title}</p>
                    <p className="text-[13px] text-text-muted mt-0.5">{n.subtitle}</p>
                  </div>
                  <span className="text-[11px] text-text-faint shrink-0">{timeAgo(n.minutesAgo)}</span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
