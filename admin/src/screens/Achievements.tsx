import { useEffect, useState } from 'react';
import { Award, Pause, Pencil, Play, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAchievementsStore } from '@/store/useAchievementsStore';
import { useCan } from '@/store/useSessionStore';
import { cn } from '@/lib/cn';
import { ACHIEVEMENT_ICONS } from '@/lib/achievementIcons';
import type { Achievement, AchievementConditionType, AchievementInput } from '@/types';

const CONDITION_LABELS: Record<AchievementConditionType, string> = {
  first_response: 'Есть хотя бы один отклик',
  shifts_completed: 'Число закрытых смен ≥ порога',
  own_photo: 'Загружено своё фото (не из Telegram)',
  profile_complete: 'Анкета заполнена: о себе, навыки и фото',
  active_week: 'N и больше смен за одну календарную неделю',
  distinct_positions: 'N и больше разных профессий отработано',
  top_performer: 'Рейтинг ≥ порога и отзывов получено ≥ порога 2',
  no_cancel_streak: 'N смен подряд без отмены со стороны работника',
  fast_response: 'Средний отклик быстрее N минут (от 5 откликов)',
  tenure_months: 'N и больше месяцев с даты регистрации',
  reviews_given: 'Оставлено отзывов работодателям ≥ N',
};

const NEEDS_THRESHOLD2: AchievementConditionType[] = ['top_performer'];

const EMPTY: AchievementInput = {
  title: '',
  description: '',
  icon: 'Award',
  kind: 'auto',
  conditionType: 'shifts_completed',
  threshold: 10,
  threshold2: null,
  sortOrder: 500,
};

