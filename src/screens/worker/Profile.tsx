import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/ui/Avatar';
import { Chip } from '@/components/ui/Chip';
import { Card, SectionLabel } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ListRow } from '@/components/ui/ListRow';
import { WORKER_PROFILE } from '@/data/profile';
import { useDocumentsStore } from '@/store/useDocumentsStore';
import { useWalletStore } from '@/store/useWalletStore';
import { formatMoney } from '@/lib/format';

export function WorkerProfileScreen() {
  const navigate = useNavigate();
  const documents = useDocumentsStore((s) => s.documents);
  const available = useWalletStore((s) => s.available);
  const verifiedCount = documents.filter((d) => d.status === 'verified').length;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto px-5 pt-5 safe-top pb-4">
      <div className="flex items-center gap-4">
        <Avatar name={WORKER_PROFILE.name} size={64} />
        <div className="min-w-0">
          <h1 className="text-[20px] font-extrabold truncate">{WORKER_PROFILE.name}</h1>
          <p className="text-[13px] text-text-muted">{WORKER_PROFILE.positions[0]?.positionLabel} · {WORKER_PROFILE.city}</p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-accent text-[13px] font-bold">★ {WORKER_PROFILE.rating}</span>
            <span className="text-text-faint text-[13px]">· {WORKER_PROFILE.shiftsCompleted} смен</span>
          </div>
        </div>
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate('/w/documents')}
        className="w-full text-left mt-5"
      >
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center shrink-0">
              <Check size={11} className="text-accent-fg" strokeWidth={3} />
            </div>
            <span className="font-semibold text-[14px]">Профиль заполнен на {WORKER_PROFILE.profileCompletion}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mb-2">
            <div className="h-full rounded-full bg-accent" style={{ width: `${WORKER_PROFILE.profileCompletion}%` }} />
          </div>
          <p className="text-[12px] text-text-muted">Добавьте медкнижку — откликов станет больше</p>
        </Card>
      </motion.button>

      <div className="mt-6">
        <SectionLabel>Должности</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {WORKER_PROFILE.positions.map((p) => (
            <Chip key={p.position} tone="dark" selected>
              {p.positionLabel} · {p.years} {p.years === 1 ? 'год' : 'года'}
            </Chip>
          ))}
          <button className="h-10 w-10 rounded-full border border-dashed border-border flex items-center justify-center text-text-faint">
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-2.5">
          <SectionLabel className="mb-0">Документы</SectionLabel>
          <button onClick={() => navigate('/w/documents')} className="text-[12px] font-semibold text-accent">
            {verifiedCount}/{documents.length}
          </button>
        </div>
        <button onClick={() => navigate('/w/documents')} className="w-full">
          <Card className="divide-y divide-border-soft">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-[14px] font-medium">{doc.label}</span>
                {doc.status === 'verified' ? (
                  <Badge tone="accent">Проверен</Badge>
                ) : (
                  <span className="flex items-center gap-1 text-[13px] text-accent font-semibold">
                    Добавить <ChevronRight size={14} />
                  </span>
                )}
              </div>
            ))}
          </Card>
        </button>
      </div>

      {WORKER_PROFILE.reviews.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Отзывы заведений</SectionLabel>
          <div className="space-y-2.5">
            {WORKER_PROFILE.reviews.map((r, i) => (
              <div key={i} className="flex items-start justify-between gap-3 rounded-card bg-surface border border-border-soft p-4">
                <p className="text-[13px] text-text-muted leading-relaxed">{r.text}</p>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-[13px]">{r.companyName}</p>
                  <p className="text-accent text-[12px] font-bold">★ {r.rating.toFixed(1)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <Card className="divide-y divide-border-soft px-1">
          <div className="px-3">
            <ListRow label="Кошелёк" value={formatMoney(available)} onClick={() => navigate('/w/wallet')} />
          </div>
          <div className="px-3">
            <ListRow label="Избранное" onClick={() => navigate('/w/favorites')} />
          </div>
          <div className="px-3">
            <ListRow label="Настройки" onClick={() => navigate('/w/settings')} />
          </div>
        </Card>
      </div>
    </div>
  );
}
