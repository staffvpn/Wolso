import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { usePromosStore } from '@/store/usePromosStore';
import { useCan } from '@/store/useSessionStore';
import type { Promo, PromoInput } from '@/types';

const EMPTY: PromoInput = {
  title: '',
  text: '',
  ctaLabel: 'Открыть канал',
  url: '',
  advertiser: '',
  erid: '',
  everyN: 7,
  dailyCap: 3,
  weight: 1,
};

export function Promos() {
  const { promos, loading, loaded, error, load, create, update, setStatus, setImage, remove } = usePromosStore();
  const canManage = useCan('managePromos');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="pb-10">
      <PageHeader
        title="Реклама"
        subtitle="Карточки между сменами в ленте соискателя"
        right={
          <Button variant="primary" disabled={!canManage} onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Добавить
          </Button>
        }
      />

      <div className="px-4 sm:px-8">
        {/* Миграции здесь применяются руками, поэтому недостающую называем
            словами — иначе раздел выглядит просто сломанным. */}
        {error === 'migration_required' && (
          <Card className="p-5 mb-4 border-warning">
            <p className="font-semibold text-[14px]">Не применена миграция 0039_promos</p>
            <p className="text-[13px] text-text-muted mt-1">
              Таблицы для рекламы ещё нет в базе. Прогоните миграцию в консоли D1 — SQL есть в техническом разделе.
            </p>
          </Card>
        )}

        {loaded && !error && promos.length === 0 && (
          <Card className="p-8 text-center">
            <p className="font-semibold text-[15px]">Реклама не настроена</p>
            <p className="text-[13px] text-text-muted mt-1.5 max-w-[420px] mx-auto leading-relaxed">
              Добавьте карточку — она появится в ленте между сменами. Пока ни одна не включена, лента показывает только
              смены.
            </p>
          </Card>
        )}

        {loading && !loaded && <p className="text-[14px] text-text-muted">Загружаем…</p>}

        <div className="grid gap-4 lg:grid-cols-2">
          {promos.map((promo) => (
            <PromoRow
              key={promo.id}
              promo={promo}
              canManage={canManage}
              onEdit={() => setEditing(promo)}
              onToggle={() => setStatus(promo.id, promo.status === 'active' ? 'paused' : 'active')}
              onImage={(file) => setImage(promo.id, file)}
              onDelete={() => remove(promo.id)}
            />
          ))}
        </div>
      </div>

      <PromoModal open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={(input, image) => create(input, image)} />

      {/* key сбрасывает форму при смене карточки: без него в окне
          оставались бы поля предыдущей. */}
      <PromoModal
        key={editing?.id ?? 'none'}
        open={!!editing}
        promo={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={async (input, image) => {
          if (!editing) return;
          await update(editing.id, input);
          if (image) await setImage(editing.id, image);
        }}
      />
    </div>
  );
}

