import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, Pencil, XCircle } from 'lucide-react';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { Card, SectionLabel } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ListRow } from '@/components/ui/ListRow';
import { useCompanyStore } from '@/store/useCompanyStore';
import { useEmployerStore } from '@/store/useEmployerStore';
import { FEATURES } from '@/lib/features';

export function EmployerProfileScreen() {
  const navigate = useNavigate();
  const company = useCompanyStore((s) => s.company);
  const loadCompany = useCompanyStore((s) => s.load);
  const vacancies = useEmployerStore((s) => s.vacancies);
  const candidates = useEmployerStore((s) => s.candidates);

  useEffect(() => {
    if (!company) loadCompany();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hires = candidates.filter((c) => c.status === 'accepted').length;

  if (!company) return null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto px-5 pt-5 safe-top pb-4">
      <div className="flex items-center gap-4">
        {company.avatarUrl ? (
          <Avatar src={company.avatarUrl} name={company.name} size={64} className="rounded-2xl" />
        ) : (
          <LogoBadge initial={company.logoInitial} color={company.logoColor} size={64} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-[20px] font-extrabold truncate">{company.name}</h1>
            {company.verified && <ShieldCheck size={16} className="text-accent shrink-0" />}
          </div>
          <p className="text-[13px] text-text-muted">
            {company.address}
            {company.foundedYear && ` · с ${company.foundedYear}`}
          </p>
          <p className="text-accent text-[13px] font-bold mt-0.5">★ {company.rating} · {company.reviewsCount} отзывов</p>
        </div>
        <button
          onClick={() => navigate('/e/profile/edit')}
          aria-label="Редактировать профиль"
          className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center shrink-0"
        >
          <Pencil size={15} className="text-text-muted" />
        </button>
      </div>

      {company.description && <p className="text-[14px] text-text leading-relaxed mt-4">{company.description}</p>}

      {(company.photos ?? []).length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto -mx-5 px-5">
          {company.photos!.map((p) => (
            <img key={p.id} src={p.url} alt="" className="h-24 w-24 rounded-2xl object-cover shrink-0" />
          ))}
        </div>
      )}

      {company.verificationStatus === 'pending_review' && (
        <div className="flex items-start gap-3 rounded-card bg-warning-soft text-warning px-4 py-3 mt-5">
          <Clock size={17} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[14px]">Профиль на проверке</p>
            <p className="text-[13px] leading-relaxed mt-0.5">
              Команда Wolso проверяет заведение — обычно это занимает до суток. Публиковать вакансии можно будет после одобрения.
            </p>
          </div>
        </div>
      )}
      {company.verificationStatus === 'rejected' && (
        <div className="flex items-start gap-3 rounded-card bg-danger-soft text-danger px-4 py-3 mt-5">
          <XCircle size={17} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[14px]">Проверка не пройдена</p>
            <p className="text-[13px] leading-relaxed mt-0.5">
              Напишите в поддержку, чтобы узнать причину и как это исправить.
            </p>
          </div>
        </div>
      )}

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
        </Card>
      </div>

      <div className="mt-6">
        <SectionLabel>Поддержка</SectionLabel>
        <Card className="divide-y divide-border-soft px-1">
          <div className="px-3">
            <ListRow label="Помощь" onClick={() => navigate('/e/support')} />
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
