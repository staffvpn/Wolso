import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Check } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { IconButton } from '@/components/ui/IconButton';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/deck/SwipeDeck';
import { CandidateCard } from '@/components/deck/CandidateCard';
import { useEmployerStore } from '@/store/useEmployerStore';

export function Candidates() {
  const navigate = useNavigate();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const loading = useEmployerStore((s) => s.loading);
  const candidates = useEmployerStore((s) => s.candidates);
  const loadAll = useEmployerStore((s) => s.loadAll);
  const decideCandidate = useEmployerStore((s) => s.decideCandidate);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = useMemo(() => candidates.filter((c) => c.status === 'pending'), [candidates]);
  const current = pending[0];

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-2 safe-top shrink-0">
        <div className="flex items-center gap-2">
          <Logo size={22} className="text-accent" />
          <span className="font-extrabold tracking-tight text-[15px]">WOLSO</span>
        </div>
      </div>

      {pending.length > 0 && (
        <p className="px-5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-text-faint shrink-0">
          {pending.length} {pending.length === 1 ? 'кандидат ждёт' : 'кандидатов ждут'} решения
        </p>
      )}

      <SwipeDeck
        ref={deckRef}
        items={pending}
        keyOf={(c) => c.id}
        loading={loading}
        renderCard={(candidate) => <CandidateCard candidate={candidate} />}
        onSwiped={(candidate, direction) => decideCandidate(candidate.vacancyId, candidate.id, direction === 'right' ? 'accepted' : 'declined')}
        rightLabel="Пригласить на смену"
        leftLabel="Отклонить"
        empty={
          <EmptyState
            title="Пока нет новых кандидатов"
            description="Как только кто-то откликнется на вашу смену — увидите анкету здесь."
            actions={
              <Button fullWidth onClick={() => navigate('/e/vacancies/new')}>
                Опубликовать смену
              </Button>
            }
          />
        }
      />

      {current && (
        <div className="flex items-center justify-center gap-4 px-5 py-4 shrink-0">
          <IconButton size={56} onClick={() => deckRef.current?.swipeLeft()} aria-label="Пропустить">
            <X size={22} className="text-text-muted" />
          </IconButton>
          <Button size="lg" className="flex-1 max-w-[220px]" onClick={() => deckRef.current?.swipeRight()}>
            <Check size={18} /> Взять на смену
          </Button>
        </div>
      )}

      <p className="text-center text-[11px] text-text-faint pb-2 shrink-0">
        свайп вправо — берём · влево — дальше
      </p>
    </div>
  );
}
