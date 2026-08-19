import { useState } from 'react';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { ApiError } from '@/lib/apiClient';

const ERROR_MESSAGES: Record<string, string> = {
  not_found: 'Вакансия не найдена — возможно, её уже удалили.',
  auth_required: 'Сессия истекла — закройте и откройте приложение заново.',
};

interface DeleteVacancySheetProps {
  open: boolean;
  onClose: () => void;
  positionLabel: string;
  /** How many people are currently invited or confirmed on this shift —
   *  they all get a bot notification when it goes, so the employer should
   *  see the number before confirming rather than after. */
  engagedCount: number;
  onConfirm: () => Promise<void>;
}

export function DeleteVacancySheet({ open, onClose, positionLabel, engagedCount, onConfirm }: DeleteVacancySheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError((code && ERROR_MESSAGES[code]) ?? 'Не получилось удалить — попробуйте ещё раз');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <h2 className="text-[19px] font-bold mb-1">Удалить вакансию?</h2>
      <p className="text-[13px] text-text-muted mb-5 leading-relaxed">
        «{positionLabel}» и все отклики на неё удалятся навсегда — восстановить не получится.
        {engagedCount > 0 && ` ${engagedCount} чел. уже приглашены или подтвердили смену — им придёт уведомление.`}
      </p>

      {error && <p className="text-danger text-[13px] mb-4 leading-relaxed">{error}</p>}

      <div className="flex gap-2">
        <Button variant="dark" className="flex-1" disabled={submitting} onClick={onClose}>
          Отмена
        </Button>
        <Button variant="danger" className="flex-1" disabled={submitting} onClick={submit}>
          {submitting ? 'Удаляем…' : 'Удалить'}
        </Button>
      </div>
    </BottomSheet>
  );
}
