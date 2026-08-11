import { useNavigate } from 'react-router-dom';
import { Copy, Users2 } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Toggle } from '@/components/ui/Toggle';
import { SectionLabel } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { IconButton } from '@/components/ui/IconButton';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useAppStore } from '@/store/useAppStore';
import { WORKER_PROFILE } from '@/data/profile';
import { hapticNotify } from '@/lib/telegram';

export function Settings() {
  const navigate = useNavigate();
  const s = useSettingsStore();
  const switchRole = useAppStore((st) => st.switchRole);
  const referralLink = `wolso.app/i/${WORKER_PROFILE.referralCode}`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Настройки" onBack={() => navigate(-1)} />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        <div className="rounded-card bg-accent p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-accent-fg/15 flex items-center justify-center shrink-0">
              <Users2 size={17} className="text-accent-fg" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-accent-fg text-[15px]">Приведите друга — 500 ₽</p>
              <p className="text-[12px] text-accent-fg/75 mt-0.5">Обоим после его первой закрытой смены</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1 h-10 rounded-xl bg-accent-fg/12 flex items-center px-3 text-accent-fg text-[13px] font-medium truncate">
              {referralLink}
            </div>
            <IconButton
              size={40}
              className="bg-accent-fg/15 border-none text-accent-fg"
              aria-label="Скопировать"
              onClick={() => {
                navigator.clipboard?.writeText(`https://${referralLink}`);
                hapticNotify('success');
              }}
            >
              <Copy size={16} />
            </IconButton>
          </div>
        </div>

        <SectionLabel>Уведомления</SectionLabel>
        <div className="divide-y divide-border-soft">
          <div className="flex items-center justify-between py-3">
            <span className="text-[15px] font-medium">Новые смены рядом</span>
            <Toggle checked={s.notifyNewShifts} onChange={s.setNotifyNewShifts} />
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-[15px] font-medium">Ответы работодателей</span>
            <Toggle checked={s.notifyEmployerReplies} onChange={s.setNotifyEmployerReplies} />
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-[15px] font-medium">Напоминание за час до смены</span>
            <Toggle checked={s.notifyReminder} onChange={s.setNotifyReminder} />
          </div>
        </div>

        <SectionLabel className="mt-6">Аккаунт</SectionLabel>
        <div className="divide-y divide-border-soft">
          <ListRow label="Город" value={s.city} />
          <ListRow label="Карта для выплат" value={s.card} />
          <ListRow label="Переключиться на работодателя" onClick={() => { switchRole('employer'); navigate('/e/profile', { replace: true }); }} />
        </div>

        <div className="mt-4">
          <ListRow label="Удалить аккаунт" danger showChevron={false} onClick={() => {}} />
        </div>
      </div>
    </div>
  );
}
