import { useEffect, useRef, useState } from 'react';
import { Briefcase, Image as ImageIcon, Pencil, Plus, Trash2, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Avatar } from '@/components/ui/Avatar';
import { useProxyEmployersStore } from '@/store/useProxyEmployersStore';
import { useCan } from '@/store/useSessionStore';
import { formatMoney, timeRange } from '@/lib/format';
import type { ProxyEmployer, ProxyEmployerInput, ProxyVacancy, ProxyVacancyInput } from '@/types';

/** Тот же список, что в src/data/positions.ts мини-аппа — не импортируется
 *  напрямую (админка и мини-апп — разные пакеты без общего рантайма), но
 *  slug'и должны совпадать буквально: по ним ищутся подходящие соискатели
 *  (worker_positions.position) и работает уведомление о новой смене. */
const POSITIONS: { id: string; label: string }[] = [
  { id: 'barista', label: 'Бариста' },
  { id: 'waiter', label: 'Официант' },
  { id: 'cook', label: 'Повар' },
  { id: 'bartender', label: 'Бармен' },
  { id: 'host', label: 'Хостес' },
  { id: 'runner', label: 'Раннер' },
  { id: 'cashier', label: 'Кассир' },
  { id: 'dishwasher', label: 'Посудомойщик' },
  { id: 'cleaner', label: 'Клинер' },
  { id: 'promoter', label: 'Промоутер' },
  { id: 'courier', label: 'Курьер' },
  { id: 'loader', label: 'Грузчик' },
  { id: 'security', label: 'Охранник' },
  { id: 'sommelier', label: 'Сомелье' },
  { id: 'confectioner', label: 'Кондитер' },
  { id: 'admin', label: 'Администратор' },
];

const EMPTY_EMPLOYER: ProxyEmployerInput = { name: '', city: 'Москва', address: '', description: '', foundedYear: null, telegramUsername: '' };

