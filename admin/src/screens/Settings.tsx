import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { apiFetch, ApiError } from '@/lib/apiClient';
import { Card, SectionLabel } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useCan } from '@/store/useSessionStore';
import { FEATURES } from '@/lib/features';
import { cn } from '@/lib/cn';

const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск'];

/** Sends a real alert through the real path, because "уведомления не
 *  приходят" is almost always the bot not being allowed to DM you yet —
 *  and there's no way to tell without actually trying. */
function TestAlertButton() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function test() {
    setState('sending');
    setMessage('');
    try {
      await apiFetch('/admin/health/test-alert', { method: 'POST' });
      setState('sent');
      setMessage('Отправлено — проверьте чат с ботом. Если ничего не пришло, откройте бота и нажмите «Старт».');
    } catch (err) {
      setState('error');
      setMessage(
        err instanceof ApiError && err.code === 'no_admin_chat_id'
          ? 'Не задан ADMIN_CHAT_ID (и OWNER_TELEGRAM_ID) — укажите свой числовой Telegram ID секретом воркера.'
          : 'Не получилось отправить — проверьте, что воркер задеплоен с BOT_TOKEN.',
      );
    }
  }

  return (
    <div>
      <Button variant="dark" disabled={state === 'sending'} onClick={test}>
        {state === 'sending' ? 'Отправляем…' : 'Отправить тестовое уведомление'}
      </Button>
      {message && (
        <p className={cn('text-[12px] mt-2.5 leading-relaxed', state === 'error' ? 'text-danger' : 'text-accent')}>{message}</p>
      )}
    </div>
  );
}

interface WebhookState {
  connected: boolean;
  otherUrl: boolean;
  lastError: string | null;
}

/** Registering the my_chat_member webhook by hand means digging up the bot
 *  token and the Worker's URL and assembling an api.telegram.org link. The
 *  Worker has both already, so this is a button. */
function WebhookCard() {
  const [state, setState] = useState<WebhookState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      setState(await apiFetch<WebhookState>('/admin/health/webhook'));
    } catch (err) {
      setState(null);
      setError(
        err instanceof ApiError && err.code === 'no_bot_token'
          ? 'BOT_TOKEN не задан в секретах воркера.'
          : 'Не получилось спросить у Telegram — проверьте, что воркер задеплоен.',
      );
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/admin/health/webhook', { method: 'POST' });
      await refresh();
    } catch {
      setError('Telegram отказался принять адрес. Убедитесь, что воркер доступен по https.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6 sm:col-span-2">
      <SectionLabel className="mb-4">Мгновенный статус бота</SectionLabel>
      <p className="text-[13px] text-text-muted leading-relaxed mb-4">
        Пока это не подключено, «Заблокировал бота» в разделе «Пользователи» появляется с задержкой — только когда боту
        не удастся отправить очередное уведомление. С подключением Telegram сообщает о блокировке (и о разблокировке)
        сразу.
      </p>

      {state?.connected && <p className="text-[13px] text-accent mb-3">Подключено — статусы обновляются мгновенно.</p>}
      {state && !state.connected && !state.otherUrl && (
        <p className="text-[13px] text-text-muted mb-3">Не подключено.</p>
      )}
      {state?.otherUrl && (
        <p className="text-[13px] text-warning mb-3 leading-relaxed">
          У бота уже прописан другой адрес — похоже, на него смотрит другая копия Wolso. Кнопка ниже переключит бота на
          этот воркер.
        </p>
      )}
      {state?.lastError && (
        <p className="text-[13px] text-danger mb-3 leading-relaxed">Последняя ошибка от Telegram: {state.lastError}</p>
      )}

      <Button variant="dark" disabled={busy} onClick={connect}>
        {busy ? 'Подключаем…' : state?.connected ? 'Подключить заново' : 'Подключить'}
      </Button>
      {error && <p className="text-[12px] mt-2.5 text-danger leading-relaxed">{error}</p>}
    </Card>
  );
}

interface SchemaHealth {
  ok: boolean;
  missingMigrations: string[];
  missingColumns: { table: string; column: string; migration: string; breaks: string }[];
  missingTables: { table: string; migration: string; breaks: string }[];
  sql: { migration: string; statements: string[] }[];
}

/** Migrations are applied by hand in the D1 console, so the database can
 *  sit a migration behind the deployed code — and when it does, the
 *  failure is a bare 500 with no hint of the cause. This names the missing
 *  migration and hands over the exact statements to paste, straight from
 *  the real .sql files. */
