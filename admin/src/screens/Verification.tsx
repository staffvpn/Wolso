import { useEffect, useState } from 'react';
import { Send, FileSearch, RefreshCw, Check, X, BadgeCheck, Copy, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Label, Textarea } from '@/components/ui/Input';
import { EmptyPanel } from '@/components/EmptyPanel';
import { useVerificationStore } from '@/store/useVerificationStore';
import { useCan } from '@/store/useSessionStore';
import { telegramLink, telegramLabel, timeAgo, minutesSince } from '@/lib/format';
import { ApiError } from '@/lib/apiClient';
import { cn } from '@/lib/cn';
import type { EmployerVerification } from '@/types';

export function Verification() {
  const employers = useVerificationStore((s) => s.employers);
  const loading = useVerificationStore((s) => s.loading);
  const loaded = useVerificationStore((s) => s.loaded);
  const load = useVerificationStore((s) => s.load);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    load();
    // New employers finish onboarding on their own time — poll so the
    // queue doesn't require a manual refresh to notice one.
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId && !employers.some((e) => e.id === selectedId)) setSelectedId(null);
  }, [employers, selectedId]);

  const selected = employers.find((e) => e.id === selectedId) ?? null;

  return (
    <div className="pb-10 flex flex-col lg:h-full lg:min-h-0">
      <PageHeader title="Проверка работодателей" subtitle={employers.length > 0 ? `Ожидают решения: ${employers.length}` : undefined} />

      <div className="lg:flex-1 lg:min-h-0 px-4 sm:px-8 pb-6 lg:pb-0 grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-5">
        <Card className="lg:overflow-hidden flex flex-col">
          <div className="lg:overflow-y-auto divide-y divide-border-soft">
            {employers.map((e) => (
              <button
                key={e.id}
                onClick={() => setSelectedId(e.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-2 transition-colors',
                  selectedId === e.id && 'bg-surface-2',
                )}
              >
                <Avatar name={e.name} src={e.avatarUrl} size={40} square />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-text truncate">{e.name}</p>
                  <p className="text-[12px] text-text-faint truncate">
                    {e.city}{e.inn ? ` · ИНН ${e.inn}` : ' · ИНН не указан'}
                  </p>
                </div>
                {e.aiSummary && (
                  <span className="shrink-0 text-accent" title="Есть данные из ЕГРЮЛ/ЕГРИП">
                    <FileSearch size={14} />
                  </span>
                )}
                <span className="shrink-0 text-[12px] text-text-faint">{timeAgo(minutesSince(e.createdAt))}</span>
              </button>
            ))}
            {!loading && loaded && employers.length === 0 && (
              <EmptyPanel title="Очередь пуста" description="Новые заполненные анкеты работодателей появятся здесь автоматически." />
            )}
          </div>
        </Card>

        <Card className="p-6 h-fit lg:sticky lg:top-0">
          {!selected && <EmptyPanel title="Выберите анкету" description="Нажмите на работодателя слева, чтобы посмотреть детали и принять решение." />}
          {selected && <EmployerDetail employer={selected} onDone={() => setSelectedId(null)} />}
        </Card>
      </div>
    </div>
  );
}

/** Same graceful degradation as the Users screen's Telegram link: a
 *  username gives a real https://t.me link, otherwise there's nothing
 *  Telegram lets us link to — show the id as copyable text instead. */
function TelegramLinkRow({ telegramId, telegramUsername }: { telegramId: number; telegramUsername?: string }) {
  const link = telegramLink(telegramId, telegramUsername);
  const [copied, setCopied] = useState(false);

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent mb-4 hover:underline"
      >
        <Send size={13} /> {telegramLabel(telegramId, telegramUsername)}
      </a>
    );
  }

  async function copyId() {
    await navigator.clipboard.writeText(String(telegramId));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copyId}
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-muted hover:text-text transition-colors mb-4"
    >
      {copied ? <Check size={13} className="text-accent" /> : <Copy size={13} />}
      {copied ? 'Скопировано' : telegramLabel(telegramId, telegramUsername)}
    </button>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'На проверке',
  approved: 'Одобрен',
  rejected: 'Отклонён',
};

