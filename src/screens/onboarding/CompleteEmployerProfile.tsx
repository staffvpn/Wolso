import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Plus, X } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { SafeImage } from '@/components/ui/SafeImage';
import { Button } from '@/components/ui/Button';
import { TopBar } from '@/components/ui/TopBar';
import { SectionLabel } from '@/components/ui/Card';
import { Logo } from '@/components/ui/Logo';
import { useCompanyStore } from '@/store/useCompanyStore';
import { VISUALLY_HIDDEN_FILE_INPUT } from '@/lib/visuallyHidden';
import { compressImageFile, UnsupportedImageError } from '@/lib/imageCompress';

const FIELD_CLASS =
  'w-full rounded-2xl bg-surface border border-border p-3.5 text-[14px] text-text placeholder:text-text-faint outline-none focus:border-accent';

/** Shared by both the forced onboarding gate (no back button) and the
 *  normal "edit profile" route (/e/profile/edit). */
export function CompleteEmployerProfile({ gate = false }: { gate?: boolean }) {
  const navigate = useNavigate();
  const company = useCompanyStore((s) => s.company);
  const loaded = useCompanyStore((s) => s.loaded);
  const load = useCompanyStore((s) => s.load);
  const updateCompany = useCompanyStore((s) => s.updateCompany);
  const uploadAvatar = useCompanyStore((s) => s.uploadAvatar);
  const uploadPhoto = useCompanyStore((s) => s.uploadPhoto);
  const deletePhoto = useCompanyStore((s) => s.deletePhoto);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [foundedYear, setFoundedYear] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loaded) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setAddress(company.address ?? '');
    setDescription(company.description ?? '');
    setFoundedYear(company.foundedYear ? String(company.foundedYear) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  if (!company) return null;

  const missing: string[] = [];
  if (!name.trim()) missing.push('название');
  if (!description.trim()) missing.push('описание');
  if (!foundedYear) missing.push('год основания');
  if (!company.avatarUrl) missing.push('фото');

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

  async function save() {
    setError(null);
    if (missing.length > 0) {
      setError(`Заполните: ${missing.join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      await updateCompany({ name: name.trim(), address: address.trim(), city: city.trim(), description: description.trim(), foundedYear: Number(foundedYear) });
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
        <TopBar title="Профиль заведения" onBack={() => navigate(-1)} />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        {gate && (
          <div className="mt-2 mb-5">
            <h1 className="text-[22px] font-extrabold leading-tight">Расскажите о заведении</h1>
            <p className="text-[14px] text-text-muted mt-1 leading-relaxed">
              Соискатели видят это в карточке смены.
            </p>
          </div>
        )}

        <div className="flex flex-col items-center gap-2 mb-6">
          <input ref={avatarInputRef} type="file" accept="image/*" style={VISUALLY_HIDDEN_FILE_INPUT} onChange={onAvatarChosen} />
          <button onClick={() => avatarInputRef.current?.click()} className="relative">
            <Avatar name={name || '?'} src={company.avatarUrl} size={88} />
            <span className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-accent text-accent-fg flex items-center justify-center border-2 border-bg">
              <Camera size={13} />
            </span>
          </button>
          <p className="text-[12px] text-text-faint">Главное фото</p>
        </div>

        <div className="space-y-4">
          <div>
            <SectionLabel>Название заведения</SectionLabel>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="«Кофе и Точка»" className={FIELD_CLASS} />
          </div>

          <div>
            <SectionLabel>Год основания</SectionLabel>
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={foundedYear}
              onChange={(e) => setFoundedYear(e.target.value)}
              placeholder="2019"
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <SectionLabel>Город</SectionLabel>
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Москва" className={FIELD_CLASS} />
          </div>

          <div>
            <SectionLabel>Адрес</SectionLabel>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Улица, дом" className={FIELD_CLASS} />
          </div>

          <div>
            <SectionLabel>Описание</SectionLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Чем занимаетесь, какая атмосфера, что важно знать сотруднику"
              rows={4}
              className={`${FIELD_CLASS} resize-none`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2.5">
              <SectionLabel className="mb-0">Дополнительные фото</SectionLabel>
              <span className="text-[12px] text-text-faint">{(company.photos ?? []).length}/6 · необязательно</span>
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" style={VISUALLY_HIDDEN_FILE_INPUT} onChange={onPhotoChosen} />
            <div className="flex flex-wrap gap-2.5">
              {(company.photos ?? []).map((p) => (
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
              {(company.photos ?? []).length < 6 && (
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
