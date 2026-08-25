import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, Check, X, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { DetailRow } from '@/components/ui/DetailRow';
import { CancelSheet } from '@/components/CancelSheet';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { useChatStore } from '@/store/useChatStore';
import { resolveCompany } from '@/data/companies';
import { formatDateRange, formatMoney, relativeDayRange, timeRange } from '@/lib/format';
import { hapticNotify } from '@/lib/telegram';
import { employmentTypeLabel } from '@/data/employmentTypes';
import { cn } from '@/lib/cn';
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
            {filtered.map((app, i) => (
              <motion.div
                key={app.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.03 }}
              >
                <ResponseCard
                  app={app}
                  chatId={chats.find((c) => c.shiftId === app.shift?.id)?.id}
                  onRespond={respondToInvite}
                  onCancel={setCancelling}
                  onOpenChat={(id) => navigate(`/w/chats/${id}`)}
                />
              </motion.div>
            ))}
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

/** One response. An invitation is a decision — "выйду или нет" — and the
 *  summary line alone (место, день, деньги) isn't enough to make it, so
 *  the card opens up to everything the vacancy actually said. Same
 *  expanding shape as a finished shift in «Мои смены».
 *
 *  Every action is a Button at the same size, so the row reads as one set
 *  of controls: the chat and decline buttons used to be hand-rolled
 *  h-11/h-10 boxes next to an h-14 Button and sat visibly short. */
function ResponseCard({
  app,
  chatId,
  onRespond,
  onCancel,
  onOpenChat,
}: {
  app: Application;
  chatId?: string;
  onRespond: (id: string, accept: boolean) => void;
  onCancel: (app: Application) => void;
  onOpenChat: (chatId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const shift = app.shift;
  if (!shift) return null;

  const company = resolveCompany(shift);
  const status = STATUS_COPY[app.status];
  // Backing out only makes sense before the shift's actually happened —
  // once checked in (or later), there's nothing left to cancel.
  const canCancel = app.status === 'accepted' && app.workStage === 'upcoming';
  const hours = shift.endHour - shift.startHour;
  const times = timeRange(shift.startHour, shift.startMin, shift.endHour, shift.endMin);

  return (
    <div className="rounded-card bg-surface border border-border-soft overflow-hidden">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 p-4 text-left">
        {company.avatarUrl ? (
          <Avatar src={company.avatarUrl} name={company.name} size={40} className="rounded-2xl" />
        ) : (
          <LogoBadge initial={company.logoInitial} color={company.logoColor} size={40} />
        )}
        {/* The badge shares the title's line, not the one below it: on a
            390px screen something has to give, and a truncated venue name
            costs less than a truncated wage. Day and pay then own a full
            line — the exact start time moved into «Время» in the expanded
            block rather than competing for room here. */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[15px] truncate">{shift.positionLabel} · {company.name}</p>
            <Badge tone={status.tone} className="shrink-0">{status.label}</Badge>
          </div>
          <p className="text-[13px] text-text-muted truncate mt-0.5">
            {relativeDayRange(shift.date, shift.endDate)} · {formatMoney(shift.totalPay)}
          </p>
        </div>
        <ChevronRight size={16} className={cn('text-text-faint shrink-0 transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="px-4 pb-3 -mt-1 space-y-2.5">
          <div className="rounded-xl bg-surface-2 px-3 py-2.5 space-y-1">
            <DetailRow label="Заведение" value={company.name} />
            {company.address && <DetailRow label="Адрес" value={company.address} />}
            <DetailRow label="Должность" value={shift.positionLabel} />
            <DetailRow label="Тип работы" value={employmentTypeLabel(shift.employmentType)} />
            {shift.employmentType !== 'permanent' && (
              <DetailRow label="Дата" value={formatDateRange(shift.date, shift.endDate)} />
            )}
            <DetailRow label="Время" value={`${times} · ${hours} ч`} />
            <DetailRow label="Ставка" value={`${formatMoney(shift.hourlyRate)}/ч`} />
            <DetailRow label="Итого" value={formatMoney(shift.totalPay)} />
          </div>

          {shift.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {shift.tags.map((tag) => (
                <Badge key={tag} tone="neutral">{tag}</Badge>
              ))}
            </div>
          )}

          {shift.description && (
            <p className="text-[13px] leading-relaxed text-text-muted whitespace-pre-line">{shift.description}</p>
          )}
        </div>
      )}

      {app.status === 'cancelled' && app.cancelReason && (
        <p className="text-[12px] text-text-faint px-4 pb-3 -mt-1">
          {app.cancelledBy === 'employer' ? 'Работодатель отменил' : 'Вы отменили'} — «{app.cancelReason}»
        </p>
      )}

      {app.status === 'invited' && (
        <div className="flex items-center gap-2 px-4 pb-4">
          <Button size="md" className="flex-1" onClick={() => onRespond(app.id, true)}>
            <Check size={16} /> Подтвердить
          </Button>
          {chatId && (
            <Button variant="dark" size="md" className="w-11 px-0 shrink-0" onClick={() => onOpenChat(chatId)} aria-label="Открыть чат">
              <MessageCircle size={17} />
            </Button>
          )}
          <Button variant="dark" size="md" className="w-11 px-0 shrink-0" onClick={() => onRespond(app.id, false)} aria-label="Отклонить">
            <X size={17} />
          </Button>
        </div>
      )}

      {app.status === 'accepted' && (chatId || canCancel) && (
        <div className="flex items-center gap-2 px-4 pb-4">
          {chatId && (
            <Button size="md" className="flex-1" onClick={() => onOpenChat(chatId)}>
              <MessageCircle size={16} /> Открыть чат
            </Button>
          )}
          {canCancel && (
            <Button
              variant="danger"
              size="md"
              className={cn('shrink-0', !chatId && 'flex-1')}
              onClick={() => {
                hapticNotify('warning');
                onCancel(app);
              }}
            >
              Не смогу выйти
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
