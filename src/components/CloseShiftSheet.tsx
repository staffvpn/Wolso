import { useState } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { ReviewForm } from './ReviewForm';
import { ApiError } from '@/lib/apiClient';

const TAGS = ['Пришёл вовремя', 'Хорошо справился', 'Опоздал', 'Ушёл раньше', 'Не справился'];

const ERROR_MESSAGES: Record<string, string> = {
  too_early: 'Эту смену ещё нельзя закрыть — последний её день ещё не прошёл.',
  not_accepted: 'Сотрудник ещё не подтвердил смену — закрыть можно только подтверждённую.',
  already_closed: 'Смена уже закрыта.',
  rating_required: 'Поставьте оценку от 1 до 5.',
  shift_not_found: 'Смена не найдена — возможно, её удалили.',
  application_not_found: 'Отклик не найден — возможно, сотрудник отменил участие.',
  auth_required: 'Сессия истекла — закройте и откройте приложение заново.',
};

interface CloseShiftSheetProps {
  open: boolean;
  onClose: () => void;
  workerName: string;
  onSubmit: (rating: number, tags: string[], comment: string) => Promise<void>;
}

/** Closing a shift and reviewing the worker are the same action — there's
 *  no "close without rating them" path, so this is the only way in. */
export function CloseShiftSheet({ open, onClose, workerName, onSubmit }: CloseShiftSheetProps) {
  // Starts unrated (0 stars) rather than pre-filled with a 5 nobody chose —
  // the server rejects anything below 1 anyway, so this makes the employer
  // actually pick instead of silently submitting a default perfect score.
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit() {
    if (submitting) return;
    if (rating < 1) {
      setError('Поставьте оценку — без неё смену закрыть нельзя');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(rating, tags, comment);
      setRating(0);
      setTags([]);
      setComment('');
      onClose();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      const status = err instanceof ApiError ? err.status : undefined;
      // Falling back to a bare "попробуйте ещё раз" hid *why* it failed and
      // made the same error look identical every time — show the server's
      // own code/status when it isn't one we have wording for, so a real
      // failure can actually be reported and diagnosed.
      setError(
        (code && ERROR_MESSAGES[code]) ??
          `Не получилось закрыть смену${code || status ? ` (${[code, status && `код ${status}`].filter(Boolean).join(', ')})` : ''} — попробуйте ещё раз`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="text-[19px] font-bold mb-1">Закрыть смену</h2>
      <p className="text-[13px] text-text-muted mb-5 leading-relaxed">
        Смена закроется, а {workerName} получит уведомление и сможет оставить отзыв о вас.
      </p>

      <ReviewForm
        question={`Как ${workerName} справился(ась)?`}
        rating={rating}
        onRatingChange={setRating}
        tags={tags}
        tagOptions={TAGS}
        onToggleTag={toggleTag}
        comment={comment}
        onCommentChange={setComment}
        commentPlaceholder="Комментарий — по желанию"
      />

      {error && <p className="text-danger text-[13px] mt-4 leading-relaxed">{error}</p>}

      <div className="pt-6">
        <Button fullWidth disabled={submitting} onClick={submit}>
          {submitting ? 'Закрываем…' : 'Закрыть смену'}
        </Button>
      </div>
    </BottomSheet>
  );
}
