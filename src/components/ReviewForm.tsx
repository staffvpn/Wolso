import { StarRating } from './ui/StarRating';
import { Chip } from './ui/Chip';

interface ReviewFormProps {
  rating: number;
  onRatingChange: (v: number) => void;
  tags: string[];
  tagOptions: string[];
  onToggleTag: (tag: string) => void;
  comment: string;
  onCommentChange: (v: string) => void;
  commentPlaceholder: string;
  question: string;
}

/** The rating + tags + comment trio, shared by the worker's review of the
 *  employer (ShiftCheckout) and the employer's review of the worker
 *  (CloseShiftSheet) — same shape, different question/tag options. */
export function ReviewForm({
  rating,
  onRatingChange,
  tags,
  tagOptions,
  onToggleTag,
  comment,
  onCommentChange,
  commentPlaceholder,
  question,
}: ReviewFormProps) {
  return (
    <div>
      <p className="font-bold text-[16px] mb-3">{question}</p>
      <StarRating value={rating} onChange={onRatingChange} />

      <div className="flex flex-wrap gap-2 mt-4">
        {tagOptions.map((t) => (
          <Chip key={t} selected={tags.includes(t)} onClick={() => onToggleTag(t)}>
            {t}
          </Chip>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder={commentPlaceholder}
        rows={3}
        className="w-full mt-4 rounded-2xl bg-surface border border-border p-3.5 text-[14px] text-text placeholder:text-text-faint resize-none outline-none focus:border-accent"
      />
    </div>
  );
}
