import { useEffect } from 'react';
import { Download, FileText } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { BarChart } from '@/components/charts/BarChart';
import { RankList } from '@/components/charts/RankList';
import { useDashboardStore } from '@/store/useDashboardStore';
import { formatNumber } from '@/lib/format';

export function Dashboard() {
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
    </div>
  );
}
