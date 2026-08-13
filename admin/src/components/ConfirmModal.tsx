import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ApiError } from '@/lib/apiClient';

interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  /** If set, the confirm button stays disabled until the admin types this
   *  exact word — reserved for the genuinely irreversible actions (wiping
   *  every user, every vacancy). Lighter clears (notifications, audit log)
   *  skip this and just need the one click. */
  typeToConfirm?: string;
  onConfirm: () => Promise<void>;
}

export function ConfirmModal({ open, onClose, title, description, confirmLabel = 'Удалить', typeToConfirm, onConfirm }: ConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = !!typeToConfirm && typed.trim() !== typeToConfirm;

  async function handleConfirm() {
    if (locked || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setTyped('');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? 'Не получилось выполнить действие — попробуйте ещё раз.' : 'Что-то пошло не так.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        setTyped('');
        setError(null);
        onClose();
      }}
      title={title}
      description={description}
    >
      {typeToConfirm && (
        <div className="mb-4">
          <p className="text-[13px] text-text-muted mb-2">
            Введите <span className="font-mono font-bold text-text">{typeToConfirm}</span>, чтобы подтвердить.
          </p>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={typeToConfirm} autoFocus />
        </div>
      )}
      {error && <p className="text-[12px] text-danger mb-3 leading-relaxed">{error}</p>}
      <div className="flex items-center gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
          Отмена
        </Button>
        <Button variant="danger" className="flex-1" onClick={handleConfirm} disabled={locked || busy}>
          {busy ? 'Выполняем…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