function PromoRow({
  promo,
  canManage,
  onEdit,
  onToggle,
  onImage,
  onDelete,
}: {
  promo: Promo;
  canManage: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onImage: (file: File) => void;
  onDelete: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Отношение переходов к показам — то, что спросит партнёр. Считаем
  // здесь, а не на сервере: цифра производная, хранить её незачем.
  const ctr = promo.impressions > 0 ? ((promo.clicks / promo.impressions) * 100).toFixed(1) : '—';

  return (
    <Card className="p-5">
      <div className="flex gap-4">
        <div className="h-20 w-20 rounded-xl bg-surface-2 overflow-hidden shrink-0 flex items-center justify-center">
          {promo.imageUrl ? (
            <img src={promo.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-text-faint" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-bold text-[15px] truncate">{promo.title}</p>
            <Badge tone={promo.status === 'active' ? 'accent' : 'neutral'}>
              {promo.status === 'active' ? 'Показывается' : 'На паузе'}
            </Badge>
          </div>
          <p className="text-[13px] text-text-muted truncate mt-0.5">{promo.url}</p>
          <p className="text-[12px] text-text-faint mt-2">
            Каждые {promo.everyN} смен · не чаще {promo.dailyCap} раз в день · вес {promo.weight}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5 mt-4 pt-4 border-t border-border-soft">
        <Stat label="Показы" value={String(promo.impressions)} />
        <Stat label="Переходы" value={String(promo.clicks)} />
        <Stat label="CTR" value={ctr === '—' ? '—' : `${ctr}%`} />
      </div>

      <div className="flex items-center gap-2 mt-4">
        <Button variant={promo.status === 'active' ? 'outline' : 'primary'} disabled={!canManage} onClick={onToggle}>
          {promo.status === 'active' ? (
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
        <Button variant="outline" disabled={!canManage} onClick={() => fileRef.current?.click()} aria-label="Картинка">
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
          if (file) onImage(file);
          e.target.value = '';
        }}
      />

      {/* Удаление стирает и накопленную статистику, поэтому спрашиваем.
          Если партнёр может вернуться — правильный ответ пауза. */}
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удалить рекламу?"
        description="Показы и переходы удалятся вместе с ней. Если размещение может вернуться — лучше приостановить."
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-text-faint font-semibold">{label}</p>
      <p className="text-[17px] font-bold mt-0.5">{value}</p>
    </div>
  );
}

/** Одна форма на создание и на правку.
 *
 *  Разводить два почти одинаковых окна не за чем: поля те же, проверки те
 *  же, и разойтись они успели бы к первому же новому полю. Отличий ровно
 *  три — заголовок, надпись на кнопке и то, что при правке картинка
 *  необязательна. */
function PromoModal({
  open,
  promo,
  onClose,
  onSubmit,
}: {
  open: boolean;
  promo?: Promo;
  onClose: () => void;
  onSubmit: (input: PromoInput, image: File | null) => Promise<void>;
}) {
  const editing = !!promo;
  const [form, setForm] = useState<PromoInput>(promo ? toInput(promo) : EMPTY);
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof PromoInput>(key: K, value: PromoInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    if (saving) return;
    if (!form.title.trim()) return setError('Нужен заголовок.');
    if (!/^https:\/\//i.test(form.url.trim())) return setError('Ссылка должна начинаться с https://');

    setError(null);
    setSaving(true);
    try {
      await onSubmit(form, image);
      if (!editing) {
        setForm(EMPTY);
        setImage(null);
      }
      onClose();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setError(code === 'bad_url' ? 'Ссылка должна начинаться с https://' : 'Не получилось сохранить — попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Изменить рекламу' : 'Новая реклама'} width={520}>
      <div className="space-y-3">
        <div>
          <Label>Заголовок</Label>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Канал Wolso" />
        </div>

        <div>
          <Label>Текст</Label>
          <Textarea
            rows={3}
            value={form.text}
            onChange={(e) => set('text', e.target.value)}
            placeholder="Смены, которых нет в ленте, и новости сервиса"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Ссылка</Label>
            <Input value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://t.me/wolsoapp" />
          </div>
          <div>
            <Label>Надпись на кнопке</Label>
            <Input value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} />
          </div>
        </div>
        {/* Тип ссылки не спрашиваем: он выводится из неё самой. t.me
            откроется внутри Telegram, остальное — во встроенном браузере. */}
        <p className="text-[12px] text-text-faint -mt-1">
          Ссылки t.me открываются прямо в Telegram, остальные — во встроенном браузере.
        </p>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Каждые N смен</Label>
            <Input type="number" min={1} value={form.everyN} onChange={(e) => set('everyN', Number(e.target.value))} />
          </div>
          <div>
            <Label>Раз в день, максимум</Label>
            <Input type="number" min={1} value={form.dailyCap} onChange={(e) => set('dailyCap', Number(e.target.value))} />
          </div>
          <div>
            <Label>Вес</Label>
            <Input type="number" min={1} value={form.weight} onChange={(e) => set('weight', Number(e.target.value))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Рекламодатель</Label>
            <Input value={form.advertiser} onChange={(e) => set('advertiser', e.target.value)} placeholder="Не нужен для своего канала" />
          </div>
          <div>
            <Label>Токен erid</Label>
            <Input value={form.erid} onChange={(e) => set('erid', e.target.value)} placeholder="Только для платных" />
          </div>
        </div>
        <p className="text-[12px] text-text-faint -mt-1">
          Свой канал внутри своего приложения — самореклама, эти два поля не нужны. Для платного размещения они печатаются
          на карточке.
        </p>

        <div>
          <Label>Картинка</Label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            className="text-[13px] text-text-muted"
          />
          {editing && <p className="text-[12px] text-text-faint mt-1">Оставьте пустым, чтобы не менять текущую.</p>}
        </div>

        {error && <p className="text-danger text-[13px] leading-relaxed">{error}</p>}

        {/* Создаём всегда на паузе: карточка без картинки и с непроверенной
            ссылкой не должна уехать в ленту по нажатию «Сохранить». Правка
            статус не трогает — включённая реклама остаётся включённой. */}
        {!editing && (
          <p className="text-[12px] text-text-faint">
            Карточка создастся на паузе — проверьте, как она выглядит, и включите её кнопкой в списке.
          </p>
        )}

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

function toInput(promo: Promo): PromoInput {
  return {
    title: promo.title,
    text: promo.text,
    ctaLabel: promo.ctaLabel,
    url: promo.url,
    advertiser: promo.advertiser,
    erid: promo.erid,
    everyN: promo.everyN,
    dailyCap: promo.dailyCap,
    weight: promo.weight,
    startsAt: promo.startsAt ?? null,
    endsAt: promo.endsAt ?? null,
  };
}
