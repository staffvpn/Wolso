import { useState } from 'react';
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
