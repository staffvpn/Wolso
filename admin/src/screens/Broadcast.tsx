import { useEffect, useMemo, useState } from 'react';
import { Send, Users, Briefcase, Globe, AlertTriangle, Check, ListChecks } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Select } from '@/components/ui/Select';
import { Input, Label, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { EmptyPanel } from '@/components/EmptyPanel';
import { useCan } from '@/store/useSessionStore';
import {
  createBroadcast,
  fetchAudienceCount,
  fetchBroadcastCities,
  fetchBroadcastRecipients,
  fetchBroadcasts,
  sendBroadcastBatch,
} from '@/services/broadcastApi';
import { timeAgo, minutesSince } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { Broadcast, BroadcastAudience, BroadcastRecipient } from '@/types';

const AUDIENCES: { id: BroadcastAudience; label: string; icon: typeof Users }[] = [
  { id: 'all', label: 'Все', icon: Globe },
  { id: 'seekers', label: 'Соискатели', icon: Users },
  { id: 'employers', label: 'Работодатели', icon: Briefcase },
  { id: 'custom', label: 'Выбрать вручную', icon: ListChecks },
];

const AUDIENCE_LABEL: Record<BroadcastAudience, string> = {
  all: 'Все',
  seekers: 'Соискатели',
  employers: 'Работодатели',
  custom: 'Выбранные вручную',
};

export function BroadcastScreen() {
  const canSend = useCan('manageData');

  const [text, setText] = useState('');
  const [audience, setAudience] = useState<BroadcastAudience>('all');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState<{ city: string; n: number }[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [history, setHistory] = useState<Broadcast[]>([]);

  // Hand-picked recipients. Kept as telegram ids because that's what the
  // send actually addresses — a seeker and an employer can share a row id,
  // but never a telegram id.
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [pickQuery, setPickQuery] = useState('');

  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; processed: number; total: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBroadcastCities().then(setCities).catch(() => setCities([]));
    fetchBroadcasts().then(setHistory).catch(() => setHistory([]));
    fetchBroadcastRecipients().then(setRecipients).catch(() => setRecipients([]));
  }, []);

  // Recount whenever the audience changes, so the number next to "Отправить"
  // always matches what's actually selected. A hand-picked list is counted
  // from the checkboxes rather than asked of the server.
  useEffect(() => {
    if (audience === 'custom') return;
    let cancelled = false;
    setCount(null);
    fetchAudienceCount(audience, city || undefined)
      .then((n) => !cancelled && setCount(n))
      .catch(() => !cancelled && setCount(null));
    return () => {
      cancelled = true;
    };
  }, [audience, city]);

  async function send() {
    setConfirming(false);
    setSending(true);
    setError(null);
    setProgress({ sent: 0, failed: 0, processed: 0, total: effectiveCount });
    try {
      const { id, total } = await createBroadcast(
        text.trim(),
        audience,
        city || undefined,
        audience === 'custom' ? [...picked] : undefined,
      );
      setProgress({ sent: 0, failed: 0, processed: 0, total });

      // The server sends a batch per call and reports how far it got —
      // loop until it says done, so a few thousand recipients don't have to
      // fit inside one request.
      let done = false;
      while (!done) {
        const p = await sendBroadcastBatch(id);
        setProgress({ sent: p.sent, failed: p.failed, processed: p.processed, total: p.total });
        done = p.done;
      }

      setText('');
      fetchBroadcasts().then(setHistory).catch(() => {});
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setError(
        code === 'no_recipients'
          ? 'В выбранной аудитории никого нет — измените фильтр.'
          : 'Рассылка прервалась. Уже отправленные сообщения не дублируются — можно запустить ещё раз, она продолжит с места остановки.',
      );
    } finally {
      setSending(false);
    }
  }

  const effectiveCount = audience === 'custom' ? picked.size : count ?? 0;
  const canSubmit = canSend && text.trim().length > 0 && effectiveCount > 0 && !sending;

  const visibleRecipients = useMemo(() => {
    const q = pickQuery.trim().toLowerCase();
    if (!q) return recipients;
    return recipients.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.telegramUsername ?? '').toLowerCase().includes(q),
    );
  }, [recipients, pickQuery]);

  function togglePicked(telegramId: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(telegramId)) next.delete(telegramId);
      else next.add(telegramId);
      return next;
    });
  }

  /** Applies to what's currently filtered, not the whole base — otherwise
   *  searching for "бариста" and pressing "выбрать всех" would quietly
   *  select everybody. */
  function toggleAllVisible() {
    const ids = visibleRecipients.map((r) => r.telegramId);
    const allPicked = ids.length > 0 && ids.every((id) => picked.has(id));
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allPicked) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="pb-10">
      <PageHeader title="Рассылка" subtitle="Сообщение от лица бота — придёт в Telegram каждому получателю" />

      <div className="px-4 sm:px-8 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
        <Card className="p-6">
          {!canSend && (
            <p className="text-[13px] text-warning mb-4 leading-relaxed">
              Отправлять рассылки может только владелец — у вашей роли нет этого права.
            </p>
          )}

          <Label>Кому</Label>
          <div className="flex gap-2 mb-4 flex-wrap">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                onClick={() => setAudience(a.id)}
                disabled={sending}
                className={cn(
                  'flex items-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-xl border transition-colors disabled:opacity-50',
                  audience === a.id
                    ? 'bg-accent-soft text-accent border-accent/30'
                    : 'text-text-muted border-border hover:text-text',
                )}
              >
                <a.icon size={14} /> {a.label}
              </button>
            ))}
          </div>

          {audience === 'custom' ? (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <Label className="mb-0">Кому отправить · выбрано {picked.size}</Label>
                <button
                  onClick={toggleAllVisible}
                  disabled={sending || visibleRecipients.length === 0}
                  className="text-[12px] font-semibold text-accent hover:opacity-70 disabled:opacity-40"
                >
                  {visibleRecipients.length > 0 && visibleRecipients.every((r) => picked.has(r.telegramId))
                    ? 'Снять все'
                    : 'Выбрать все'}
                </button>
              </div>

              <Input
                placeholder="Поиск по имени или @username"
                value={pickQuery}
                disabled={sending}
                onChange={(e) => setPickQuery(e.target.value)}
                className="mb-2"
              />

              <div className="max-h-72 overflow-y-auto rounded-xl border border-border-soft divide-y divide-border-soft">
                {visibleRecipients.length === 0 && (
                  <p className="text-[13px] text-text-faint text-center py-6">Никого не нашли</p>
                )}
                {visibleRecipients.map((r) => (
                  <label
                    key={r.telegramId}
                    className="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer hover:bg-surface-2 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(r.telegramId)}
                      disabled={sending}
                      onChange={() => togglePicked(r.telegramId)}
                      className="h-4 w-4 accent-accent shrink-0"
                    />
                    <Avatar name={r.name} size={28} square={r.role === 'employer'} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-text truncate">{r.name}</span>
                      <span className="block text-[12px] text-text-faint truncate">
                        {r.telegramUsername ? `@${r.telegramUsername}` : `ID ${r.telegramId}`}
                        {r.city ? ` · ${r.city}` : ''}
                      </span>
                    </span>
                    <Badge tone="neutral">{r.role === 'employer' ? 'Работодатель' : 'Соискатель'}</Badge>
                  </label>
                ))}
              </div>
            </div>
          ) : (
            <>
              <Label>Город</Label>
              <Select value={city} disabled={sending} onChange={(e) => setCity(e.target.value)} className="mb-4">
                <option value="">Все города</option>
                {cities.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city} ({c.n})
                  </option>
                ))}
              </Select>
            </>
          )}

          <Label>Текст сообщения</Label>
          <Textarea
            rows={7}
            value={text}
            disabled={sending}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Например:\n\nДобавили фильтр по типу работы — теперь видно, где смена, а где постоянка.'}
          />
          <p className="text-[12px] text-text-faint mt-1.5">
            Переносы строк сохраняются. Внизу сообщения Telegram сам покажет кнопку «Открыть Wolso».
          </p>

          {progress && (
            <div className="mt-4 rounded-xl bg-surface-2 p-4">
              <div className="flex items-center justify-between text-[13px] mb-2">
                <span className="font-semibold text-text">
                  {progress.processed >= progress.total && !sending ? 'Готово' : 'Отправляем…'}
                </span>
                <span className="text-text-faint tabular-nums">
                  {progress.processed} из {progress.total}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.processed / progress.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center gap-3 mt-2.5 text-[12px]">
                <span className="flex items-center gap-1 text-accent">
                  <Check size={12} /> доставлено {progress.sent}
                </span>
                {progress.failed > 0 && (
                  <span className="flex items-center gap-1 text-text-faint">
                    <AlertTriangle size={12} /> не дошло {progress.failed}
                  </span>
                )}
              </div>
              {progress.failed > 0 && progress.processed >= progress.total && (
                <p className="text-[12px] text-text-faint mt-2 leading-relaxed">
                  Не дошло — значит, эти пользователи заблокировали бота или удалили аккаунт. Это нормально.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-[12px] text-danger mt-3 leading-relaxed">{error}</p>}

          <Button variant="primary" className="w-full mt-5" disabled={!canSubmit} onClick={() => setConfirming(true)}>
            <Send size={15} />
            {sending
              ? 'Отправляем…'
              : audience === 'custom'
                ? picked.size === 0
                  ? 'Отметьте получателей'
                  : `Отправить ${picked.size} получателям`
                : count === null
                  ? 'Считаем получателей…'
                  : `Отправить ${count} получателям`}
          </Button>
        </Card>

        <Card className="p-6 h-fit">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-3">История рассылок</p>
          {history.length === 0 && <EmptyPanel title="Пока ничего не отправляли" description="Здесь появятся прошлые рассылки и как они дошли." />}
          <div className="flex flex-col gap-2.5">
            {history.map((b) => (
              <div key={b.id} className="rounded-lg bg-surface-2 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge tone="neutral">
                    {AUDIENCE_LABEL[b.audience]}
                    {b.city ? ` · ${b.city}` : ''}
                  </Badge>
                  <span className="text-[11px] text-text-faint shrink-0">{timeAgo(minutesSince(b.createdAt))}</span>
                </div>
                <p className="text-[13px] text-text leading-relaxed line-clamp-3 whitespace-pre-line">{b.text}</p>
                <p className="text-[12px] text-text-faint mt-1.5">
                  доставлено {b.sent} из {b.total}
                  {b.failed > 0 && ` · не дошло ${b.failed}`}
                  {!b.done && ' · прервана'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Отправить рассылку?"
        description={`Сообщение получат ${effectiveCount} чел. (${AUDIENCE_LABEL[audience].toLowerCase()}${audience !== 'custom' && city ? `, ${city}` : ''}). Отменить отправку после старта нельзя.`}
      >
        <div className="rounded-xl bg-surface-2 p-3 mb-4 text-[13px] text-text leading-relaxed whitespace-pre-line max-h-[200px] overflow-y-auto">
          {text.trim()}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>
            Отмена
          </Button>
          <Button variant="primary" className="flex-1" onClick={send}>
            Отправить
          </Button>
        </div>
      </Modal>
    </div>
  );
}
