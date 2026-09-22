import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Check, Lock } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { useAchievementsStore } from '@/store/useAchievementsStore';
import { ACHIEVEMENT_ICONS } from '@/lib/achievementIcons';
import { formatDayMonth } from '@/lib/format';

export function Achievements() {
  const navigate = useNavigate();
  const { achievements, earnedCount, totalCount, loaded, load } = useAchievementsStore();

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Достижения" subtitle={loaded && totalCount > 0 ? `Получено ${earnedCount} из ${totalCount}` : undefined} onBack={() => navigate(-1)} />
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {!loaded && null}

        {loaded && totalCount === 0 && (
          <EmptyState
            icon={<Award size={26} />}
            title="Скоро"
            description="Бейджи за смены, рейтинг и стаж появятся здесь в одном из следующих обновлений."
          />
        )}

        {loaded && totalCount > 0 && (
          <div className="flex flex-col gap-2">
            {achievements.map((a) => {
              const Icon = ACHIEVEMENT_ICONS[a.icon] ?? Award;
              const progressPct = a.target ? Math.min(100, Math.round(((a.current ?? 0) / a.target) * 100)) : 0;
              return (
                <Card key={a.id} className={a.earned ? 'p-3.5 flex items-center gap-3' : 'p-3.5 flex items-start gap-3'}>
                  <div
                    className={
                      a.earned
                        ? 'h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center shrink-0'
                        : 'h-9 w-9 rounded-xl bg-surface-2 text-text-faint flex items-center justify-center shrink-0 mt-0.5'
                    }
                  >
                    {a.earned ? <Icon size={17} /> : <Lock size={17} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13.5px] font-bold ${a.earned ? 'text-text' : 'text-text-muted'}`}>{a.title}</p>
                    <p className="text-[11.5px] text-text-faint mt-0.5">
                      {a.earned
                        ? a.earnedAt
                          ? `Получено ${formatDayMonth(new Date(a.earnedAt))}`
                          : 'Получено'
                        : a.target != null
                          ? `${a.current ?? 0} / ${a.target}`
                          : a.description}
                    </p>
                    {!a.earned && a.target != null && (
                      <div className="h-1 rounded-full bg-surface-2 overflow-hidden mt-1.5">
                        <div className="h-full rounded-full bg-text-faint" style={{ width: `${progressPct}%` }} />
                      </div>
                    )}
                  </div>
                  {a.earned && (
                    <div className="h-[22px] w-[22px] rounded-full bg-accent text-accent-fg flex items-center justify-center shrink-0">
                      <Check size={12} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
