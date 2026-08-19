import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Check, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { CancelSheet } from '@/components/CancelSheet';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { useChatStore } from '@/store/useChatStore';
import { resolveCompany } from '@/data/companies';
import { formatMoney, relativeDayRange } from '@/lib/format';
import { hapticNotify } from '@/lib/telegram';
import type { Application, ApplicationStatus } from '@/types';

type Tab = 'all' | 'invited' | 'pending' | 'accepted';

const STATUS_COPY: Record<ApplicationStatus, { label: string; tone: 'accent' | 'neutral' | 'danger' }> = {
  invited: { label: 'Приглашение!', tone: 'accent' },
  accepted: { label: 'Вы подтвердили', tone: 'accent' },
  pending: { label: 'Ждём ответа', tone: 'neutral' },
  declined: { label: 'Отказ', tone: 'danger' },
  cancelled: { label: 'Отменено', tone: 'danger' },
};

export function Responses() {
  const navigate = useNavigate();
  const applications = useApplicationsStore((s) => s.applications);
  const loadApplications = useApplicationsStore((s) => s.load);
  const respondToInvite = useApplicationsStore((s) => s.respondToInvite);
  const cancelApplication = useApplicationsStore((s) => s.cancelApplication);
  const chats = useChatStore((s) => s.chats);
  const loadChats = useChatStore((s) => s.load);
  const [tab, setTab] = useState<Tab>('all');
  const [cancelling, setCancelling] = useState<Application | null>(null);

  useEffect(() => {
    loadApplications();
    loadChats('worker');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the employer has closed the shift it isn't an open response any
  // more — it's work history, and it moves to "Мои смены". Leaving it here
  // is what made a finished shift keep saying "Вы подтвердили".
  const open = useMemo(
    () => applications.filter((a) => a.workStage !== 'employer_closed' && a.workStage !== 'reviewed'),
    [applications],
  );

  const invitedCount = useMemo(() => open.filter((a) => a.status === 'invited').length, [open]);

  const filtered = useMemo(() => {
    if (tab === 'invited') return open.filter((a) => a.status === 'invited');
    if (tab === 'pending') return open.filter((a) => a.status === 'pending');
    if (tab === 'accepted') return open.filter((a) => a.status === 'accepted');
    return open;
  }, [open, tab]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Мои отклики" />

      <div className="flex gap-2 px-5 pb-3 shrink-0 overflow-x-auto">
        <Chip tone="dark" selected={tab === 'all'} onClick={() => setTab('all')}>
          Все · {open.length}
        </Chip>
        {invitedCount > 0 && (
          <Chip tone="dark" selected={tab === 'invited'} onClick={() => setTab('invited')}>
            Приглашения · {invitedCount}
          </Chip>
        )}
        <Chip tone="dark" selected={tab === 'pending'} onClick={() => setTab('pending')}>
          Ждут ответа
        </Chip>
        <Chip tone="dark" selected={tab === 'accepted'} onClick={() => setTab('accepted')}>
          Подтверждены
        </Chip>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {filtered.length === 0 ? (
          <EmptyState
            title="Пока пусто"
            description="Откликайтесь на смены в ленте — они появятся здесь."
            actions={null}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((app, i) => {
              const shift = app.shift;
              if (!shift) return null;
              const company = resolveCompany(shift);
              const status = STATUS_COPY[app.status];
              const chat = chats.find((c) => c.shiftId === shift.id);
              // Backing out only makes sense before the shift's actually
              // happened — once checked in (or later), there's nothing
              // left to cancel.
              const canCancel = app.status === 'accepted' && app.workStage === 'upcoming';

              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 6) * 0.03 }}
                  className="rounded-card bg-surface border border-border-soft p-4"
                >
                  <div className="flex items-center gap-3">
                    {company.avatarUrl ? (
                      <Avatar src={company.avatarUrl} name={company.name} size={40} className="rounded-2xl" />
                    ) : (
                      <LogoBadge initial={company.logoInitial} color={company.logoColor} size={40} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[15px] truncate">{shift.positionLabel} · {company.name}</p>
                      <p className="text-[13px] text-text-muted truncate">
                        {relativeDayRange(shift.date, shift.endDate)} {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')} · {formatMoney(shift.totalPay)}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>

                  {app.status === 'cancelled' && app.cancelReason && (
                    <p className="text-[12px] text-text-faint mt-2">
                      {app.cancelledBy === 'employer' ? 'Работодатель отменил' : 'Вы отменили'} — «{app.cancelReason}»
                    </p>
                  )}

                  {app.status === 'invited' && (
                    <div className="flex items-center gap-2 mt-3">
                      <Button className="flex-1" onClick={() => respondToInvite(app.id, true)}>
                        <Check size={16} /> Подтвердить
                      </Button>
                      <Button variant="dark" size="icon" onClick={() => respondToInvite(app.id, false)} aria-label="Отклонить">
                        <X size={17} />
                      </Button>
                      {chat && (
                        <button
                          onClick={() => navigate(`/w/chats/${chat.id}`)}
                          className="h-11 w-11 rounded-2xl bg-surface-2 flex items-center justify-center shrink-0"
                          aria-label="Открыть чат"
                        >
                          <MessageCircle size={17} />
                        </button>
                      )}
                    </div>
                  )}

                  {app.status === 'accepted' && (
                    <div className="flex items-center gap-2 mt-3">
                      {chat && (
                        <button
                          onClick={() => navigate(`/w/chats/${chat.id}`)}
                          className="flex-1 h-10 rounded-2xl bg-accent text-accent-fg font-semibold text-[14px] flex items-center justify-center gap-1.5"
                        >
                          <MessageCircle size={15} /> Открыть чат
                        </button>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => {
                            hapticNotify('warning');
                            setCancelling(app);
                          }}
                          className="text-[13px] font-semibold text-danger shrink-0 px-2"
                        >
                          Не смогу выйти
                        </button>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {cancelling && (
        <CancelSheet
          open
          onClose={() => setCancelling(null)}
          title="Не сможете выйти на смену?"
          description="Работодатель получит уведомление с причиной, чат по этой смене закроется."
          confirmLabel="Отменить смену"
          onSubmit={(reason) => cancelApplication(cancelling.id, reason)}
        />
      )}
    </div>
  );
}