function SchemaHealthCard() {
  const [health, setHealth] = useState<SchemaHealth | null>(null);
  const [state, setState] = useState<'idle' | 'checking' | 'error'>('idle');
  const [copied, setCopied] = useState<string | null>(null);

  async function check() {
    setState('checking');
    try {
      setHealth(await apiFetch<SchemaHealth>('/admin/health/schema'));
      setState('idle');
    } catch {
      setState('error');
    }
  }

  async function copy(migration: string, statements: string[]) {
    await navigator.clipboard.writeText(statements.join('\n\n'));
    setCopied(migration);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <Card className="p-6 sm:col-span-2">
      <SectionLabel className="mb-4">Состояние базы данных</SectionLabel>
      <p className="text-[13px] text-text-muted leading-relaxed mb-4">
        Проверяет, все ли миграции применены к базе. Если какой-то не хватает, код обращается к колонке, которой нет, — и
        всё, что её использует, отвечает ошибкой 500 без объяснений.
      </p>

      <Button variant="dark" disabled={state === 'checking'} onClick={check}>
        {state === 'checking' ? 'Проверяем…' : 'Проверить миграции'}
      </Button>

      {state === 'error' && <p className="text-[12px] mt-2.5 text-danger">Не удалось проверить — воркер недоступен.</p>}

      {health?.ok && <p className="text-[13px] mt-3 text-accent">Все миграции применены — база в порядке.</p>}

      {health && !health.ok && (
        <div className="mt-4 space-y-4">
          <p className="text-[13px] text-danger leading-relaxed">
            Не применено: {health.missingMigrations.join(', ')}. Из-за этого не работает:{' '}
            {[...new Set([...health.missingColumns, ...health.missingTables].map((m) => m.breaks))].join(', ')}.
          </p>
          <p className="text-[12px] text-text-muted leading-relaxed">
            Откройте базу <span className="font-mono text-text">wolso</span> в панели Cloudflare → D1 → Console и выполните
            запросы по порядку. Консоль выполняет по одному запросу за раз. Ошибка вида{' '}
            <span className="font-mono text-text">duplicate column name</span> означает, что этот запрос уже применён — его
            можно пропустить.
          </p>

          {health.sql.map(({ migration, statements }) => (
            <div key={migration} className="rounded-xl border border-border-soft overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-surface-2">
                <span className="font-mono text-[12px] text-text">{migration}</span>
                <button
                  onClick={() => copy(migration, statements)}
                  className="text-[12px] font-medium text-accent hover:opacity-70 transition-opacity shrink-0"
                >
                  {copied === migration ? 'Скопировано' : 'Копировать'}
                </button>
              </div>
              <pre className="px-3.5 py-3 text-[12px] font-mono text-text-muted overflow-x-auto whitespace-pre">
                {statements.join('\n\n')}
              </pre>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function Settings() {
  const s = useSettingsStore();
  const canEdit = useCan('changeCommission');

  return (
    <div className="pb-10">
      <PageHeader title="Настройки" subtitle="Общие параметры платформы Wolso" />

      <div className="px-4 sm:px-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className={cn('p-6', !FEATURES.payments && 'sm:col-span-2')}>
          <SectionLabel className="mb-4">Общее</SectionLabel>
          <div className="space-y-4">
            <div>
              <Label>Название платформы</Label>
              <Input value={s.platformName} disabled={!canEdit} onChange={(e) => s.set('platformName', e.target.value)} />
            </div>
            <div>
              <Label>Email поддержки</Label>
              <Input value={s.supportEmail} disabled={!canEdit} onChange={(e) => s.set('supportEmail', e.target.value)} />
            </div>
            <div>
              <Label>Город по умолчанию</Label>
              <Select value={s.defaultCity} disabled={!canEdit} onChange={(e) => s.set('defaultCity', e.target.value)}>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        {FEATURES.payments && (
          <Card className="p-6">
            <SectionLabel className="mb-4">Платежи</SectionLabel>
            <div className="space-y-4">
              <div>
                <Label>Комиссия платформы по умолчанию</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    value={s.defaultCommissionPct}
                    disabled={!canEdit}
                    onChange={(e) => s.set('defaultCommissionPct', Number(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-[14px] text-text-muted">%</span>
                </div>
              </div>
              <div>
                <Label>Периодичность выплат</Label>
                <Select value={s.payoutSchedule} disabled={!canEdit} onChange={(e) => s.set('payoutSchedule', e.target.value as typeof s.payoutSchedule)}>
                  <option value="instant">Сразу после смены</option>
                  <option value="daily">Раз в день</option>
                  <option value="weekly">Раз в неделю</option>
                </Select>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 sm:col-span-2">
          <SectionLabel className="mb-4">Оповещения в Telegram</SectionLabel>
          <p className="text-[13px] text-text-muted leading-relaxed mb-4">
            Бот пишет вам в личку о новых регистрациях, работодателях, ждущих проверки, и обращениях в поддержку.
            Адрес задаётся секретом воркера <span className="font-mono text-text">ADMIN_CHAT_ID</span> (по умолчанию —{' '}
            <span className="font-mono text-text">OWNER_TELEGRAM_ID</span>).
            Важно: бот не сможет вам написать, пока вы сами хотя бы раз не нажмёте «Старт» в чате с ним.
          </p>
          <TestAlertButton />
        </Card>

        <WebhookCard />

        <SchemaHealthCard />

        <Card className="p-6 sm:col-span-2">
          <SectionLabel className="mb-4">Уведомления администраторам</SectionLabel>
          <div className="divide-y divide-border-soft">
            <NotifyRow
              label="Ставка ниже МРОТ"
              description="Уведомлять при публикации вакансии с оплатой ниже регионального минимума"
              checked={s.notifyOnBelowMinWage}
              disabled={!canEdit}
              onChange={(v) => s.set('notifyOnBelowMinWage', v)}
            />
            <NotifyRow
              label="Новый работодатель"
              description="Уведомлять при первой публикации вакансии от нового работодателя"
              checked={s.notifyOnNewEmployer}
              disabled={!canEdit}
              onChange={(v) => s.set('notifyOnNewEmployer', v)}
            />
          </div>
        </Card>
      </div>

      <div className="px-4 sm:px-8 mt-4">
        <Button variant="dark" disabled={!canEdit}>Сохранить изменения</Button>
      </div>
    </div>
  );
}

function NotifyRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div>
        <p className="text-[14px] font-medium text-text">{label}</p>
        <p className="text-[13px] text-text-muted mt-0.5">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}
