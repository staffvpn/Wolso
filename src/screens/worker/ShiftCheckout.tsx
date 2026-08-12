import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';
import { ReviewForm } from '@/components/ReviewForm';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { resolveCompany } from '@/data/companies';

const TAGS = ['Всё по описанию', 'Хороший менеджер', 'Задержали', 'Нет питания'];

/** Shared by the standalone route (/w/checkout/:id — reachable from a
 *  notification) and PendingReviewGate, which renders this with `gate`
 *  once the employer has closed a shift the worker hasn't reviewed yet.
 *  Mandatory: no skip, submitting is the only way through in gate mode. */
export function ShiftCheckout({ gate = false }: { gate?: boolean }) {
  const navigate = useNavigate();
  const { applicationId: routeApplicationId } = useParams<{ applicationId: string }>();
  const applications = useApplicationsStore((s) => s.applications);
  const load = useApplicationsStore((s) => s.load);
  const submitReview = useApplicationsStore((s) => s.submitReview);

  const application = gate
    ? applications.find((a) => a.workStage === 'employer_closed')
    : applications.find((a) => a.id === routeApplicationId);

  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([TAGS[0]]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!application) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!application) return null;
  if (!application.shift) {
    if (!gate) navigate('/w/shifts', { replace: true });
    return null;
  }
  const shift = application.shift;
  const company = resolveCompany(shift);
  const durationH = shift.endHour - shift.startHour;

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit() {
    if (submitting || !application) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitReview(application.id, rating, tags, comment);
      if (!gate) navigate('/w/shifts', { replace: true });
    } catch {
      setError('Не получилось отправить — попробуйте ещё раз');
      setSubmitting(false);
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
        <TopBar />
      )}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        <div className="rounded-2xl bg-accent-soft text-accent px-4 py-3 flex items-center gap-3 mb-6 mt-2">
          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
            <Check size={16} className="text-accent-fg" strokeWidth={3} />
          </div>
          <div>
            <p className="font-bold text-[15px] text-text">{company.name} закрыл(а) смену</p>
            <p className="text-[12px] text-text-muted">
              {shift.positionLabel} · {String(shift.startHour).padStart(2, '0')}:{String(shift.startMin).padStart(2, '0')}–{String(shift.endHour).padStart(2, '0')}:{String(shift.endMin).padStart(2, '0')} · {durationH} часов
            </p>
          </div>
        </div>

        {gate && (
          <p className="text-[13px] text-text-muted leading-relaxed mb-5 -mt-2">
            Оставьте отзыв о смене — без этого дальше листать нельзя, это займёт минуту.
          </p>
        )}

        <ReviewForm
          question="Как прошла смена?"
          rating={rating}
          onRatingChange={setRating}
          tags={tags}
          tagOptions={TAGS}
          onToggleTag={toggleTag}
          comment={comment}
          onCommentChange={setComment}
          commentPlaceholder="Комментарий для заведения — по желанию"
        />

        {error && <p className="text-danger text-[13px] mt-4 leading-relaxed">{error}</p>}
      </div>

      <div className="px-5 pb-5 pt-2 shrink-0">
        <Button fullWidth disabled={submitting} onClick={submit}>
          {submitting ? 'Отправляем…' : 'Отправить отзыв'}
        </Button>
      </div>
    </div>
  );
}
