import { useState } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { ReviewForm } from './ReviewForm';

const TAGS = ['Пришёл вовремя', 'Хорошо справился', 'Опоздал', 'Ушёл раньше', 'Не справился'];

interface CloseShiftSheetProps {
  open: boolean;
  onClose: () => void;
  workerName: string;
  onSubmit: (rating: number, tags: string[], comment: string) => Promise<void>;
}

/** Closing a shift and reviewing the worker are the same action — there's
 *  no "close without rating them" path, so this is the only way in. */
export function CloseShiftSheet({ open, onClose, workerName, onSubmit }: CloseShiftSheetProps) {
  const [rating, setRating] = useState(5);
  const [tags, setTags] = useState<string[]>([TAGS[0]]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(t: string) {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(rating, tags, comment);
      setRating(5);
      setTags([TAGS[0]]);
      setComment('');
      onClose();
    } catch {
      setError('Не получилось закрыть смену — попробуйте ещё раз');
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
