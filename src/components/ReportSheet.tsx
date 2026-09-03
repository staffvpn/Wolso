import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { submitComplaint, type ComplaintReason, type ComplaintTarget } from '@/services/complaintsApi';
import { hapticNotify } from '@/lib/telegram';

/** Причины, а не свободный текст первым делом: человек, которому только
 *  что нахамили, редко пишет разбираемое объяснение, а разбирать это
 *  потом кому-то придётся. Комментарий остаётся, но необязателен. */
const REASONS: { id: ComplaintReason; label: string }[] = [
  { id: 'no_show', label: 'Не вышел / не пустили на смену' },
  { id: 'rude', label: 'Хамство, угрозы' },
  { id: 'misleading', label: 'Условия не такие, как в объявлении' },
  { id: 'payment', label: 'Не заплатили' },
  { id: 'fake_profile', label: 'Фальшивая анкета или заведение' },
  { id: 'unsafe', label: 'Небезопасно' },
  { id: 'other', label: 'Другое' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  targetKind: ComplaintTarget;
  targetId: string;
  /** Кого/что показываем в заголовке — «Пожаловаться на Ивана». */
  targetName: string;
  /** Чей токен слать: у работодателя и соискателя они разные. */
  as?: 'worker' | 'company';
}

export function ReportSheet({ open, onClose, targetKind, targetId, targetName, as }: Props) {
  const [reason, setReason] = useState<ComplaintReason | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setReason(null);
      setComment('');
      setError(null);
      setSent(false);
    }
  }, [open]);

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await submitComplaint({ targetKind, targetId, reason, comment: comment.trim(), as });
      hapticNotify('success');
      setSent(true);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      setError(
        code === 'too_many_complaints'
          ? 'Сегодня уже слишком много жалоб с вашего аккаунта. Попробуйте завтра или напишите в поддержку.'
          : code === 'migration_required'
            ? 'Жалобы ещё не включены на сервере. Напишите в поддержку.'
            : 'Не получилось отправить — проверьте связь и попробуйте ещё раз.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      {sent ? (
        <div className="py-4 text-center">
          <h2 className="text-[18px] font-extrabold">Жалоба отправлена</h2>
          <p className="text-[14px] text-text-muted mt-2 leading-relaxed">
            Её посмотрит команда Wolso. Если понадобится, с вами свяжутся в поддержке.
          </p>
          <Button fullWidth className="mt-5" onClick={onClose}>
            Понятно
          </Button>
        </div>
      ) : (
        <>
          <h2 className="text-[18px] font-extrabold leading-tight">Пожаловаться</h2>
          <p className="text-[14px] text-text-muted mt-1">{targetName}</p>

          <div className="flex flex-col gap-2 mt-4">
            {REASONS.map((r) => (
              <button
                key={r.id}
                onClick={() => setReason(r.id)}
                className={
                  reason === r.id
                    ? 'h-12 px-4 rounded-2xl bg-accent text-accent-fg text-[15px] font-semibold text-left'
                    : 'h-12 px-4 rounded-2xl bg-surface border border-border text-[15px] text-left active:bg-surface-hover'
                }
              >
                {r.label}
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Что произошло? Необязательно, но помогает разобраться"
            className="w-full mt-4 rounded-2xl bg-surface border border-border p-3.5 text-[14px] outline-none focus:border-accent placeholder:text-text-faint resize-none"
          />

          {error && <p className="text-[13px] text-danger mt-2 leading-relaxed">{error}</p>}

          <div className="flex gap-2 mt-4">
            <Chip className="flex-1" onClick={onClose}>
              Отмена
            </Chip>
            <Button className="flex-1" disabled={!reason || busy} onClick={submit}>
              {busy ? 'Отправляем…' : 'Отправить'}
            </Button>
          </div>
        </>
      )}
    </BottomSheet>
  );
}
