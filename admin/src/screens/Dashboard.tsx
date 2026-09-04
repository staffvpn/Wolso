import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { BarChart } from '@/components/charts/BarChart';
import { RankList } from '@/components/charts/RankList';
import { Funnel } from '@/components/Funnel';
import { useDashboardStore } from '@/store/useDashboardStore';
import { fetchFunnel, type Funnel as FunnelData } from '@/services/funnelApi';
import { downloadExport, EXPORT_LABEL, type ExportDataset } from '@/services/exportApi';
import { formatNumber } from '@/lib/format';

const FUNNEL_WINDOWS = [7, 30, 90];

export function Dashboard() {
  const stats = useDashboardStore((st) => st.stats);
  const load = useDashboardStore((st) => st.load);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [days, setDays] = useState(30);
  const [exporting, setExporting] = useState<ExportDataset | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchFunnel(days).then(setFunnel).catch(() => setFunnel(null));
  }, [days]);

  async function exportCsv(dataset: ExportDataset) {
    setExporting(dataset);
    setExportError(null);
    try {
      await downloadExport(dataset);
    } catch {
      setExportError('Не получилось выгрузить. Выгрузка доступна только с правом «Управление данными».');
    } finally {
      setExporting(null);
    }
  }

  if (!stats) return null;
  const s = stats;
  const weeklyResponses = s.weekly.reduce((sum, d) => sum + d.responses, 0);

  return (
    <div className="pb-10">
      <PageHeader
        title="Дашборд"
        subtitle="Москва · последние 30 дней"
        right={
          /* Раньше здесь были «Экспорт CSV» и «Отчёт» — обе без обработчика,
             то есть просто нарисованные. Теперь одна кнопка на набор, и она
             действительно скачивает файл. */
          <>
            {(Object.keys(EXPORT_LABEL) as ExportDataset[]).map((d) => (
              <Button key={d} variant="outline" disabled={exporting !== null} onClick={() => exportCsv(d)}>
                <Download size={15} /> {exporting === d ? 'Готовим…' : EXPORT_LABEL[d]}
              </Button>
            ))}
          </>
        }
      />

      {exportError && <p className="px-4 sm:px-8 pb-3 text-[13px] text-danger leading-relaxed max-w-3xl">{exportError}</p>}

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

      {funnel && (
        <div className="px-4 sm:px-8 mt-4">
          <Card className="p-6">
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
              <p className="font-bold text-[15px]">Воронка</p>
              <div className="flex gap-1.5">
                {FUNNEL_WINDOWS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={
                      d === days
                        ? 'h-8 px-3 rounded-lg bg-text text-bg text-[13px] font-semibold'
                        : 'h-8 px-3 rounded-lg bg-surface-2 text-text-muted text-[13px] font-medium'
                    }
                  >
                    {d} дней
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-3">Соискатели</p>
                <Funnel steps={funnel.workers} />
              </div>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-3">Работодатели</p>
                <Funnel steps={funnel.companies} />
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
