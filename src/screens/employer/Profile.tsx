import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { LogoBadge } from '@/components/ui/Avatar';
import { Card, SectionLabel } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ListRow } from '@/components/ui/ListRow';
import { useCompanyStore } from '@/store/useCompanyStore';
import { useEmployerStore } from '@/store/useEmployerStore';
import { useAppStore } from '@/store/useAppStore';
import { FEATURES } from '@/lib/features';

export function EmployerProfileScreen() {
  const navigate = useNavigate();
  const company = useCompanyStore((s) => s.company);
  const loadCompany = useCompanyStore((s) => s.load);
  const vacancies = useEmployerStore((s) => s.vacancies);
  const candidates = useEmployerStore((s) => s.candidates);
  const switchRole = useAppStore((s) => s.switchRole);

  useEffect(() => {
    if (!company) loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hires = candidates.filter((c) => c.status === 'accepted').length;

  if (!company) return null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto px-5 pt-5 safe-top pb-4">
      <div className="flex items-center gap-4">
        <LogoBadge initial={company.logoInitial} color={company.logoColor} size={64} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[20px] font-extrabold truncate">{company.name}</h1>
            {company.verified && <ShieldCheck size={16} className="text-accent shrink-0" />}
          </div>
          <p className="text-[13px] text-text-muted">{company.address}</p>
          <p className="text-accent text-[13px] font-bold mt-0.5">★ {company.rating} · {company.reviewsCount} отзывов</p>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Card className="flex-1 p-4">
          <p className="text-[22px] font-extrabold">{vacancies.length}</p>
          <p className="text-[12px] text-text-muted mt-0.5">смен опубликовано</p>
        </Card>
        <Card className="flex-1 p-4">
          <p className="text-[22px] font-extrabold">{hires}</p>
          <p className="text-[12px] text-text-muted mt-0.5">человек нанято</p>
        </Card>
      </div>

      <div className="mt-6">
        <SectionLabel>Аккаунт</SectionLabel>
        <Card className="divide-y divide-border-soft px-1">
          <div className="px-3">
            <ListRow label="Реквизиты и ИНН" value={company.inn} />
          </div>
          {FEATURES.payments && (
            <div className="px-3">
              <ListRow label="Карта для оплаты откликов" value="···4120" />
            </div>
          )}
          <div className="px-3">
            <ListRow
              label="Переключиться на работника"
              onClick={() => {
                switchRole('worker');
                navigate('/w/feed', { replace: true });
              }}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Badge tone="neutral" className="w-full justify-center py-2.5">
          Wolso Business · тарифы скоро
        </Badge>
      </div>
    </div>
  );
}
