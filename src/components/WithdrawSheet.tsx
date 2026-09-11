import { useState } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { ApiError } from '@/lib/apiClient';

const ERROR_MESSAGES: Record<string, string> = {
  not_pending: 'Работодатель уже ответил на этот отклик — отозвать не получится.',
  not_found: 'Отклик не найден — обновите экран.',
};

interface WithdrawSheetProps {
  open: boolean;
  onClose: () => void;
  /** Что именно отзывают — чтобы в подтверждении была видна смена. */
  shiftTitle: string;
  onSubmit: () => Promise<void>;
}

/** Подтверждение отзыва ещё не рассмотренного отклика.
 *
 *  Отдельный лист, а не CancelSheet: тот требует причину, и по делу —
 *  там человек уходит со смены, на которую работодатель рассчитывает.
 *  Здесь работодатель ещё ничего не решил, спрашивать не за что, так что
 *  остаётся один вопрос и одна кнопка.
 *
 *  Подтверждение всё же нужно: кнопка стоит в списке рядом с остальными,
 *  и промах пальцем не должен молча снимать отклик. */
export function WithdrawSheet({ open, onClose, shiftTitle, onSubmit }: WithdrawSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit();
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
      <h2 className="text-[19px] font-bold mb-1">Отозвать отклик?</h2>
      <p className="text-[13px] text-text-muted mb-5 leading-relaxed">
        «{shiftTitle}» — вы пропадёте из списка кандидатов. Если передумаете, на эту смену можно откликнуться снова,
        пока она не занята.
      </p>

      {error && <p className="text-danger text-[13px] mb-3 leading-relaxed">{error}</p>}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={submitting} onClick={onClose}>
          Оставить
        </Button>
        <Button variant="dark" className="flex-1" disabled={submitting} onClick={submit}>
          {submitting ? 'Отзываем…' : 'Отозвать'}
        </Button>
      </div>
    </BottomSheet>
  );
}
