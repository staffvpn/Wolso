import { useEffect, useState } from 'react';
import { Award, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Input';
import { useCan } from '@/store/useSessionStore';
import { fetchWorkerAchievements, grantAchievement, revokeAchievement } from '@/services/achievementsApi';
import { formatDayMonth } from '@/lib/format';
import type { WorkerAchievement } from '@/types';
import { ACHIEVEMENT_ICONS } from '@/lib/achievementIcons';

/** Достижения одного соискателя — в той же карточке, что заметки и
 *  переписка: команда разбирается с человеком, глядя на его карточку
 *  целиком, а не бегает между разделами. Только для kind: 'seeker' —
 *  у работодателей своих бейджей нет. */
export function AchievementsBlock({ id }: { id: string }) {
  const canManage = useCan('manageAchievements');
  const [items, setItems] = useState<WorkerAchievement[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pickId, setPickId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    try {
      const list = await fetchWorkerAchievements(id);
      setItems(list);
      setLoaded(true);
    } catch {
      setItems([]);
      setLoaded(true);
    }
  }

  useEffect(() => {
    setPickId('');
    setNote('');
    setError(null);
    setLoaded(false);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const earned = items.filter((a) => a.earned);
  const notEarned = items.filter((a) => !a.earned);

  async function grant() {
    if (!pickId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await grantAchievement(id, pickId, note.trim() || undefined);
      setPickId('');
      setNote('');
      await reload();
    } catch {
      setError('Не получилось выдать — попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(achievementId: string) {
    await revokeAchievement(id, achievementId);
    await reload();
  }

  if (!loaded) return null;

  return (
    <div>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-2">
        Достижения{earned.length > 0 ? ` (${earned.length})` : ''}
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {earned.length === 0 && <p className="text-[13px] text-text-faint">Пока ничего не получено</p>}
        {earned.map((a) => {
          const Icon = ACHIEVEMENT_ICONS[a.icon] ?? Award;
          return (
            <div key={a.id} className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-3 py-2">
              <div className="h-7 w-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center shrink-0 mt-0.5">
                <Icon size={14} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-text">{a.title}</p>
                <p className="text-[12px] text-text-faint mt-0.5">
                  {a.earnedAt ? formatDayMonth(new Date(a.earnedAt)) : ''}
                  {a.note ? ` · ${a.note}` : ''}
                </p>
              </div>
              {canManage && (
                <button onClick={() => revoke(a.id)} aria-label="Забрать достижение" className="text-text-faint hover:text-danger shrink-0">
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canManage && notEarned.length > 0 && (
        <>
          <Select value={pickId} onChange={(e) => setPickId(e.target.value)}>
            <option value="">Выдать достижение…</option>
            {notEarned.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </Select>
          {pickId && (
            <Textarea rows={2} className="mt-2" value={note} onChange={(e) => setNote(e.target.value)} placeholder="За что — видно только команде" />
          )}
          {error && <p className="text-[12px] text-danger mt-1.5 leading-relaxed">{error}</p>}
          <Button variant="outline" className="w-full mt-2" disabled={!pickId || busy} onClick={grant}>
            {busy ? 'Выдаём…' : 'Выдать'}
          </Button>
        </>
      )}
    </div>
  );
}