function EmployerDetail({ employer, onDone }: { employer: EmployerVerification; onDone: () => void }) {
  const approve = useVerificationStore((s) => s.approve);
  const reject = useVerificationStore((s) => s.reject);
  const recheck = useVerificationStore((s) => s.recheck);
  const rechecking = useVerificationStore((s) => s.rechecking);
  const canDecide = useCan('approveVacancies');

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doApprove() {
    setBusy(true);
    setError(null);
    try {
      await approve(employer.id);
      onDone();
    } catch {
      setError('Не получилось одобрить — попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    if (!reason.trim()) {
      setError('Укажите причину отказа — работодатель увидит именно этот текст');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await reject(employer.id, reason.trim());
      onDone();
    } catch {
      setError('Не получилось отклонить — попробуйте ещё раз');
    } finally {
      setBusy(false);
    }
  }

  async function doRecheck() {
    setError(null);
    try {
      await recheck(employer.id);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? 'Реестр ФНС не ответил — попробуйте ещё раз чуть позже или проверьте вручную по ссылке ниже'
          : 'Не получилось запросить проверку',
      );
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <Avatar name={employer.name} src={employer.avatarUrl} size={44} square />
        <div className="min-w-0">
          <p className="font-bold text-[17px] leading-tight truncate">{employer.name}</p>
          <p className="text-[13px] text-text-muted mt-0.5">
            {employer.city}{employer.foundedYear ? ` · с ${employer.foundedYear}` : ''}
          </p>
        </div>
      </div>

      <TelegramLinkRow telegramId={employer.telegramId} telegramUsername={employer.telegramUsername} />

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Badge tone={employer.status === 'approved' ? 'accent' : employer.status === 'rejected' ? 'danger' : 'warning'}>
          {STATUS_LABEL[employer.status]}
        </Badge>
        <Badge tone="neutral">ИНН {employer.inn ?? '—'}</Badge>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-1.5">Адрес</p>
          <p className="text-[13px] text-text leading-relaxed">{employer.address || '—'}</p>
        </div>
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-1.5">Описание</p>
          <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">{employer.description || '—'}</p>
        </div>

        <div className="rounded-xl bg-surface-2 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint flex items-center gap-1.5">
              <FileSearch size={13} className="text-accent" /> Данные ЕГРЮЛ/ЕГРИП
            </p>
            <Button variant="outline" className="!h-7 !px-2.5 !text-[12px]" disabled={rechecking === employer.id} onClick={doRecheck}>
              <RefreshCw size={12} className={rechecking === employer.id ? 'animate-spin' : ''} /> {employer.aiSummary ? 'Обновить' : 'Запросить'}
            </Button>
          </div>
          {employer.aiSummary ? (
            <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">{employer.aiSummary}</p>
          ) : (
            <p className="text-[13px] text-text-faint leading-relaxed">
              Пока ничего не найдено — нажмите «Запросить», чтобы автоматически проверить ИНН в реестре ФНС (egrul.nalog.ru). Это только справочная информация, решение всё равно принимаете вы.
            </p>
          )}
          {employer.inn && (
            <a
              href={`https://www.rusprofile.ru/search?query=${encodeURIComponent(employer.inn)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-accent mt-2.5 hover:underline"
            >
              Проверить вручную на rusprofile.ru <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      {employer.status === 'pending' && (
        <>
          {!rejecting ? (
            <div className="flex flex-col gap-2">
              <Button variant="primary" className="w-full" disabled={!canDecide || busy} onClick={doApprove}>
                <Check size={15} /> Одобрить
              </Button>
              <Button variant="outline" className="w-full text-danger border-danger/30" disabled={!canDecide || busy} onClick={() => setRejecting(true)}>
                <X size={15} /> Отклонить
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Причина отказа</Label>
                <Textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Работодатель увидит этот текст и сможет исправить анкету"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="danger" className="flex-1" disabled={busy} onClick={doReject}>
                  Отклонить
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => setRejecting(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {employer.status !== 'pending' && (
        <div className="rounded-xl bg-surface-2 p-4 text-[13px] text-text-muted flex items-center gap-2">
          <BadgeCheck size={15} /> Решение уже принято
        </div>
      )}

      {error && <p className="text-[12px] text-danger mt-3 leading-relaxed">{error}</p>}
    </div>
  );
}
