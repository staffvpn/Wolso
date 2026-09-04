import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Plus, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SafeImage } from '@/components/ui/SafeImage';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { TopBar } from '@/components/ui/TopBar';
import { SectionLabel } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { ExperienceSheet } from '@/components/ExperienceSheet';
import { useProfileStore } from '@/store/useProfileStore';
import { POSITIONS } from '@/data/positions';
import { VISUALLY_HIDDEN_FILE_INPUT } from '@/lib/visuallyHidden';
import { compressImageFile, UnsupportedImageError } from '@/lib/imageCompress';
import { formatExperience } from '@/lib/format';
import type { LookingFor, Position } from '@/types';

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
  const [lookingFor, setLookingFor] = useState<LookingFor>('any');
  const [pickingPosition, setPickingPosition] = useState<Position | null>(null);
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
    setLookingFor(profile.lookingFor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!loaded) return null;

  // 'any' is both toggles on, which is also what an anketa written before
  // this question existed means — see migration 0029.
  const wantsShift = lookingFor === 'any' || lookingFor === 'shift';
  const wantsPermanent = lookingFor === 'any' || lookingFor === 'permanent';

  /** "Looking for nothing" isn't an answer, so tapping the only lit-up
   *  chip does nothing rather than clearing it — and deliberately not
   *  "flip to the other one" either, which would mean tapping «Постоянная
   *  работа» lights up «Смены». */
  function toggleLookingFor(which: 'shift' | 'permanent') {
    const shift = which === 'shift' ? !wantsShift : wantsShift;
    const permanent = which === 'permanent' ? !wantsPermanent : wantsPermanent;
    if (shift && permanent) setLookingFor('any');
    else if (shift) setLookingFor('shift');
    else if (permanent) setLookingFor('permanent');
  }

  const missing: string[] = [];
  if (!name.trim()) missing.push('имя');
  if (!city.trim()) missing.push('город');
  if (!bio.trim()) missing.push('о себе');
  if (!skills.trim()) missing.push('навыки');
  if (!birthdate) missing.push('дата рождения');
  const underage = !!birthdate && !isAtLeast18(birthdate);
  const nameHasDigits = /\d/.test(name);
  // "фото" alone was ambiguous next to the «Дополнительные фото» block —
  // name the field the screen actually labels. Картинка, скопированная из
  // Telegram при регистрации, здесь не считается: она у всех есть, поэтому
  // поле выглядит заполненным и его никто не меняет — а откликнуться с ней
  // всё равно не выйдет (см. applications.ts). Лучше попросить сразу, чем
  // после первого свайпа.
  if (!profile.avatarUrl || profile.avatarIsFromTelegram) missing.push('главное фото');
  if (profile.positions.length === 0) missing.push('опыт работы');

  async function onAvatarChosen(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
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

  async function addExperienceRow(position: Position, months: number) {
    setError(null);
    try {
      await addPosition({ position, positionLabel: POSITIONS.find((p) => p.id === position)!.label, months });
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
    if (nameHasDigits) {
      setError('В имени и фамилии не должно быть цифр');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), city: city.trim(), bio: bio.trim(), skills: skills.trim(), birthdate, lookingFor });
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
          {/* Signup copies whatever picture Telegram had, so everyone
              technically has one — and half of those are a car or a
              landscape. This is the moment to say what the photo is for. */}
          <p className="text-[13px] text-text-muted text-center leading-relaxed max-w-[300px]">
            {profile.avatarIsFromTelegram
              ? 'Сейчас здесь фото из Telegram. Работодатель выбирает человека на смену по лицу — поставьте своё, вас будут звать заметно чаще.'
              : 'Обычное селфи при дневном свете, лицо видно — этого достаточно. Анкеты с фото зовут на смены заметно чаще.'}
          </p>
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
            {nameHasDigits && (
              <p className="text-[12px] text-danger mt-1.5">
                В имени и фамилии не должно быть цифр — телефон и ник сюда писать не нужно
              </p>
            )}
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
            <SectionLabel>
              Опыт работы <span className="text-danger">*</span>
            </SectionLabel>
            <p className="text-[13px] text-text-muted -mt-1 mb-3 leading-relaxed">
              Нажмите на должность, где вы уже работали, — и выберите, сколько. Можно добавить несколько.
            </p>

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

            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => (
                <Chip key={p.id} onClick={() => setPickingPosition(p.id)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Plus size={13} /> {p.label}
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          {/* Deliberately above «О себе» rather than at the end of the form:
              it's a one-tap answer that shapes which employers ever see the
              anketa, and nobody scrolls to the bottom to find it. */}
          <div>
            <SectionLabel>Что вы ищете</SectionLabel>
            <p className="text-[13px] text-text-muted -mt-1 mb-3 leading-relaxed">
              Работодатели видят это в анкете и ищут по этому — выберите одно или оба.
            </p>
            <div className="flex gap-2">
              <Chip selected={wantsShift} onClick={() => toggleLookingFor('shift')} className="flex-1">
                Смены
              </Chip>
              <Chip selected={wantsPermanent} onClick={() => toggleLookingFor('permanent')} className="flex-1">
                Постоянная работа
              </Chip>
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

      <ExperienceSheet
        position={pickingPosition}
        onClose={() => setPickingPosition(null)}
        onPick={(months) => addExperienceRow(pickingPosition!, months)}
      />
    </div>
  );
}
