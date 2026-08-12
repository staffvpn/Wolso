import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { Badge } from '@/components/ui/Badge';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { useChatStore } from '@/store/useChatStore';
import { resolveCompany } from '@/data/companies';
import { formatMoney, relativeDay } from '@/lib/format';
import type { ApplicationStatus } from '@/types';

type Tab = 'all' | 'pending' | 'accepted';

const STATUS_COPY: Record<ApplicationStatus, { label: string; tone: 'accent' | 'neutral' | 'danger' }> = {
  accepted: { label: 'Вас взяли', tone: 'accent' },
  pending: { label: 'Ждём ответа', tone: 'neutral' },
  declined: { label: 'Отказ', tone: 'danger' },
};

export function Responses() {
  const navigate = useNavigate();
  const applications = useApplicationsStore((s) => s.applications);
  const loadApplications = useApplicationsStore((s) => s.load);
  const chats = useChatStore((s) => s.chats);
  const loadChats = useChatStore((s) => s.load);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    loadApplications();
    loadChats('worker');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'pending') return applications.filter((a) => a.status === 'pending');
    if (tab === 'accepted') return applications.filter((a) => a.status === 'accepted');
    return applications;
  }, [applications, tab]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Мои отклики" />

      <div className="flex gap-2 px-5 pb-3 shrink-0">
        <Chip tone="dark" selected={tab === 'all'} onClick={() => setTab('all')}>
          Все · {applications.length}
        </Chip>
        <Chip tone="dark" selected={tab === 'pending'} onClick={() => setTab('pending')}>
          Ждут ответа
        </Chip>
        <Chip tone="dark" selected={tab === 'accepted'} onClick={() => setTab('accepted')}>
          Приняты
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
                        {relativeDay(new Date(shift.date))} {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')} · {formatMoney(shift.totalPay)}
                      </p>
                    </div>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>

                  {app.status === 'accepted' && chat && (
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => navigate(`/w/chats/${chat.id}`)}
                        className="flex-1 h-10 rounded-2xl bg-accent text-accent-fg font-semibold text-[14px] flex items-center justify-center gap-1.5"
                      >
                        <MessageCircle size={15} /> Открыть чат
                      </button>
                      <IconButton size={40} aria-label="Маршрут">
                        <MapPin size={16} />
                      </IconButton>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
