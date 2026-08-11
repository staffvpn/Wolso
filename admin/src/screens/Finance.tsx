import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Download, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useFinanceStore } from '@/store/useFinanceStore';
import { useAuditStore } from '@/store/useAuditStore';
import { useCurrentActor } from '@/store/useSessionStore';
import { useCan } from '@/store/useSessionStore';
import { PLATFORM_COMMISSION_PCT } from '@/data/finance';
import { formatMoney, timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import { FEATURES } from '@/lib/features';
import type { Transaction } from '@/types';

const STATUS_BADGE: Record<Transaction['status'], { label: string; tone: 'accent' | 'warning' | 'danger' }> = {
  paid: { label: 'Выплачено', tone: 'accent' },
  processing: { label: 'В обработке', tone: 'warning' },
  dispute: { label: 'Спор', tone: 'danger' },
};

const AUDIT_TONE_DOT: Record<string, string> = { accent: 'bg-accent', danger: 'bg-danger', neutral: 'bg-text-faint' };

export function Finance() {
  const navigate = useNavigate();
  const { transactions, payoutToday, running, runPayouts, resolveDispute } = useFinanceStore();
  const allAuditEntries = useAuditStore((s) => s.entries);
  const auditEntries = useMemo(() => allAuditEntries.slice(0, 5), [allAuditEntries]);
  const actor = useCurrentActor();
  const canRunPayouts = useCan('refundsPayouts');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disputeTx, setDisputeTx] = useState<Transaction | null>(null);

  const processingCount = useMemo(() => transactions.filter((t) => t.status === 'processing').length, [transactions]);
  const disputeCount = useMemo(() => transactions.filter((t) => t.status === 'dispute').length, [transactions]);

  if (!FEATURES.payments) return <Navigate to="/dashboard" replace />;

  return (
    <div className="pb-10">
      <PageHeader
        title="Финансы"
        subtitle="август 2026"
        right={
          <>
            <Button variant="outline">
              <Download size={15} /> Выгрузить реестр
            </Button>
            <Button variant="primary" disabled={!canRunPayouts || payoutToday === 0} onClick={() => setConfirmOpen(true)}>
              <Wallet size={15} /> Провести выплаты
            </Button>
          </>
        }
      />

      <div className="px-8 grid grid-cols-3 gap-4">
        <StatCard label="К выплате сегодня" value={formatMoney(payoutToday)} />
        <StatCard label="Комиссия платформы" value={`${PLATFORM_COMMISSION_PCT}%`} />
        <StatCard label="Спорные выплаты" value={disputeCount} />
      </div>

      <div className="px-8 mt-4 grid grid-cols-[1.6fr_1fr] gap-4 items-start">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1.2fr_0.8fr_0.9fr] px-5 py-3 border-b border-border-soft text-[11px] font-semibold uppercase tracking-wide text-text-faint">
            <span>Исполнитель</span>
            <span>Смена</span>
            <span>Сумма</span>
            <span>Статус</span>
          </div>
          <div className="divide-y divide-border-soft">
            {transactions.map((t) => (
              <button
                key={t.id}
                onClick={() => t.status === 'dispute' && setDisputeTx(t)}
                className={cn('w-full grid grid-cols-[1.4fr_1.2fr_0.8fr_0.9fr] items-center px-5 py-3.5 text-left', t.status === 'dispute' && 'hover:bg-surface-2 cursor-pointer')}
              >
                <span className="text-[14px] font-semibold text-text truncate">{t.workerName}</span>
                <span className="text-[13px] text-text-muted truncate">{t.shiftLabel}</span>
                <span className="text-[14px] font-bold text-text">{formatMoney(t.amount)}</span>
                <span><Badge tone={STATUS_BADGE[t.status].tone}>{STATUS_BADGE[t.status].label}</Badge></span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <p className="font-bold text-[15px] mb-1">Аудит-лог</p>
          <p className="text-[12px] text-text-faint mb-4">Все действия команды, без удаления</p>
          <div className="space-y-3.5">
            {auditEntries.map((e) => (
              <div key={e.id} className="flex gap-2.5">
                <span className={cn('h-1.5 w-1.5 rounded-full mt-1.5 shrink-0', AUDIT_TONE_DOT[e.tone])} />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-text">
                    <span className="font-semibold">{e.actorName}</span> {e.action}
                  </p>
                  <p className="text-[11px] text-text-faint mt-0.5">{timeAgo(e.minutesAgo)} · {e.actorRoleLabel}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="outline" className="w-full mt-5" onClick={() => navigate('/audit-log')}>
            Весь журнал
          </Button>
        </Card>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Провести выплаты"
        description={`${processingCount} выплат на сумму ${formatMoney(payoutToday)}`}
      >
        <p className="text-[14px] text-text-muted leading-relaxed mb-5">
          Деньги уйдут на карты исполнителей в течение часа. Действие нельзя отменить — подтвердите, что реестр проверен.
        </p>
        <div className="flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Отмена</Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={running}
            onClick={async () => {
              await runPayouts(actor);
              setConfirmOpen(false);
            }}
          >
            {running ? 'Проводим…' : 'Подтвердить'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!disputeTx} onClose={() => setDisputeTx(null)} title="Спорная выплата" description={disputeTx ? `${disputeTx.workerName} · ${disputeTx.shiftLabel}` : ''}>
        {disputeTx && (
          <div>
            <p className="text-[14px] text-text-muted leading-relaxed mb-5">
              Сумма {formatMoney(disputeTx.amount)} удержана до разрешения спора. Свяжитесь с обеими сторонами перед решением.
            </p>
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  resolveDispute(disputeTx.id, 'dispute', actor);
                  setDisputeTx(null);
                }}
              >
                Оставить в споре
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  resolveDispute(disputeTx.id, 'paid', actor);
                  setDisputeTx(null);
                }}
              >
                Разрешить и выплатить
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
