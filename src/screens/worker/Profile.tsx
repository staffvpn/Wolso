import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { Card, SectionLabel } from '@/components/ui/Card';
import { ListRow } from '@/components/ui/ListRow';
import { useProfileStore } from '@/store/useProfileStore';
import { FEATURES } from '@/lib/features';

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
          <div className="flex items-center gap-1 mt-1">
            <span className="text-accent text-[13px] font-bold">★ {profile.rating.toFixed(1)}</span>
            <span className="text-text-faint text-[13px]">· {profile.shiftsCompleted} смен</span>
          </div>
        </div>
        <button
          onClick={() => navigate('/w/profile/edit')}
          aria-label="Редактировать профиль"
          className="h-9 w-9 rounded-full bg-surface-2 flex items-center justify-center shrink-0"
        >
          <Pencil size={15} className="text-text-muted" />
        </button>
      </div>

      {profile.bio && <p className="text-[14px] text-text leading-relaxed mt-4">{profile.bio}</p>}

      {profile.skills && (
        <div className="mt-3">
          <SectionLabel>Навыки</SectionLabel>
          <p className="text-[13px] text-text-muted leading-relaxed">{profile.skills}</p>
        </div>
      )}

      {profile.photos.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto -mx-5 px-5">
          {profile.photos.map((p) => (
            <img key={p.id} src={p.url} alt="" className="h-24 w-24 rounded-2xl object-cover shrink-0" />
          ))}
        </div>
      )}

      <div className="mt-6">
        <SectionLabel>Должности</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {positions.map((p) => (
            <Chip key={p.position} tone="dark" selected>
              {p.positionLabel} · {p.years} {p.years === 1 ? 'год' : 'года'}
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
