import { useNavigate } from 'react-router-dom';
import { Check, Lock, Loader2, Plus } from 'lucide-react';
import { TopBar } from '@/components/ui/TopBar';
import { Button } from '@/components/ui/Button';
import { useDocumentsStore } from '@/store/useDocumentsStore';
import { cn } from '@/lib/cn';

export function Documents() {
  const navigate = useNavigate();
  const { documents, upload } = useDocumentsStore();
  const allVerified = documents.every((d) => d.status === 'verified');

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="Документы" onBack={() => navigate(-1)} />

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        <h1 className="text-[24px] font-extrabold leading-tight mb-2">
          Подтвердите себя — откликов станет больше
        </h1>
        <p className="text-[14px] text-text-muted leading-relaxed mb-6">
          Заведения в 3 раза чаще берут людей с проверенными документами.
        </p>

        <div className="space-y-3">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-card bg-surface border border-border-soft p-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                    doc.status === 'verified' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-text-muted',
                  )}
                >
                  {doc.status === 'verified' && <Check size={16} strokeWidth={3} />}
                  {doc.status === 'pending' && <Loader2 size={16} className="animate-spin" />}
                  {doc.status === 'missing' && <span className="text-[13px] font-bold">?</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[15px]">{doc.label}</p>
                  <p className="text-[12px] text-text-muted">{doc.note}</p>
                </div>
                {doc.status === 'missing' && (
                  <button onClick={() => upload(doc.id)} className="text-accent text-[13px] font-semibold shrink-0">
                    {doc.id === 'passport' ? 'Загрузить' : doc.id === 'medbook' ? 'Загрузить' : 'Добавить'}
                  </button>
                )}
                {doc.status === 'pending' && <span className="text-warning text-[12px] font-semibold shrink-0">Проверка</span>}
              </div>

              {doc.id === 'medbook' && doc.status === 'missing' && (
                <button
                  onClick={() => upload(doc.id)}
                  className="mt-3 w-full h-24 rounded-2xl border border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-text-faint"
                >
                  <Plus size={18} />
                  <span className="text-[12px]">фото разворота</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 mt-5 text-[12px] text-text-faint leading-relaxed">
          <Lock size={14} className="shrink-0 mt-0.5" />
          <p>Документы видит только служба проверки Wolso. Работодателю показывается лишь статус «проверено».</p>
        </div>
      </div>

      <div className="px-5 pb-5 pt-2 shrink-0 space-y-2">
        <Button fullWidth disabled={allVerified}>
          {allVerified ? 'Все документы проверены' : 'Отправить на проверку'}
        </Button>
        {!allVerified && <p className="text-center text-[12px] text-text-faint">Обычно занимает до 2 часов</p>}
      </div>
    </div>
  );
}
