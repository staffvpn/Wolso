import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { resolveCompany } from '@/data/companies';

const TAGS = ['Всё по описанию', 'Хороший менеджер', 'Задержали', 'Нет питания'];

export function ShiftCheckout() {
  const navigate = useNavigate();
  const { applicationId } = useParams<{ applicationId: string }>();
  const application = useApplicationsStore((s) => s.applications.find((a) => a.id === applicationId));
  const load = useApplicationsStore((s) => s.load);
  const submitReview = useApplicationsStore((s) => s.submitReview);

  const [rating, setRating] = useState(4);
  const [tags, setTags] = useState<string[]>([TAGS[0]]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!application) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!application) return null;
  if (!application.shift) {
    navigate('/w/shifts', { replace: true });
    return null;
  }
  const shift = application.shift;
  const company = resolveCompany(shift);
  const durationH = shift.endHour - shift.startHour;

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  function finish(withReview: boolean) {
    if (submitted || !application) return;
    setSubmitted(true);
    if (withReview) submitReview(application.id, rating, tags, comment);
    else useApplicationsStore.getState().skipReview(application.id);
    navigate('/w/shifts', { replace: true });
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar />
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        <div className="rounded-2xl bg-accent-soft text-accent px-4 py-3 flex items-center gap-3 mb-6">
          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
            <Check size={16} className="text-accent-fg" strokeWidth={3} />
          </div>
          <div>
            <p className="font-bold text-[15px] text-text">Смена закрыта</p>
            <p className="text-[12px] text-text-muted">
              {company.name} · {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')}–{String(shift.endHour).padStart(2, '0')}:{String(shift.endMin).padStart(2, '0')} · {durationH} часов
            </p>
          </div>
        </div>

        <p className="font-bold text-[16px] mb-3">Как прошла смена?</p>
        <StarRating value={rating} onChange={setRating} />

        <div className="flex flex-wrap gap-2 mt-4">
          {TAGS.map((t) => (
            <Chip key={t} selected={tags.includes(t)} onClick={() => toggleTag(t)}>
              {t}
            </Chip>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Комментарий для заведения — по желанию"
          rows={3}
          className="w-full mt-4 rounded-2xl bg-surface border border-border p-3.5 text-[14px] text-text placeholder:text-text-faint resize-none outline-none focus:border-accent"
        />
      </div>

      <div className="px-5 pb-5 pt-2 shrink-0 space-y-2">
        <Button fullWidth disabled={submitted} onClick={() => finish(true)}>
          Отправить отзыв
        </Button>
        <button
          disabled={submitted}
          onClick={() => finish(false)}
          className="w-full text-center text-[13px] text-text-faint py-1 disabled:opacity-40"
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}
