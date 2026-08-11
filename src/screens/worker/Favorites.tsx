import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, X } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LogoBadge } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useFavoritesStore } from '@/store/useFavoritesStore';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { getShift } from '@/data/shifts';
import { getCompany, COMPANIES } from '@/data/companies';
import { formatMoney, relativeDay } from '@/lib/format';

type Tab = 'shifts' | 'companies';

export function Favorites() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('shifts');
  const { shiftIds, companyIds, removeShift, toggleCompany } = useFavoritesStore();
  const apply = useApplicationsStore((s) => s.apply);
  const applications = useApplicationsStore((s) => s.applications);

  const favoriteShifts = shiftIds.map((id) => getShift(id)).filter((s): s is NonNullable<typeof s> => !!s);
  const favoriteCompanies = COMPANIES.filter((c) => companyIds.includes(c.id));

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Избранное" onBack={() => navigate(-1)} subtitle="Смены и заведения, которые вы сохранили" />

      <div className="flex gap-2 px-5 pb-3 shrink-0">
        <Chip selected={tab === 'shifts'} onClick={() => setTab('shifts')}>Смены · {favoriteShifts.length}</Chip>
        <Chip selected={tab === 'companies'} onClick={() => setTab('companies')}>Заведения · {favoriteCompanies.length}</Chip>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
        {tab === 'shifts' &&
          (favoriteShifts.length === 0 ? (
            <EmptyState title="Нет сохранённых смен" description="Нажимайте на сердечко на карточке смены, чтобы сохранить её сюда." />
          ) : (
            <div className="space-y-3">
              {favoriteShifts.map((shift) => {
                const company = getCompany(shift.companyId);
                const already = applications.some((a) => a.shiftId === shift.id);
                return (
                  <div key={shift.id} className="rounded-card bg-surface border border-border-soft p-4">
                    <div className="flex items-center gap-3">
                      <LogoBadge initial={company.logoInitial} color={company.logoColor} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px] truncate">{shift.positionLabel} · {company.name}</p>
                        <p className="text-[13px] text-text-muted truncate">
                          {relativeDay(new Date(shift.date))} {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')} · {formatMoney(shift.hourlyRate)}/ч
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button className="flex-1" size="md" disabled={already} onClick={() => apply(shift.id)}>
                        {already ? 'Отклик отправлен' : 'Откликнуться'}
                      </Button>
                      <IconButton size={40} onClick={() => removeShift(shift.id)} aria-label="Убрать">
                        <X size={16} />
                      </IconButton>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

        {tab === 'companies' &&
          (favoriteCompanies.length === 0 ? (
            <EmptyState title="Нет сохранённых заведений" description="Отмечайте заведения, чтобы быстро находить их смены." />
          ) : (
            <div className="space-y-3">
              {favoriteCompanies.map((company) => (
                <div key={company.id} className="flex items-center gap-3 rounded-card bg-surface border border-border-soft p-4">
                  <LogoBadge initial={company.logoInitial} color={company.logoColor} size={40} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[15px] truncate">{company.name}</p>
                    <p className="text-[12px] text-text-muted truncate">{company.address}</p>
                  </div>
                  <IconButton size={36} onClick={() => toggleCompany(company.id)} aria-label="Изменить">
                    <Pencil size={14} />
                  </IconButton>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
