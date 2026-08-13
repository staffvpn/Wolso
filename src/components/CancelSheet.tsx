import { useState } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { ApiError } from '@/lib/apiClient';

const ERROR_MESSAGES: Record<string, string> = {
  reason_required: 'Укажите причину.',
  not_cancellable: 'Эту заявку уже нельзя отменить.',
  not_accepted: 'Эту заявку уже нельзя отменить.',
  already_started: 'Смена уже началась — отменить нельзя.',
};

interface CancelSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Label on the submit button — defaults to a generic "Отменить". */
  confirmLabel?: string;
  onSubmit: (reason: string) => Promise<void>;
}

/** Shared by both sides of a cancellation — an employer withdrawing an
 *  invitation/hire, or a worker backing out of a shift they'd confirmed.
 *  A reason is always mandatory: whoever's on the other end just lost a
 *  chat and a plan for their day, they get to know why. */
export function CancelSheet({ open, onClose, title, description, confirmLabel = 'Отменить', onSubmit }: CancelSheetProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (submitting) return;
    if (!reason.trim()) {
      setError(ERROR_MESSAGES.reason_required);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason('');
      onClose();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError((code && ERROR_MESSAGES[code]) ?? 'Не получилось — попробуйте ещё раз');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="text-[19px] font-bold mb-1">{title}</h2>
      <p className="text-[13px] text-text-muted mb-5 leading-relaxed">{description}</p>

      <p className="text-[12px] font-semibold uppercase tracking-wide text-text-faint mb-1.5">Причина — обязательно</p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Например: заболел, не получается по времени…"
        rows={3}
        className="w-full rounded-2xl bg-surface border border-border px-4 py-3 text-[14px] outline-none focus:border-accent placeholder:text-text-faint resize-none"
      />

      {error && <p className="text-danger text-[13px] mt-3 leading-relaxed">{error}</p>}

      <div className="pt-6">
        <Button fullWidth variant="dark" disabled={submitting} onClick={submit}>
          {submitting ? 'Отменяем…' : confirmLabel}
        </Button>
      </div>
    </BottomSheet>
  );
}
