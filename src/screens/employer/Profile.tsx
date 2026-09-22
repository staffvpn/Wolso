import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Pencil, Send } from 'lucide-react';
import { Avatar, LogoBadge } from '@/components/ui/Avatar';
import { SafeImage } from '@/components/ui/SafeImage';
import { Card, SectionLabel } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ListRow } from '@/components/ui/ListRow';
import { useCompanyStore } from '@/store/useCompanyStore';
import { useEmployerStore } from '@/store/useEmployerStore';
import { FEATURES } from '@/lib/features';
import { formatRating } from '@/lib/format';
import { openExternal, hapticSelect } from '@/lib/telegram';

const CHANNEL_URL = 'https://t.me/wolsoapp';

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

  // overflow-x-hidden обязателен: по спецификации overflow-y: auto
  // вычисляет overflow-x как auto, даже если он visible. Полоса фото ниже
  // выходит за края через -mx-5, и без этого весь экран тянулся вбок на
  // 20 px в пустоту.
  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden px-5 pt-5 safe-top pb-4">
      <div
        className="relative rounded-card overflow-hidden p-5 flex flex-col items-center text-center"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, var(--color-accent-soft), transparent 65%)' }}
      >
        <button
          onClick={() => navigate('/e/profile/edit')}
          aria-label="Редактировать профиль"
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/25 backdrop-blur flex items-center justify-center"
        >
          <Pencil size={15} className="text-white" />
        </button>
        {company.avatarUrl ? (
          <Avatar src={company.avatarUrl} name={company.name} size={80} className="rounded-2xl ring-[3px] ring-accent" />
        ) : (
          <LogoBadge initial={company.logoInitial} color={company.logoColor} size={80} className="ring-[3px] ring-accent" />
        )}
        <h1 className="text-[19px] font-extrabold mt-3 truncate max-w-full">{company.name || 'Без названия'}</h1>
        {(company.address || company.foundedYear) && (
          <p className="text-[13px] text-text-muted mt-0.5">
            {company.address}
            {company.foundedYear && `${company.address ? ' · ' : ''}с ${company.foundedYear}`}
          </p>
        )}
      </div>

      {/* Рейтинг и число отзывов — только в третьей плитке ниже, не
          повторяются строкой под названием, как раньше. */}
      <div className="flex gap-2 mt-4">
        <Card className="flex-1 p-3 text-center">
          <p className="text-[18px] font-extrabold">{vacancies.length}</p>
          <p className="text-[10.5px] text-text-muted mt-1">смен опубл.</p>
        </Card>
        <Card className="flex-1 p-3 text-center">
          <p className="text-[18px] font-extrabold">{hires}</p>
          <p className="text-[10.5px] text-text-muted mt-1">нанято</p>
        </Card>
        <button
          onClick={() => navigate('/e/reviews')}
          className="flex-1 rounded-card bg-surface border border-border-soft p-3 text-center"
        >
          <p className="text-[18px] font-extrabold">{formatRating(company.rating)}</p>
          <p className="text-[10.5px] text-text-muted mt-1">{company.reviewsCount} отзывов</p>
        </button>
      </div>

      {company.description && (
        <Card className="p-4 mt-4">
          <SectionLabel className="mb-1.5">О компании</SectionLabel>
          <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">{company.description}</p>
        </Card>
      )}

      {(company.photos ?? []).length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2.5">
            <SectionLabel className="mb-0">Фото</SectionLabel>
            <span className="text-[12px] text-text-faint">{company.photos!.length} из 6</span>
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5">
            {company.photos!.map((p) => (
              <SafeImage
                key={p.id}
                src={p.url}
                alt=""
                className="h-24 w-24 rounded-2xl object-cover shrink-0 border border-border-soft"
              />
            ))}
          </div>
        </div>
      )}

      {FEATURES.payments && (
        <div className="mt-6">
          <SectionLabel>Аккаунт</SectionLabel>
          <Card className="divide-y divide-border-soft px-1">
            <div className="px-3">
              <ListRow label="Карта для оплаты откликов" value="···4120" />
            </div>
          </Card>
        </div>
      )}

      <div className="mt-6">
        <SectionLabel>Поддержка</SectionLabel>
        <Card className="divide-y divide-border-soft px-1">
          <div className="px-3">
            <ListRow label="Настройки" onClick={() => navigate('/e/settings')} />
          </div>
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

      <button
        onClick={() => {
          hapticSelect();
          openExternal(CHANNEL_URL, 'telegram');
        }}
        className="mt-4 w-full flex items-center gap-3 rounded-card bg-accent-soft border border-border-soft p-3.5 text-left"
      >
        <span className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center text-accent-fg shrink-0">
          <Send size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-bold text-text">Канал Wolso в Telegram</span>
          <span className="block text-[11.5px] text-text-muted mt-0.5">Новости и смены, которых нет в ленте</span>
        </span>
        <ChevronRight size={15} className="text-text-faint shrink-0" />
      </button>
    </div>
  );
}
