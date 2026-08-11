import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/ui/TopBar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useEmployerStore } from '@/store/useEmployerStore';
import { formatMoney, timeAgo } from '@/lib/format';

export function Vacancies() {
  const navigate = useNavigate();
  const vacancies = useEmployerStore((s) => s.vacancies);
  const candidates = useEmployerStore((s) => s.candidates);
  const loading = useEmployerStore((s) => s.loading);
  const loadAll = useEmployerStore((s) => s.loadAll);

  useEffect(() => {
    if (vacancies.length === 0) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar
        title="Вакансии"
        right={
          <button
            onClick={() => navigate('/e/vacancies/new')}
            className="h-10 w-10 rounded-full bg-accent text-accent-fg flex items-center justify-center"
            aria-label="Новая смена"
          >
            <Plus size={19} />
          </button>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {!loading && vacancies.length === 0 && (
          <EmptyState
            title="Пока нет вакансий"
            description="Опубликуйте первую смену — кандидаты начнут откликаться в течение часа."
          />
        )}

        <div className="space-y-3">
          {vacancies.map((vac, i) => {
            const total = candidates.filter((c) => c.vacancyId === vac.id).length;
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
                  <Badge tone={vac.status === 'active' ? 'accent' : 'neutral'}>
                    {vac.status === 'active' ? 'Активна' : 'Закрыта'}
                  </Badge>
                  <span className="text-[12px] text-text-faint">опубликовано {timeAgo(vac.publishedMinAgo)} назад</span>
                </div>
                <p className="font-bold text-[17px]">{vac.positionLabel} · сегодня</p>
                <p className="text-[13px] text-text-muted mt-0.5">
                  {String(vac.startHour).padStart(2, '0')}:{String(vac.startMin).padStart(2, '0')}–{String(vac.endHour).padStart(2, '0')}:{String(vac.endMin).padStart(2, '0')} · {formatMoney(vac.hourlyRate)}/ч
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge tone="dark">Отклики · {total}</Badge>
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
