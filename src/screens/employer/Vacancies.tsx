import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEmployerStore } from '@/store/useEmployerStore';
import { useCompanyStore } from '@/store/useCompanyStore';
import { formatMoney, timeAgoSince } from '@/lib/format';

const STATUS_LABEL: Record<string, string> = {
  active: 'Активна',
  pending_review: 'На модерации',
  rejected: 'Отклонена',
};
const STATUS_TONE: Record<string, 'accent' | 'neutral' | 'danger'> = {
  active: 'accent',
  pending_review: 'neutral',
  rejected: 'danger',
};

export function Vacancies() {
  const navigate = useNavigate();
  const vacancies = useEmployerStore((s) => s.vacancies);
  const candidates = useEmployerStore((s) => s.candidates);
  const loading = useEmployerStore((s) => s.loading);
  const loadAll = useEmployerStore((s) => s.loadAll);
  const company = useCompanyStore((s) => s.company);
  const loadCompany = useCompanyStore((s) => s.load);
  const approved = company?.verificationStatus === 'approved';

  useEffect(() => {
    if (vacancies.length === 0) loadAll();
    if (!company) loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar
        title="Вакансии"
        right={
          <button
            onClick={() => approved && navigate('/e/vacancies/new')}
            disabled={!approved}
            className="h-10 w-10 rounded-full bg-accent text-accent-fg flex items-center justify-center disabled:opacity-40"
            aria-label="Новая смена"
          >
            <Plus size={19} />
          </button>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {!approved && company && (
          <div className="flex items-start gap-3 rounded-card bg-warning-soft text-warning px-4 py-3 mb-4">
            <Clock size={17} className="shrink-0 mt-0.5" />
            <p className="text-[13px] leading-relaxed">
              {company.verificationStatus === 'rejected'
                ? 'Проверка не пройдена — публикация вакансий недоступна, напишите в поддержку.'
                : 'Заведение ещё на проверке — как только Wolso одобрит профиль, сможете публиковать вакансии.'}
            </p>
          </div>
        )}

        {!loading && vacancies.length === 0 && (
          <EmptyState
            title="Пока нет вакансий"
            description="Опубликуйте первую смену — кандидаты начнут откликаться в течение часа."
          />
        )}

        <div className="space-y-3">
          {vacancies.map((vac, i) => {
            const pending = candidates.filter((c) => c.vacancyId === vac.id && c.status === 'pending').length;
            return (
              <motion.button
                key={vac.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.04 }}
                onClick={() => navigate(`/e/vacancies/${vac.id}`)}
                className="w-full text-left rounded-card bg-surface border border-border-soft p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <Badge tone={STATUS_TONE[vac.status] ?? 'neutral'}>{STATUS_LABEL[vac.status] ?? vac.status}</Badge>
                  <span className="text-[12px] text-text-faint">опубликовано {timeAgoSince(vac.createdAt)} назад</span>
                </div>
                <p className="font-bold text-[17px]">{vac.positionLabel} · сегодня</p>
                <p className="text-[13px] text-text-muted mt-0.5">
                  {String(vac.startHour).padStart(2, '0')}:{String(vac.startMin).padStart(2, '0')}–{String(vac.endHour).padStart(2, '0')}:{String(vac.endMin).padStart(2, '0')} · {formatMoney(vac.hourlyRate)}/ч
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge tone="dark">Отклики · {vac.responseCount}</Badge>
                  {pending > 0 && <Badge tone="warning">{pending} ждут решения</Badge>}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
