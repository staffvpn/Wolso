import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Camera, ChevronRight, EyeOff, Heart, Pencil, Plus, Send, Settings } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SafeImage } from '@/components/ui/SafeImage';
import { Chip } from '@/components/ui/Chip';
import { Card, SectionLabel } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useProfileStore } from '@/store/useProfileStore';
import { useAchievementsStore } from '@/store/useAchievementsStore';
import { formatExperience, formatRating } from '@/lib/format';
import { openExternal, hapticSelect } from '@/lib/telegram';

const CHANNEL_URL = 'https://t.me/wolsoapp';

export function WorkerProfileScreen() {
  const navigate = useNavigate();
  const profile = useProfileStore();
  const { positions, loaded, load } = profile;
  const { earnedCount, totalCount, loaded: achievementsLoaded, load: loadAchievements } = useAchievementsStore();

  useEffect(() => {
    if (!loaded) load();
    if (!achievementsLoaded) loadAchievements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) return null;

  // overflow-x-hidden обязателен: по спецификации overflow-y: auto
  // вычисляет overflow-x как auto, даже если он visible. Полоса фото ниже
  // выходит за края через -mx-5, и без этого весь экран тянулся вбок на
  // 20 px в пустоту.
  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto overflow-x-hidden px-5 pt-5 safe-top pb-4">
      <div
        className="relative shrink-0 min-h-[196px] rounded-card overflow-hidden p-5 flex flex-col items-center justify-center text-center"
        style={{ background: 'radial-gradient(120% 100% at 50% 0%, var(--color-accent-soft), transparent 65%)' }}
      >
        <button
          onClick={() => navigate('/w/profile/edit')}
          aria-label="Редактировать профиль"
          className="absolute top-3 right-3 h-9 w-9 rounded-full bg-black/25 backdrop-blur flex items-center justify-center shrink-0"
        >
          <Pencil size={15} className="text-white" />
        </button>
        <Avatar name={profile.name} src={profile.avatarUrl} size={96} className="rounded-2xl ring-[3px] ring-accent shrink-0" />
        <h1 className="text-[19px] font-extrabold mt-3 shrink-0">
          {profile.name || 'Без имени'}
          {profile.age && <span className="font-medium text-text-muted">, {profile.age}</span>}
        </h1>
        {/* Город обязателен в базе, а вот позиция — нет: у новой анкеты без
            добавленного опыта строка не должна начинаться с одинокого «·». */}
        {(positions[0]?.positionLabel || profile.city) && (
          <p className="text-[13px] text-text-muted mt-0.5 shrink-0">
            {[positions[0]?.positionLabel, profile.city].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* Смены и рейтинг живут только тут — раньше рейтинг дублировался
          строкой прямо под именем. Клик по «рейтинг» ведёт туда же, куда
          раньше вела та строка — на отзывы. Стаж — сумма месяцев по всем
          позициям ниже, а не отдельное число, взятое с потолка. */}
      <div className="flex gap-2 mt-6 shrink-0">
        <Card className="flex-1 min-h-[74px] p-3 flex flex-col items-center justify-center text-center">
          <p className="text-[16px] font-extrabold truncate max-w-full">{profile.shiftsCompleted}</p>
          <p className="text-[10.5px] text-text-muted mt-1">смены</p>
        </Card>
        <Card className="flex-1 min-h-[74px] p-3 flex flex-col items-center justify-center text-center">
          <p className="text-[16px] font-extrabold truncate max-w-full">
            {positions.length > 0 ? formatExperience(positions.reduce((sum, p) => sum + p.months, 0)) : '—'}
          </p>
          <p className="text-[10.5px] text-text-muted mt-1">общий стаж</p>
        </Card>
        <button
          onClick={() => navigate('/w/reviews')}
          className="flex-1 min-h-[74px] rounded-card bg-surface border border-border-soft p-3 flex flex-col items-center justify-center text-center"
        >
          <p className="text-[16px] font-extrabold truncate max-w-full">{formatRating(profile.rating)}</p>
          <p className="text-[10.5px] text-text-muted mt-1">рейтинг</p>
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
            {profile.hiddenReason ? '' : ' Исправьте анкету и сохраните — мы посмотрим её заново.'}
          </p>
          {profile.hiddenReason && (
            <p className="text-[13px] text-text leading-relaxed mt-2 whitespace-pre-line">{profile.hiddenReason}</p>
          )}
        </div>
      )}

      {/* Not a scolding banner: it's the single change that most affects
          whether this person gets picked, and signup silently copied a
          Telegram picture that may be a car or a landscape. Говорит и о
          последствии тоже — откликаться с чужой картинкой нельзя (см.
          applications.ts), и узнать об этом на свайпе было бы хуже. Gone
          the moment they upload anything of their own. */}
      {profile.avatarIsFromTelegram && !profile.hidden && (
        <button
          onClick={() => navigate('/w/profile/edit')}
          className="mt-4 w-full text-left rounded-2xl bg-accent-soft p-4 flex items-start gap-3"
        >
          <Camera size={18} className="text-accent shrink-0 mt-0.5" />
          <span className="min-w-0">
            <span className="block text-[14px] font-bold">Поставьте своё фото</span>
            <span className="block text-[13px] text-text-muted leading-relaxed mt-0.5">
              Сейчас на анкете фото из Telegram. Работодатель выбирает по лицу, поэтому откликаться на смены можно
              только со своим — обычное селфи, лицо видно.
            </span>
          </span>
        </button>
      )}

      {/* Одной строкой, а не секцией с чипами: это справочный факт об
          анкете, а не то, ради чего человек открыл экран. */}
      <p className="text-[13px] text-text-muted mt-3">
        Ищу: {profile.lookingFor === 'shift' ? 'смены' : profile.lookingFor === 'permanent' ? 'постоянную работу' : 'смены и постоянную работу'}
      </p>

      {profile.bio && (
        <Card className="p-4 mt-4">
          <SectionLabel className="mb-1.5">О себе</SectionLabel>
          <p className="text-[13px] text-text leading-relaxed whitespace-pre-line">{profile.bio}</p>
        </Card>
      )}

      {profile.skills && (
        <Card className="p-4 mt-3">
          <SectionLabel className="mb-1.5">Навыки</SectionLabel>
          <p className="text-[13px] text-text-muted leading-relaxed whitespace-pre-line">{profile.skills}</p>
        </Card>
      )}

      {profile.photos.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2.5">
            <SectionLabel className="mb-0">Фото</SectionLabel>
            <span className="text-[12px] text-text-faint">{profile.photos.length} из 6</span>
          </div>
          <div className="flex gap-2 overflow-x-auto -mx-5 px-5">
            {profile.photos.map((p) => (
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
          <div className="px-3">
            <ListRow
              icon={<Award size={16} />}
              tone="accent"
              label="Достижения"
              value={
                totalCount > 0 ? (
                  <span className="text-[11px] font-bold text-accent bg-accent-soft rounded-full px-2 py-0.5">
                    {earnedCount}/{totalCount}
                  </span>
                ) : undefined
              }
              onClick={() => navigate('/w/achievements')}
            />
          </div>
          <div className="px-3">
            <ListRow icon={<Heart size={16} />} label="Избранное" onClick={() => navigate('/w/favorites')} />
          </div>
          <div className="px-3">
            <ListRow icon={<Settings size={16} />} label="Настройки" onClick={() => navigate('/w/settings')} />
          </div>
        </Card>
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
