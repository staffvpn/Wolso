import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { useWalletStore } from '@/store/useWalletStore';
import { formatMoney, formatMoneySigned } from '@/lib/format';
import { cn } from '@/lib/cn';
import { FEATURES } from '@/lib/features';

export function Wallet() {
  const navigate = useNavigate();
  const { available, monthTotal, defaultCard, transactions, withdrawing, withdraw } = useWalletStore();

  if (!FEATURES.payments) return <Navigate to="/w/profile" replace />;

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Кошелёк" onBack={() => navigate(-1)} />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-card bg-accent p-5 mb-4"
        >
          <p className="text-[12px] font-semibold uppercase tracking-wide text-accent-fg/70">Доступно к выводу</p>
          <p className="text-[34px] font-extrabold text-accent-fg mt-1">{formatMoney(available)}</p>
          <div className="flex items-center gap-2 mt-4">
            <Button
              variant="dark"
              className="flex-1 bg-accent-fg text-accent border-none"
              disabled={available <= 0 || withdrawing}
              onClick={withdraw}
            >
              {withdrawing ? 'Выводим…' : 'Вывести на карту'}
            </Button>
            <IconButton size={44} className="bg-accent-fg/15 border-none text-accent-fg" aria-label="Ещё">
              <MoreHorizontal size={18} />
            </IconButton>
          </div>
        </motion.div>

        <div className="flex gap-3 mb-6">
          <div className="flex-1 rounded-card bg-surface border border-border-soft p-4">
            <p className="text-[18px] font-extrabold">{formatMoney(monthTotal)}</p>
            <p className="text-[12px] text-text-muted mt-0.5">за этот месяц</p>
          </div>
          <div className="flex-1 rounded-card bg-surface border border-border-soft p-4">
            <p className="text-[18px] font-extrabold">{defaultCard}</p>
            <p className="text-[12px] text-text-muted mt-0.5">карта по умолчанию</p>
          </div>
        </div>

        <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2.5">История</p>
        <div className="space-y-1">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5">
              <div
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                  tx.kind === 'payout_in' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-muted',
                )}
              >
                {tx.kind === 'payout_in' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[14px] truncate">{tx.title}</p>
                <p className="text-[12px] text-text-muted">{tx.subtitle}</p>
              </div>
              <span className={cn('font-bold text-[14px] shrink-0', tx.amount > 0 ? 'text-accent' : 'text-text')}>
                {formatMoneySigned(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