export function ProxyEmployers() {
  const { employers, loading, loaded, error, load, create, update, setAvatar, addPhoto, removePhoto, remove } = useProxyEmployersStore();
  const canManage = useCan('manageData');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProxyEmployer | null>(null);
  const [vacanciesFor, setVacanciesFor] = useState<ProxyEmployer | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pb-10">
      <PageHeader
        title="Прокси-работодатели"
        subtitle="Вакансии от лица площадки — пока реальный бизнес не завёл свой аккаунт"
        right={
          <Button variant="primary" disabled={!canManage} onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Добавить
          </Button>
        }
      />

      <div className="px-4 sm:px-8">
        <Card className="p-5 mb-4 bg-surface-2 border-none">
          <p className="text-[13px] text-text-muted leading-relaxed">
            Вакансия от такого работодателя выглядит для соискателя как обычная. При отклике вместо чата в приложении
            открывается личка с реальным контактом в Telegram и готовым текстом. Когда бизнес зарегистрируется сам —
            удалите здесь свою карточку.
          </p>
        </Card>

        {error === 'migration_required' && (
          <Card className="p-5 mb-4 border-warning">
            <p className="font-semibold text-[14px]">Не применена миграция 0047_proxy_employers</p>
            <p className="text-[13px] text-text-muted mt-1">
              Столбца companies.is_proxy ещё нет в базе. Прогоните миграцию в консоли D1 — SQL есть в разделе «Настройки»
              → «Состояние базы данных».
            </p>
          </Card>
        )}

        {loaded && !error && employers.length === 0 && (
          <Card className="p-8 text-center">
            <p className="font-semibold text-[15px]">Пока ни одного</p>
            <p className="text-[13px] text-text-muted mt-1.5 max-w-[420px] mx-auto leading-relaxed">
              Добавьте карточку заведения и опубликуйте от её имени вакансию — она появится в ленте соискателя.
            </p>
          </Card>
        )}

        {loading && !loaded && <p className="text-[14px] text-text-muted">Загружаем…</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          {employers.map((employer) => (
            <EmployerRow
              key={employer.id}
              employer={employer}
              canManage={canManage}
              onEdit={() => setEditing(employer)}
              onAvatar={(file) => setAvatar(employer.id, file)}
              onDelete={() => remove(employer.id)}
              onVacancies={() => setVacanciesFor(employer)}
            />
          ))}
        </div>
      </div>

      <EmployerModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={(input) => create(input)} />

      <EmployerModal
        key={editing?.id ?? 'none'}
        open={!!editing}
        employer={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={async (input) => {
          if (!editing) return;
          await update(editing.id, input);
        }}
      />

      {editing && (
        <PhotosCard employer={editing} onAdd={(file) => addPhoto(editing.id, file)} onRemove={(photoId) => removePhoto(editing.id, photoId)} />
      )}

      {vacanciesFor && <VacanciesModal employer={vacanciesFor} canManage={canManage} onClose={() => setVacanciesFor(null)} />}
    </div>
  );
}

function EmployerRow({
  employer,
  canManage,
  onEdit,
  onAvatar,
  onDelete,
  onVacancies,
}: {
  employer: ProxyEmployer;
  canManage: boolean;
  onEdit: () => void;
  onAvatar: (file: File) => void;
  onDelete: () => void;
  onVacancies: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Card className="p-5">
      <div className="flex gap-4">
        <Avatar src={employer.avatarUrl} name={employer.name} size={56} className="shrink-0" square />

        <div className="min-w-0 flex-1">
          <p className="font-bold text-[15px] truncate">{employer.name}</p>
          <p className="text-[13px] text-text-muted truncate mt-0.5">{employer.city}{employer.address ? ` · ${employer.address}` : ''}</p>
          <p className="text-[12px] text-text-faint mt-1">
            {employer.telegramUsername ? `@${employer.telegramUsername}` : 'Telegram не указан'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border-soft">
        <Badge tone={employer.activeVacancies > 0 ? 'accent' : 'neutral'}>{employer.activeVacancies} активных вакансий</Badge>
      </div>

      <div className="flex items-center gap-2 mt-4">
        <Button variant="outline" disabled={!canManage} onClick={onVacancies}>
          <Briefcase size={15} /> Вакансии
        </Button>
        <Button variant="outline" disabled={!canManage} onClick={onEdit}>
          <Pencil size={15} /> Изменить
        </Button>
        <Button variant="outline" disabled={!canManage} onClick={() => fileRef.current?.click()} aria-label="Фото профиля">
          <ImageIcon size={15} />
        </Button>
        <span className="flex-1" />
        <Button variant="outline" disabled={!canManage} onClick={() => setConfirmDelete(true)} aria-label="Удалить">
          <Trash2 size={15} className="text-danger" />
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAvatar(file);
          e.target.value = '';
        }}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Удалить «${employer.name}»?`}
        description="Все её вакансии, отклики и переписка по ним удалятся вместе с ней. Если работодатель зарегистрировался сам — эта карточка больше не нужна, можно удалять."
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

function EmployerModal({
  open,
  employer,
  onClose,
  onSubmit,
}: {
  open: boolean;
  employer?: ProxyEmployer;
  onClose: () => void;
  onSubmit: (input: ProxyEmployerInput) => Promise<void>;
}) {
  const editing = !!employer;
  const [form, setForm] = useState<ProxyEmployerInput>(
    employer
      ? {
          name: employer.name,
          city: employer.city,
          address: employer.address ?? '',
          description: employer.description,
          foundedYear: employer.foundedYear,
          telegramUsername: employer.telegramUsername ?? '',
        }
      : EMPTY_EMPLOYER,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProxyEmployerInput>(key: K, value: ProxyEmployerInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (saving) return;
    if (!form.name.trim()) return setError('Нужно название заведения.');
    if (!form.telegramUsername.trim()) return setError('Нужен юзернейм в Telegram — без него отклику некуда вести.');

    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
      if (!editing) setForm(EMPTY_EMPLOYER);
      onClose();
    } catch {
      setError('Не получилось сохранить — попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Изменить заведение' : 'Новый прокси-работодатель'} width={480}>
      <div className="space-y-3">
        <div>
          <Label>Название</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Кофейня «Атмосфера»" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Город</Label>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Москва" />
          </div>
          <div>
            <Label>Адрес</Label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Покровка 5" />
          </div>
        </div>

        <div>
          <Label>Юзернейм в Telegram (реальный контакт)</Label>
          <Input
            value={form.telegramUsername}
            onChange={(e) => set('telegramUsername', e.target.value.replace(/^@/, ''))}
            placeholder="ivanov_coffee"
          />
          <p className="text-[12px] text-text-faint mt-1">
            Отклик соискателя откроет личку с этим контактом и готовым текстом — реальный владелец бизнеса.
          </p>
        </div>

        <div>
          <Label>Описание</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <div>
          <Label>Год основания</Label>
          <Input
            type="number"
            value={form.foundedYear ?? ''}
            onChange={(e) => set('foundedYear', e.target.value ? Number(e.target.value) : null)}
          />
        </div>

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

/** Отдельная карточка фото-галереи под окном редактирования — открывается
 *  вместе с ним, а не внутри Modal, чтобы не тащить загрузку файлов и её
 *  собственное состояние в ту же форму. */
function PhotosCard({ employer, onAdd, onRemove }: { employer: ProxyEmployer; onAdd: (file: File) => void; onRemove: (photoId: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Modal open onClose={() => {}} title={`Фото «${employer.name}»`} width={420}>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {employer.photos.map((p) => (
          <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-surface-2 group">
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            <button
              onClick={() => onRemove(p.id)}
              className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
              aria-label="Удалить фото"
            >
              <X size={13} />
            </button>
          </div>
        ))}
        {employer.photos.length < 6 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-xl border border-dashed border-border flex items-center justify-center text-text-faint"
          >
            <Plus size={18} />
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAdd(file);
          e.target.value = '';
        }}
      />
      <p className="text-[12px] text-text-faint">До 6 фото — те же, что видит соискатель на карточке заведения.</p>
    </Modal>
  );
}

const EMPTY_VACANCY: ProxyVacancyInput = {
  position: 'waiter',
  positionLabel: 'Официант',
  date: new Date().toISOString().slice(0, 10),
  startHour: 10,
  startMin: 0,
  endHour: 22,
  endMin: 0,
  hourlyRate: 300,
  payMode: 'hourly',
  description: '',
  meal: false,
  urgency: 'normal',
  employmentType: 'shift',
  timeOfDay: 'day',
  requirements: [],
};

function VacanciesModal({ employer, canManage, onClose }: { employer: ProxyEmployer; canManage: boolean; onClose: () => void }) {
  const { vacancies, vacanciesLoading, loadVacancies, createVacancy, updateVacancy, removeVacancy } = useProxyEmployersStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProxyVacancy | null>(null);

  useEffect(() => {
    loadVacancies(employer.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employer.id]);

  const active = vacancies.filter((v) => v.status === 'active');

  return (
    <Modal open onClose={onClose} title={`Вакансии «${employer.name}»`} width={560}>
      <div className="flex justify-end mb-3">
        <Button variant="primary" disabled={!canManage} onClick={() => setFormOpen(true)}>
          <Plus size={15} /> Новая вакансия
        </Button>
      </div>

      {vacanciesLoading && <p className="text-[13px] text-text-muted">Загружаем…</p>}
      {!vacanciesLoading && active.length === 0 && <p className="text-[13px] text-text-muted">Пока ни одной активной вакансии.</p>}

      <div className="space-y-2">
        {active.map((v) => (
          <div key={v.id} className="rounded-xl border border-border-soft p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-[14px]">{v.positionLabel}</p>
                <p className="text-[12px] text-text-muted mt-0.5">
                  {v.date}{v.endDate ? `–${v.endDate}` : ''} · {timeRange(v.startHour, v.startMin, v.endHour, v.endMin)} ·{' '}
                  {formatMoney(v.totalPay)}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button variant="outline" size="sm" disabled={!canManage} onClick={() => setEditing(v)} aria-label="Изменить">
                  <Pencil size={13} />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canManage}
                  onClick={() => removeVacancy(employer.id, v.id)}
                  aria-label="Удалить"
                >
                  <Trash2 size={13} className="text-danger" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <VacancyFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => createVacancy(employer.id, input)}
      />
      <VacancyFormModal
        key={editing?.id ?? 'none'}
        open={!!editing}
        vacancy={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={async (input) => {
          if (!editing) return;
          await updateVacancy(employer.id, editing.id, input);
        }}
      />
    </Modal>
  );
}

function VacancyFormModal({
  open,
  vacancy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  vacancy?: ProxyVacancy;
  onClose: () => void;
  onSubmit: (input: ProxyVacancyInput) => Promise<void>;
}) {
  const editing = !!vacancy;
  const [form, setForm] = useState<ProxyVacancyInput>(
    vacancy
      ? {
          position: vacancy.position,
          positionLabel: vacancy.positionLabel,
          date: vacancy.date,
          endDate: vacancy.endDate,
          startHour: vacancy.startHour,
          startMin: vacancy.startMin,
          endHour: vacancy.endHour,
          endMin: vacancy.endMin,
          hourlyRate: vacancy.hourlyRate,
          payMode: vacancy.payMode,
          totalPay: vacancy.totalPay,
          description: vacancy.description,
          meal: vacancy.meal,
          urgency: vacancy.urgency,
          employmentType: vacancy.employmentType,
          timeOfDay: vacancy.timeOfDay,
          requirements: vacancy.requirements,
        }
      : EMPTY_VACANCY,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProxyVacancyInput>(key: K, value: ProxyVacancyInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (saving) return;
    if (!form.date) return setError('Укажите дату.');
    if (form.endHour <= form.startHour) return setError('Время окончания должно быть позже начала.');

    setError(null);
    setSaving(true);
    try {
      await onSubmit(form);
      if (!editing) setForm(EMPTY_VACANCY);
      onClose();
    } catch {
      setError('Не получилось сохранить — попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Изменить вакансию' : 'Новая вакансия'} width={480}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Должность</Label>
            <Select
              value={form.position}
              onChange={(e) => {
                const label = POSITIONS.find((p) => p.id === e.target.value)?.label ?? e.target.value;
                setForm((f) => ({ ...f, position: e.target.value, positionLabel: label }));
              }}
            >
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Тип занятости</Label>
            <Select value={form.employmentType} onChange={(e) => set('employmentType', e.target.value as 'shift' | 'permanent')}>
              <option value="shift">Смена</option>
              <option value="permanent">Постоянная работа</option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Дата</Label>
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          {form.employmentType === 'shift' && (
            <div>
              <Label>Дата окончания (если несколько дней подряд)</Label>
              <Input type="date" value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || undefined)} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Начало</Label>
            <Input
              type="time"
              value={`${String(form.startHour).padStart(2, '0')}:${String(form.startMin).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                setForm((f) => ({ ...f, startHour: h ?? 0, startMin: m ?? 0 }));
              }}
            />
          </div>
          <div>
            <Label>Конец</Label>
            <Input
              type="time"
              value={`${String(form.endHour).padStart(2, '0')}:${String(form.endMin).padStart(2, '0')}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(':').map(Number);
                setForm((f) => ({ ...f, endHour: h ?? 0, endMin: m ?? 0 }));
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Оплата</Label>
            <Select value={form.payMode} onChange={(e) => set('payMode', e.target.value as 'hourly' | 'fixed')}>
              <option value="hourly">За час</option>
              <option value="fixed">За смену целиком</option>
            </Select>
          </div>
          <div>
            <Label>{form.payMode === 'fixed' ? 'Сумма за смену, ₽' : 'Ставка, ₽/ч'}</Label>
            <Input
              type="number"
              value={form.payMode === 'fixed' ? (form.totalPay ?? 0) : form.hourlyRate}
              onChange={(e) =>
                form.payMode === 'fixed' ? set('totalPay', Number(e.target.value)) : set('hourlyRate', Number(e.target.value))
              }
            />
          </div>
        </div>

        <div>
          <Label>Время суток</Label>
          <Select value={form.timeOfDay} onChange={(e) => set('timeOfDay', e.target.value)}>
            <option value="morning">Утро</option>
            <option value="day">День</option>
            <option value="evening">Вечер</option>
            <option value="night">Ночь</option>
          </Select>
        </div>

        <div>
          <Label>Описание</Label>
          <Textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>

        <label className="flex items-center gap-2 text-[13px] text-text-muted">
          <input type="checkbox" checked={form.meal} onChange={(e) => set('meal', e.target.checked)} />
          Питание включено
        </label>
        <label className="flex items-center gap-2 text-[13px] text-text-muted">
          <input type="checkbox" checked={form.urgency === 'urgent'} onChange={(e) => set('urgency', e.target.checked ? 'urgent' : 'normal')} />
          Срочно
        </label>

        {error && <p className="text-danger text-[13px] leading-relaxed">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" className="flex-1" disabled={saving} onClick={submit}>
            {saving ? 'Сохраняем…' : editing ? 'Сохранить' : 'Опубликовать'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
