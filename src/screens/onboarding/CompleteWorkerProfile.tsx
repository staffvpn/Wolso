import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Plus, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SafeImage } from '@/components/ui/SafeImage';
import { Button } from '@/components/ui/Button';
import { TopBar } from '@/components/ui/TopBar';
import { SectionLabel } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { useProfileStore } from '@/store/useProfileStore';
import { POSITIONS } from '@/data/positions';
import { VISUALLY_HIDDEN_FILE_INPUT } from '@/lib/visuallyHidden';
import { compressImageFile, UnsupportedImageError } from '@/lib/imageCompress';
import { formatExperience } from '@/lib/format';
import type { Position } from '@/types';

const FIELD_CLASS =
  'w-full rounded-2xl bg-surface border border-border p-3.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent';

// Wolso is 18+ — nobody younger can pick a birthdate at all, in the
// picker or by typing one in.
function maxBirthdate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

function isAtLeast18(birthdate: string) {
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  return age >= 18;
}

/** Shared by both the forced onboarding gate (no back button, no header
 *  chrome) and the normal "edit profile" route (/w/profile/edit). */
export function CompleteWorkerProfile({ gate = false }: { gate?: boolean }) {
  const navigate = useNavigate();
  const profile = useProfileStore();
  const { load, loaded, updateProfile, addPosition, deletePosition, uploadAvatar, uploadPhoto, deletePhoto } = profile;

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [newPosition, setNewPosition] = useState<Position>('barista');
  const [newAmount, setNewAmount] = useState('');
  const [newUnit, setNewUnit] = useState<'months' | 'years'>('years');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!loaded) return;
    setName(profile.name);
    setCity(profile.city);
    setBio(profile.bio);
    setSkills(profile.skills);
    setBirthdate(profile.birthdate ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!loaded) return null;

  const missing: string[] = [];
  if (!name.trim()) missing.push('имя');
  if (!city.trim()) missing.push('город');
  if (!bio.trim()) missing.push('о себе');
  if (!skills.trim()) missing.push('навыки');
  if (!birthdate) missing.push('дата рождения');
  const underage = !!birthdate && !isAtLeast18(birthdate);
  if (!profile.avatarUrl) missing.push('фото');
  if (profile.positions.length === 0) missing.push('опыт работы');

  async function onAvatarChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await uploadAvatar(await compressImageFile(file));
    } catch (err) {
      setError(err instanceof UnsupportedImageError ? err.message : 'Не получилось загрузить фото — попробуйте другое или ещё раз');
    }
  }

  async function onPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await uploadPhoto(await compressImageFile(file));
    } catch (err) {
      setError(err instanceof UnsupportedImageError ? err.message : 'Не получилось загрузить фото — попробуйте другое или ещё раз');
    }
  }

  async function addExperienceRow() {
    const amount = Number(newAmount);
    if (!amount || amount <= 0) {
      setError('Укажите, сколько месяцев или лет опыта');
      return;
    }
    const months = newUnit === 'years' ? Math.round(amount * 12) : Math.round(amount);
    try {
      await addPosition({ position: newPosition, positionLabel: POSITIONS.find((p) => p.id === newPosition)!.label, months });
      setNewAmount('');
    } catch {
      setError('Не получилось добавить опыт — попробуйте ещё раз');
    }
  }

  async function removeExperienceRow(id: string) {
    try {
      await deletePosition(id);
    } catch {
      setError('Не получилось удалить опыт — попробуйте ещё раз');
    }
  }

  async function save() {
    setError(null);
    if (missing.length > 0) {
      setError(`Заполните: ${missing.join(', ')}`);
      return;
    }
    if (underage) {
      setError('Wolso доступен только совершеннолетним — с 18 лет');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), city: city.trim(), bio: bio.trim(), skills: skills.trim(), birthdate });
      if (!gate) navigate(-1);
    } catch {
      setError('Не получилось сохранить — попробуйте ещё раз');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {gate ? (
        <div className="flex items-center gap-2 px-5 pt-5 pb-1 safe-top shrink-0">
          <Logo size={20} className="text-accent" />
          <span className="font-extrabold tracking-tight text-[14px]">WOLSO</span>
        </div>
      ) : (
        <TopBar title="Мой профиль" onBack={() => navigate(-1)} />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        {gate && (
          <div className="mt-2 mb-5">
            <h1 className="text-[22px] font-extrabold leading-tight">Заполните профиль</h1>
            <p className="text-[14px] text-text-muted mt-1 leading-relaxed">
              Работодатели видят эту анкету, когда решают, брать ли вас на смену — без неё увидеть отклики нельзя.
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 mb-6">
          <input ref={avatarInputRef} type="file" accept="image/*" style={VISUALLY_HIDDEN_FILE_INPUT} onChange={onAvatarChosen} />
          <button onClick={() => avatarInputRef.current?.click()} className="relative">
            <Avatar name={name || '?'} src={profile.avatarUrl} size={88} />
            <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-accent-fg flex items-center justify-center border-2 border-bg">
              <Camera size={13} />
            </span>
          </button>
          <p className="text-[12px] text-text-faint">Главное фото</p>
        </div>

        <div className="space-y-4">
          <div>
            <SectionLabel>
              Имя и фамилия <span className="text-danger">*</span>
            </SectionLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              className={FIELD_CLASS}
              required
            />
          </div>

          <div>
            <SectionLabel>Город</SectionLabel>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" className={FIELD_CLASS} />
          </div>

          <div>
            <SectionLabel>Дата рождения</SectionLabel>
            <input
              type="date"
              value={birthdate}
              max={maxBirthdate()}
              onChange={(e) => setBirthdate(e.target.value)}
              className={FIELD_CLASS}
            />
            {underage ? (
              <p className="text-[12px] text-danger mt-1.5">Wolso доступен только совершеннолетним — с 18 лет</p>
            ) : (
              <p className="text-[12px] text-text-faint mt-1.5">Работодателям виден только возраст, не дата</p>
            )}
          </div>

          <div>
            <SectionLabel>О себе</SectionLabel>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Пара предложений о себе — опыт, чем нравится заниматься"
              rows={3}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          <div>
            <SectionLabel>Навыки</SectionLabel>
            <textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              placeholder="Например: латте-арт, кассовая дисциплина, работа в высокий сезон"
              rows={2}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          <div>
            <SectionLabel>Опыт работы</SectionLabel>
            {profile.positions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {profile.positions.map((p) => (
                  <div
                    key={p.id}
                    className="h-10 pl-4 pr-2 rounded-full bg-text text-bg text-[14px] font-medium flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>
                      {p.positionLabel} · {formatExperience(p.months)}
                    </span>
                    <button
                      onClick={() => removeExperienceRow(p.id)}
                      className="h-6 w-6 rounded-full bg-white/15 flex items-center justify-center shrink-0"
                      aria-label="Удалить опыт"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <select
              value={newPosition}
              onChange={(e) => setNewPosition(e.target.value as Position)}
              className="w-full h-11 rounded-2xl bg-surface border border-border px-3 text-[14px] outline-none focus:border-accent"
            >
              {POSITIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="Сколько?"
                className="flex-1 h-11 rounded-2xl bg-surface border border-border px-3.5 text-[14px] outline-none focus:border-accent placeholder:text-text-faint"
              />
              <select
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value as typeof newUnit)}
                className="h-11 rounded-2xl bg-surface border border-border px-3 text-[14px] outline-none focus:border-accent"
              >
                <option value="months">мес.</option>
                <option value="years">лет</option>
              </select>
              <button onClick={addExperienceRow} className="h-11 w-11 rounded-2xl bg-accent-soft text-accent flex items-center justify-center shrink-0">
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <SectionLabel className="mb-0">Портфолио</SectionLabel>
              <span className="text-[12px] text-text-faint">{profile.photos.length}/6 · необязательно</span>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" style={VISUALLY_HIDDEN_FILE_INPUT} onChange={onPhotoChosen} />
            <div className="flex flex-wrap gap-2.5">
              {profile.photos.map((p) => (
                <div key={p.id} className="relative h-20 w-20 rounded-2xl overflow-hidden shrink-0">
                  <SafeImage src={p.url} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => deletePhoto(p.id)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                    aria-label="Удалить фото"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
              {profile.photos.length < 6 && (
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="h-20 w-20 rounded-2xl border border-dashed border-border flex items-center justify-center text-text-faint shrink-0"
                >
                  <Plus size={18} />
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <p className="text-danger text-[13px] mt-4 leading-relaxed">{error}</p>}
      </div>

      <div className="px-5 pb-5 pt-2 shrink-0">
        <Button fullWidth disabled={saving} onClick={save}>
          {saving ? 'Сохраняем…' : gate ? 'Готово' : 'Сохранить'}
        </Button>
      </div>
    </div>
  );
}
