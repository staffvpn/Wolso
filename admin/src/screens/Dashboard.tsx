import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { BarChart } from '@/components/charts/BarChart';
import { RankList } from '@/components/charts/RankList';
import { useDashboardStore } from '@/store/useDashboardStore';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

const ATTENTION_LINKS: Record<string, string> = {
  'Вакансии на модерации': '/moderation',
  'Жалобы на работодателей': '/moderation',
};

const TONE_DOT: Record<string, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
};

export function Dashboard() {
  const navigate = useNavigate();
  const stats = useDashboardStore((st) => st.stats);
  const load = useDashboardStore((st) => st.load);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) return null;
  const s = stats;
  const weeklyResponses = s.weekly.reduce((sum, d) => sum + d.responses, 0);

  return (
    <div className="pb-10">
      <PageHeader
        title="Дашборд"
        subtitle="Москва · последние 30 дней"
        right={
          <>
            <Button variant="outline">
              <Download size={15} /> Экспорт CSV
            </Button>
            <Button variant="dark">
              <FileText size={15} /> Отчёт
            </Button>
          </>
        }
      />

      <div className="px-4 sm:px-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Смен опубликовано" value={formatNumber(s.vacanciesPublished)} delta={`${s.vacanciesPublishedDeltaPct}% к июлю`} />
        <StatCard label="Закрыто в тот же день" value={`${s.closedSameDayPct}%`} delta={`${s.closedSameDayDeltaPp} п.п.`} />
        <StatCard label="Активных исполнителей" value={formatNumber(s.activeWorkers)} delta={`${s.activeWorkersDeltaPct}%`} />
        <StatCard label="Откликов за неделю" value={formatNumber(weeklyResponses)} dark />
      </div>

      <div className="px-4 sm:px-8 mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-6">
          <p className="font-bold text-[15px] mb-5">Смены и отклики по дням</p>
          <BarChart data={s.weekly} />
        </Card>

        <div className="space-y-4">
          <Card className="p-6">
            <p className="font-bold text-[15px] mb-4">Топ должностей</p>
            <RankList items={s.topPositions} />
          </Card>
        </div>
      </div>

      <div className="px-4 sm:px-8 mt-4">
        <Card className="p-6">
          <p className="font-bold text-[15px] mb-2">Требует внимания</p>
          <div className="divide-y divide-border-soft">
            {s.attention.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(ATTENTION_LINKS[a.label] ?? '/moderation')}
                className="w-full flex items-center justify-between py-3 text-left group"
              >
                <span className="flex items-center gap-2.5 text-[14px] font-medium text-text">
                  <span className={cn('h-2 w-2 rounded-full', TONE_DOT[a.tone])} />
                  {a.label}
                </span>
                <span className="text-[14px] font-bold text-text-muted group-hover:text-text transition-colors">{a.count}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
