import { PageHeader } from '@/components/layout/PageHeader';
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

export function Settings() {
  const s = useSettingsStore();
  const canEdit = useCan('changeCommission');

  return (
    <div className="pb-10">
      <PageHeader title="Настройки" subtitle="Общие параметры платформы Wolso" />

      <div className="px-8 grid grid-cols-2 gap-4">
        <Card className={cn('p-6', !FEATURES.payments && 'col-span-2')}>
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

        <Card className="p-6 col-span-2">
          <SectionLabel className="mb-4">Уведомления администраторам</SectionLabel>
          <div className="divide-y divide-border-soft">
            <NotifyRow
              label="Всплеск жалоб"
              description="Уведомлять, если жалоб на одного работодателя больше 3 за неделю"
              checked={s.notifyOnComplaintSpike}
              disabled={!canEdit}
              onChange={(v) => s.set('notifyOnComplaintSpike', v)}
            />
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

      <div className="px-8 mt-4">
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