export function Achievements() {
  const { achievements, loading, loaded, error, load, create, update, setStatus, remove, recompute, recomputing, recomputeResult } =
    useAchievementsStore();
  const canManage = useCan('manageAchievements');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pb-10">
      <PageHeader
        title="Достижения"
        subtitle="Бейджи соискателей в мини-аппе"
        right={
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={!canManage || recomputing} onClick={recompute}>
              <RefreshCw size={15} className={cn(recomputing && 'animate-spin')} /> {recomputing ? 'Пересчитываем…' : 'Пересчитать'}
            </Button>
            <Button variant="primary" disabled={!canManage} onClick={() => setCreateOpen(true)}>
              Добавить
            </Button>
          </div>
        }
      />

      <div className="px-4 sm:px-8">
        {error === 'migration_required' && (
          <Card className="p-5 mb-4 border-warning">
            <p className="font-semibold text-[14px]">Не применена миграция 0040_achievements</p>
            <p className="text-[13px] text-text-muted mt-1">Таблиц для достижений ещё нет в базе. Прогоните миграцию в консоли D1.</p>
          </Card>
        )}

        {recomputeResult && <p className="text-[13px] text-text-muted mb-4">{recomputeResult}</p>}

        {loaded && !error && achievements.length === 0 && (
          <Card className="p-8 text-center">
            <p className="font-semibold text-[15px]">Достижений ещё нет</p>
            <p className="text-[13px] text-text-muted mt-1.5">Добавьте первое — оно появится в ленте «Достижения» у соискателей.</p>
          </Card>
        )}

        {loading && !loaded && <p className="text-[14px] text-text-muted">Загружаем…</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          {achievements.map((a) => (
            <AchievementRow
              key={a.id}
              achievement={a}
              canManage={canManage}
              onEdit={() => setEditing(a)}
              onToggle={() => setStatus(a.id, a.status === 'active' ? 'paused' : 'active')}
              onDelete={() => remove(a.id)}
            />
          ))}
        </div>
      </div>

      <AchievementModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={(input) => create(input)} />
      <AchievementModal
        key={editing?.id ?? 'none'}
        open={!!editing}
        achievement={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={async (input) => {
          if (!editing) return;
          await update(editing.id, input);
        }}
      />
    </div>
  );
}

function AchievementRow({
  achievement,
  canManage,
  onEdit,
  onToggle,
  onDelete,
}: {
  achievement: Achievement;
  canManage: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const Icon = ACHIEVEMENT_ICONS[achievement.icon] ?? Award;

  return (
    <Card className="p-5">
      <div className="flex gap-4">
        <div
          className={cn(
            'h-12 w-12 rounded-xl flex items-center justify-center shrink-0',
            achievement.status === 'active' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-faint',
          )}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-[15px] truncate">{achievement.title}</p>
            <Badge tone={achievement.status === 'active' ? 'accent' : 'neutral'}>
              {achievement.status === 'active' ? 'Активно' : 'На паузе'}
            </Badge>
            <Badge tone="neutral">{achievement.kind === 'manual' ? 'Вручную' : 'Авто'}</Badge>
          </div>
          <p className="text-[13px] text-text-muted mt-0.5 line-clamp-2">{achievement.description}</p>
          {achievement.conditionType && (
            <p className="text-[12px] text-text-faint mt-2">
              {CONDITION_LABELS[achievement.conditionType]}
              {achievement.threshold != null && ` · порог ${achievement.threshold}`}
              {achievement.threshold2 != null && ` / ${achievement.threshold2}`}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border-soft">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-faint font-semibold">Получили</p>
          <p className="text-[17px] font-bold mt-0.5">{achievement.earnedCount}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <Button variant={achievement.status === 'active' ? 'outline' : 'primary'} disabled={!canManage} onClick={onToggle}>
          {achievement.status === 'active' ? (
            <>
              <Pause size={15} /> Приостановить
            </>
          ) : (
            <>
              <Play size={15} /> Включить
            </>
          )}
        </Button>
        <Button variant="outline" disabled={!canManage} onClick={onEdit}>
          <Pencil size={15} /> Изменить
        </Button>
        <span className="flex-1" />
        <Button variant="outline" disabled={!canManage} onClick={() => setConfirmDelete(true)} aria-label="Удалить">
          <Trash2 size={15} className="text-danger" />
        </Button>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удалить достижение?"
        description="У всех, кому оно уже выдано, бейдж тоже исчезнет. Если оно может понадобиться снова — лучше приостановить."
      >
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>
            Отмена
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              setConfirmDelete(false);
              onDelete();
            }}
          >
            Удалить
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function toInput(a: Achievement): AchievementInput {
  return {
    title: a.title,
    description: a.description,
    icon: a.icon,
    kind: a.kind,
    conditionType: a.conditionType,
    threshold: a.threshold,
    threshold2: a.threshold2,
    sortOrder: a.sortOrder,
  };
}

function AchievementModal({
  open,
  achievement,
  onClose,
  onSubmit,
}: {
  open: boolean;
  achievement?: Achievement;
  onClose: () => void;
  onSubmit: (input: AchievementInput) => Promise<void>;
}) {
  const editing = !!achievement;
  const [form, setForm] = useState<AchievementInput>(achievement ? toInput(achievement) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AchievementInput>(key: K, value: AchievementInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (saving) return;
    if (!form.title.trim()) return setError('Нужен заголовок.');
    if (form.kind === 'auto' && !form.conditionType) return setError('Выберите условие.');

    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
      if (!editing) setForm(EMPTY);
      onClose();
    } catch {
      setError('Не получилось сохранить — попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Изменить достижение' : 'Новое достижение'} width={520}>
      <div className="space-y-3">
        <div>
          <Label>Заголовок</Label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="30 смен" />
        </div>

        <div>
          <Label>Описание</Label>
          <Textarea rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Закрыл(а) 30 смен." />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Иконка</Label>
            <Select value={form.icon} onChange={(e) => set('icon', e.target.value)}>
              {Object.keys(ACHIEVEMENT_ICONS).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Тип</Label>
            <Select value={form.kind} onChange={(e) => set('kind', e.target.value as 'auto' | 'manual')}>
              <option value="auto">Авто — по условию</option>
              <option value="manual">Вручную — кнопкой у стаффа</option>
            </Select>
          </div>
        </div>

        {form.kind === 'auto' && (
          <>
            <div>
              <Label>Условие</Label>
              <Select value={form.conditionType ?? ''} onChange={(e) => set('conditionType', e.target.value as AchievementConditionType)}>
                {Object.entries(CONDITION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Порог</Label>
                <Input
                  type="number"
                  value={form.threshold ?? ''}
                  onChange={(e) => set('threshold', e.target.value === '' ? null : Number(e.target.value))}
                />
              </div>
              {form.conditionType && NEEDS_THRESHOLD2.includes(form.conditionType) && (
                <div>
                  <Label>Порог 2 (мин. отзывов)</Label>
                  <Input
                    type="number"
                    value={form.threshold2 ?? ''}
                    onChange={(e) => set('threshold2', e.target.value === '' ? null : Number(e.target.value))}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {!editing && (
          <p className="text-[12px] text-text-faint">Создастся на паузе — проверьте описание и включите кнопкой в списке.</p>
        )}

        {error && <p className="text-danger text-[13px] leading-relaxed">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" className="flex-1" disabled={saving} onClick={submit}>
            {saving ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
