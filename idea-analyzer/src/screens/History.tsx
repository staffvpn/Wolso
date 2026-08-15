import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MODES } from '@/data/modes';
import { useAnalysisStore } from '@/store/useAnalysisStore';
import { EmptyHistory } from '@/components/illustrations/EmptyHistory';
import { formatDate, truncate } from '@/lib/format';
import { hapticSelect } from '@/lib/telegram';

const MODE_COLOR: Record<string, string> = {
  praise: '#34d17c',
  criticize: '#f5a623',
  destroy: '#ef4d5e',
  monetize: '#fbbf24',
};

export function History() {
  const navigate = useNavigate();
  const history = useAnalysisStore((s) => s.history);
  const historyLoaded = useAnalysisStore((s) => s.historyLoaded);
  const loadHistory = useAnalysisStore((s) => s.loadHistory);

  useEffect(() => {
    if (!historyLoaded) loadHistory();
  }, [historyLoaded, loadHistory]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-5 pt-3 pb-2 safe-top shrink-0">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-9 w-9 rounded-full bg-surface-2 border border-border-soft flex items-center justify-center text-text-muted active:bg-surface-hover"
          aria-label="Назад"
        >
          <ArrowLeft size={16} />
        </button>
        <p className="font-bold text-[15px]">История разборов</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-6 safe-bottom">
        {historyLoaded && history.length === 0 && (
          <div className="flex flex-col items-center text-center pt-10 gap-4">
            <EmptyHistory className="w-[160px] h-[130px]" />
            <p className="text-text-muted text-[14px] max-w-[240px]">Здесь появятся все разобранные идеи</p>
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          {history.map((item) => {
            const meta = MODES[item.mode];
            const color = MODE_COLOR[item.mode];
            return (
              <button
                key={item.id}
                type="button"
                disabled={item.id === -1}
                onClick={() => {
                  hapticSelect();
                  navigate(`/history/${item.id}`);
                }}
                className="w-full rounded-card bg-surface border border-border-soft p-3.5 flex items-center gap-3 text-left active:bg-surface-hover transition-colors disabled:opacity-70"
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-[18px] shrink-0"
                  style={{ background: `${color}26` }}
                >
                  {meta.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[14px] truncate">{truncate(item.ideaText, 46)}</p>
                  <p className="text-[12px] text-text-faint truncate">{item.verdict}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-extrabold text-[15px]" style={{ color }}>
                    {item.score}
                  </p>
                  <p className="text-[11px] text-text-faint">{formatDate(item.createdAt)}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
