import { useEffect, useState } from 'react';
import { Check, Clock, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { usePersonalShiftsStore } from '@/store/usePersonalShiftsStore';
import { POSITIONS } from '@/data/positions';
import { FOUND_VIA_OPTIONS } from '@/data/foundVia';
import { hapticNotify, hapticSelect } from '@/lib/telegram';
import { cn } from '@/lib/cn';
import type { PersonalShift, PersonalShiftStatus } from '@/types';

const FIELD =
  'w-full rounded-2xl bg-surface border border-border p-3.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent';

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Редактируем существующую — иначе создаём новую. */
  editing?: PersonalShift | null;
  /** День, на который человек нажал в календаре: подставляем его сразу,
   *  чтобы не заставлять выбирать дату, которую он уже выбрал. */
  defaultDate?: string;
}

/** Своя смена — не отклик, не вакансия и не запись внутри Wolso. Форма
 *  ровно про учёт: где, когда, кем, сколько заплатили и где нашли. Никаких
 *  подтверждений, приглашений и второй стороны здесь нет и быть не может. */
export function PersonalShiftSheet({ open, onClose, editing, defaultDate }: Props) {
  const add = usePersonalShiftsStore((s) => s.add);
  const update = usePersonalShiftsStore((s) => s.update);
  const remove = usePersonalShiftsStore((s) => s.remove);

  const [status, setStatus] = useState<PersonalShiftStatus>('planned');
  const [placeName, setPlaceName] = useState('');
  const [address, setAddress] = useState('');
  const [positionLabel, setPositionLabel] = useState('');
  const [date, setDate] = useState('');
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(18);
  const [pay, setPay] = useState('');
  const [foundVia, setFoundVia] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Заполняем при каждом открытии, а не один раз: тот же лист используется
  // и для создания, и для правки, и подставленная дата меняется от дня к дню.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setConfirmDelete(false);
    if (editing) {
      setStatus(editing.status);
      setPlaceName(editing.placeName);
      setAddress(editing.address);
      setPositionLabel(editing.positionLabel);
      setDate(editing.date);
      setStartHour(editing.startHour);
      setEndHour(editing.endHour);
      setPay(editing.pay ? String(editing.pay) : '');
      setFoundVia(editing.foundVia);
      setNotes(editing.notes);
    } else {
      const day = defaultDate ?? localDate(new Date());
      // Смену на прошедший день заносят, чтобы записать уже отработанное, —
      // подставляем это, а не заставляем переключать вручную.
      setStatus(day < localDate(new Date()) ? 'worked' : 'planned');
      setPlaceName('');
      setAddress('');
      setPositionLabel('');
      setDate(day);
      setStartHour(9);
      setEndHour(18);
      setPay('');
      setFoundVia('');
      setNotes('');
    }
  }, [open, editing, defaultDate]);

  const missing: string[] = [];
  if (!placeName.trim()) missing.push('название');
  if (!positionLabel.trim()) missing.push('должность');
  if (!date) missing.push('дата');

  async function save() {
    if (missing.length > 0) {
      setError(`Заполните: ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    setError(null);
    const input = {
      placeName: placeName.trim(),
      address: address.trim(),
      positionLabel: positionLabel.trim(),
      date,
      startHour,
      startMin: 0,
      endHour,
      endMin: 0,
      pay: Number(pay) || 0,
      notes: notes.trim(),
      status,
      foundVia,
    };
    try {
      if (editing) await update(editing.id, input);
      else await add(input);
      hapticNotify('success');
      onClose();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setError(
        code === 'migration_required'
          ? 'Личные смены ещё не включены на сервере. Напишите в поддержку.'
          : 'Не получилось сохранить — проверьте связь и попробуйте ещё раз.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function drop() {
    if (!editing) return;
    setSaving(true);
    try {
      await remove(editing.id);
      onClose();
    } catch {
      setError('Не получилось удалить — попробуйте ещё раз.');
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      {/* Удаление — сразу в шапке, а не последней кнопкой под всей формой:
          до низа длинного листа ещё надо доскроллить, а рука до верха
          дотягивается всегда. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[18px] font-extrabold leading-tight">
            {editing ? 'Личная смена' : 'Своя смена'}
          </h2>
          <p className="text-[13px] text-text-muted mt-1 leading-relaxed">
            Работа, которую вы нашли сами. Она видна только вам — в поиск не попадает и работодателям не показывается.
          </p>
        </div>
        {editing && (
          <button
            onClick={() => {
              hapticNotify('warning');
              setConfirmDelete(true);
            }}
            disabled={saving}
            aria-label="Удалить смену"
            className="h-10 w-10 shrink-0 rounded-full bg-danger-soft text-danger flex items-center justify-center"
          >
            <Trash2 size={17} />
          </button>
        )}
      </div>

      {confirmDelete && (
        <div className="mt-3 rounded-2xl bg-surface border border-border p-3.5">
          <p className="text-[13px] text-text-muted leading-relaxed">Удалить эту смену из календаря? Отменить не получится.</p>
          <div className="flex gap-2 mt-3">
            <Button variant="outline" size="md" className="flex-1" onClick={() => setConfirmDelete(false)}>
              Оставить
            </Button>
            <Button variant="danger" size="md" className="flex-1" disabled={saving} onClick={drop}>
              Удалить
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3 mt-4">
        {/* Статус ставит сам человек. Дата его не решает: смену переносят,
            срывают и просто не выходят — календарь не должен записывать
            это в отработанное и в заработок за месяц. */}
        <div>
          <span className="block text-[12px] text-text-muted mb-1.5">Статус смены</span>
          <div className="flex gap-2">
            <StatusButton
              active={status === 'planned'}
              icon={<Clock size={16} />}
              label="Запланировал"
              onClick={() => {
                hapticSelect();
                setStatus('planned');
              }}
            />
            <StatusButton
              active={status === 'worked'}
              icon={<Check size={16} />}
              label="Отработал"
              onClick={() => {
                hapticSelect();
                setStatus('worked');
              }}
            />
          </div>
        </div>

        <input value={placeName} onChange={(e) => setPlaceName(e.target.value)} placeholder="Название заведения" className={FIELD} />
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Адрес (необязательно)" className={FIELD} />

        <div>
          <input
            value={positionLabel}
            onChange={(e) => setPositionLabel(e.target.value)}
            placeholder="Должность"
            className={FIELD}
          />
          {/* Подсказки, а не жёсткий список: личная смена может быть любой
              работой, в том числе такой, которой нет в справочнике Wolso. */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {POSITIONS.slice(0, 6).map((p) => (
              <Chip
                key={p.id}
                selected={positionLabel === p.label}
                onClick={() => setPositionLabel(p.label)}
                className="h-8 px-3 text-[13px]"
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />

        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="block text-[12px] text-text-muted mb-1">Начало</span>
            <input
              type="number"
              min={0}
              max={23}
              value={startHour}
              onChange={(e) => setStartHour(Math.min(23, Math.max(0, Number(e.target.value))))}
              className={FIELD}
            />
          </label>
          <label className="flex-1">
            <span className="block text-[12px] text-text-muted mb-1">Конец</span>
            <input
              type="number"
              min={0}
              max={23}
              value={endHour}
              onChange={(e) => setEndHour(Math.min(23, Math.max(0, Number(e.target.value))))}
              className={FIELD}
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-[12px] text-text-muted mb-1">Оплата за смену, ₽</span>
          <input type="number" min={0} inputMode="numeric" value={pay} onChange={(e) => setPay(e.target.value)} placeholder="3000" className={FIELD} />
        </label>

        {/* Где нашли — для себя: через полгода видно, какая площадка
            реально приносит смены, а какая только отнимает время. Ни в
            какую статистику Wolso это не уходит. */}
        <div>
          <span className="block text-[12px] text-text-muted mb-1.5">Где нашли работу</span>
          <div className="flex flex-wrap gap-1.5">
            {FOUND_VIA_OPTIONS.map((o) => (
              <Chip
                key={o.id}
                selected={foundVia === o.id}
                onClick={() => {
                  hapticSelect();
                  // Повторное нажатие снимает выбор: поле необязательное.
                  setFoundVia((v) => (v === o.id ? '' : o.id));
                }}
                className="h-8 px-3 text-[13px]"
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Заметки — например, кого спросить на входе"
          className={`${FIELD} resize-none`}
        />
      </div>

      {error && <p className="text-[13px] text-danger mt-3 leading-relaxed">{error}</p>}

      {/* Кнопки одного размера и всегда на виду: лист длинный, и раньше до
          «Сохранить» приходилось доскроллить до самого низа. */}
      <div className="sticky bottom-0 -mx-5 mt-4 px-5 pt-3 pb-1 bg-bg-elevated border-t border-border-soft flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Отмена
        </Button>
        <Button className="flex-1" disabled={saving} onClick={save}>
          {saving ? 'Сохраняем…' : 'Сохранить'}
        </Button>
      </div>
    </BottomSheet>
  );
}

function StatusButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex-1 h-12 rounded-2xl border text-[14px] font-semibold flex items-center justify-center gap-1.5 transition-colors',
        active ? 'bg-info text-info-fg border-info' : 'bg-surface text-text-muted border-border',
      )}
    >
      {icon} {label}
    </button>
  );
}
