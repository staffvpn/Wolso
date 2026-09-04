import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from '@/components/ui/TopBar';
import { Toggle } from '@/components/ui/Toggle';
import { SectionLabel } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useCompanyStore } from '@/store/useCompanyStore';
import type { CompanyUpdate } from '@/services/companyApi';

/** Работодателям экрана настроек не было вообще, хотя бот пишет им не
 *  меньше, чем соискателям: каждый отклик, каждое подтверждение и отказ,
 *  каждое сообщение в чате плюс напоминание о нерассмотренных. Выключить
 *  это было нельзя никак. Набор зеркалит соискательский (см.
 *  screens/worker/Settings.tsx) и хранится так же — на аккаунте. */
export function EmployerSettings() {
  const navigate = useNavigate();
  const company = useCompanyStore((s) => s.company);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const [error, setError] = useState<string | null>(null);

  async function save(update: CompanyUpdate) {
    setError(null);
    try {
      await updateCompany(update);
    } catch {
      setError('Не получилось сохранить — проверьте связь и попробуйте ещё раз');
    }
  }

  if (!company) return null;

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Настройки" onBack={() => navigate(-1)} />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        <SectionLabel>Уведомления в боте</SectionLabel>
        <p className="text-[13px] text-text-muted -mt-1 mb-1 leading-relaxed">
          Выключенное сюда приходить перестанет. В самом приложении уведомления всё равно сохраняются — так вы ничего не
          пропустите, даже если выключите всё.
        </p>
        <div className="divide-y divide-border-soft">
          <div className="flex items-center justify-between py-3 gap-3">
            <span className="text-[15px] font-medium">Новые отклики на смены</span>
            <Toggle checked={company.notifyNewResponses ?? true} onChange={(v) => save({ notifyNewResponses: v })} />
          </div>
          <div className="flex items-center justify-between py-3 gap-3">
            <span className="text-[15px] font-medium">Подтверждения и отказы</span>
            <Toggle checked={company.notifyWorkerReplies ?? true} onChange={(v) => save({ notifyWorkerReplies: v })} />
          </div>
          <div className="flex items-center justify-between py-3 gap-3">
            <span className="text-[15px] font-medium">Напоминание о нерассмотренных откликах</span>
            <Toggle checked={company.notifyPendingReminder ?? true} onChange={(v) => save({ notifyPendingReminder: v })} />
          </div>
        </div>
        {error && <p className="text-[13px] text-danger mt-2 leading-relaxed">{error}</p>}

        <SectionLabel className="mt-6">Заведение</SectionLabel>
        <div className="divide-y divide-border-soft">
          <ListRow label="Город" value={company.city || '—'} onClick={() => navigate('/e/profile/edit')} />
        </div>

        <SectionLabel className="mt-6">Поддержка</SectionLabel>
        <div className="divide-y divide-border-soft">
          <ListRow label="Помощь" onClick={() => navigate('/e/support')} />
          <ListRow label="Удалить аккаунт" danger onClick={() => navigate('/e/support')} />
        </div>
      </div>
    </div>
  );
}
