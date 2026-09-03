import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Users2 } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Toggle } from '@/components/ui/Toggle';
import { SectionLabel } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { IconButton } from '@/components/ui/IconButton';
import { useProfileStore } from '@/store/useProfileStore';
import { hapticNotify } from '@/lib/telegram';
import { FEATURES } from '@/lib/features';
import type { ProfileUpdate } from '@/services/profileApi';

export function Settings() {
  const navigate = useNavigate();
  const profile = useProfileStore();
  const updateProfile = useProfileStore((s) => s.updateProfile);
  const [error, setError] = useState<string | null>(null);
  const referralLink = `wolso.app/i/${profile.referralCode}`;

  /** These are the account's settings, not the phone's — they used to be
   *  written to localStorage and read by nothing, so switching one off
   *  changed nothing and the messages kept coming. Saved immediately
   *  rather than behind a «Сохранить»: a switch that needs confirming
   *  doesn't read like a switch. */
  async function save(update: ProfileUpdate) {
    setError(null);
    try {
      await updateProfile(update);
    } catch {
      setError('Не получилось сохранить — проверьте связь и попробуйте ещё раз');
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Настройки" onBack={() => navigate(-1)} />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        {FEATURES.payments && (
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
        )}

        <SectionLabel>Уведомления в боте</SectionLabel>
        <p className="text-[13px] text-text-muted -mt-1 mb-1 leading-relaxed">
          Выключенное сюда приходить перестанет. В самом приложении уведомления всё равно сохраняются — так вы ничего не
          пропустите, даже если выключите всё.
        </p>
        <div className="divide-y divide-border-soft">
          <div className="flex items-center justify-between py-3 gap-3">
            {/* Labelled by what it actually does: the match is by position,
                not by distance — the app has no location data at all. */}
            <span className="text-[15px] font-medium">Новые смены по вашим должностям</span>
            <Toggle checked={profile.notifyNewShifts} onChange={(v) => save({ notifyNewShifts: v })} />
          </div>
          <div className="flex items-center justify-between py-3 gap-3">
            <span className="text-[15px] font-medium">Ответы работодателей</span>
            <Toggle checked={profile.notifyEmployerReplies} onChange={(v) => save({ notifyEmployerReplies: v })} />
          </div>
          <div className="flex items-center justify-between py-3 gap-3">
            <span className="text-[15px] font-medium">Напоминание перед сменой</span>
            <Toggle checked={profile.notifyShiftReminder} onChange={(v) => save({ notifyShiftReminder: v })} />
          </div>
        </div>
        {error && <p className="text-[13px] text-danger mt-2 leading-relaxed">{error}</p>}

        <SectionLabel className="mt-6">Аккаунт</SectionLabel>
        <div className="divide-y divide-border-soft">
          {/* The real city off the profile — this used to show a hardcoded
              «Москва» from the same dead store the switches lived in. */}
          <ListRow label="Город" value={profile.city || '—'} onClick={() => navigate('/w/profile/edit')} />
        </div>

        <SectionLabel className="mt-6">Поддержка</SectionLabel>
        <div className="divide-y divide-border-soft">
          <ListRow label="Помощь" onClick={() => navigate('/w/support')} />
          {/* Was a button with an empty onClick — it looked like account
              deletion and did nothing at all. Routed to support rather
              than wired to a self-service delete: erasing an account takes
              its shifts, chats and reviews with it, and staff already have
              that action in the dashboard. */}
          <ListRow label="Удалить аккаунт" danger onClick={() => navigate('/w/support')} />
        </div>
      </div>
    </div>
  );
}
