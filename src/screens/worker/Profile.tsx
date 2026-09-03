import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, ChevronRight, EyeOff, Pencil, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SafeImage } from '@/components/ui/SafeImage';
import { Chip } from '@/components/ui/Chip';
import { Card, SectionLabel } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useProfileStore } from '@/store/useProfileStore';
import { FEATURES } from '@/lib/features';
import { formatExperience, formatRating } from '@/lib/format';

export function WorkerProfileScreen() {
  const navigate = useNavigate();
  const profile = useProfileStore();
  const { positions, loaded, load } = profile;

  useEffect(() => {
    if (!loaded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto px-5 pt-5 safe-top pb-4">
      <div className="flex items-center gap-4">
        <Avatar name={profile.name} src={profile.avatarUrl} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold truncate">
            {profile.name}
            {profile.age && <span className="font-medium text-text-muted">, {profile.age}</span>}
          </h1>
          <p className="text-[13px] text-text-muted">{positions[0]?.positionLabel} · {profile.city}</p>
          <button onClick={() => navigate('/w/reviews')} className="flex items-center gap-1 mt-1 text-left">
            <span className="text-accent text-[13px] font-bold">{formatRating(profile.rating)}</span>
            <span className="text-text-faint text-[13px]">· {profile.shiftsCompleted} смен</span>
            <ChevronRight size={13} className="text-text-faint" />
          </button>
        </div>
        <button
          onClick={() => navigate('/w/profile/edit')}
          aria-label="Редактировать профиль"
          className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center shrink-0"
        >
          <Pencil size={15} className="text-text-muted" />
        </button>
      </div>

      {/* The same fact the feed shows, repeated here because this is the
          screen someone opens when they go looking for what's wrong with
          their anketa. */}
      {profile.hidden && (
        <div className="mt-4 rounded-2xl bg-surface-2 border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <EyeOff size={15} className="text-text-muted" />
            <p className="text-[14px] font-bold">Анкета скрыта</p>
          </div>
          <p className="text-[13px] text-text-muted leading-relaxed">
            Работодатели не видят её в поиске, а откликаться на новые смены нельзя.
            {profile.hiddenReason ? '' : ' Поправьте анкету и напишите в поддержку.'}
          </p>
          {profile.hiddenReason && (
            <p className="text-[13px] text-text leading-relaxed mt-2 whitespace-pre-line">{profile.hiddenReason}</p>
          )}
        </div>
      )}

      {/* Not a scolding banner: it's the single change that most affects
          whether this person gets picked, and signup silently copied a
          Telegram picture that may be a car or a landscape. Gone the
          moment they upload anything of their own. */}
      {profile.avatarIsFromTelegram && !profile.hidden && (
        <button
          onClick={() => navigate('/w/profile/edit')}
          className="mt-4 w-full text-left rounded-2xl bg-accent-soft p-4 flex items-start gap-3"
        >
          <Camera size={18} className="text-accent shrink-0 mt-0.5" />
          <span className="min-w-0">
            <span className="block text-[14px] font-bold">Поставьте своё фото</span>
            <span className="block text-[13px] text-text-muted leading-relaxed mt-0.5">
              Сейчас на анкете фото из Telegram. Работодатель выбирает по лицу — с обычным селфи зовут заметно чаще.
            </span>
          </span>
        </button>
      )}

      {/* Одной строкой, а не секцией с чипами: это справочный факт об
          анкете, а не то, ради чего человек открыл экран. */}
      <p className="text-[13px] text-text-muted mt-3">
        Ищу: {profile.lookingFor === 'shift' ? 'смены' : profile.lookingFor === 'permanent' ? 'постоянную работу' : 'смены и постоянную работу'}
      </p>

      {profile.bio && <p className="text-[14px] text-text leading-relaxed mt-4 whitespace-pre-line">{profile.bio}</p>}

      {profile.skills && (
        <div className="mt-3">
          <SectionLabel>Навыки</SectionLabel>
          <p className="text-[13px] text-text-muted leading-relaxed whitespace-pre-line">{profile.skills}</p>
        </div>
      )}

      {profile.photos.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto -mx-5 px-5">
          {profile.photos.map((p) => (
            <SafeImage key={p.id} src={p.url} alt="" className="h-24 w-24 rounded-2xl object-cover shrink-0" />
          ))}
        </div>
      )}

      <div className="mt-6">
        <SectionLabel>Опыт работы</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {positions.map((p) => (
            <Chip key={p.id} tone="dark" selected>
              {p.positionLabel} · {formatExperience(p.months)}
            </Chip>
          ))}
          <button
            onClick={() => navigate('/w/profile/edit')}
            className="h-10 w-10 rounded-full border border-dashed border-border flex items-center justify-center text-text-faint"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <Card className="divide-y divide-border-soft px-1">
          {FEATURES.payments && (
            <div className="px-3">
              <ListRow label="Кошелёк" onClick={() => navigate('/w/wallet')} />
            </div>
          )}
          <div className="px-3">
            <ListRow label="Избранное" onClick={() => navigate('/w/favorites')} />
          </div>
          <div className="px-3">
            <ListRow label="Настройки" onClick={() => navigate('/w/settings')} />
          </div>
        </Card>
      </div>
    </div>
  );
}
