import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, X, SlidersHorizontal, Search } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { IconButton } from '@/components/ui/IconButton';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/deck/SwipeDeck';
import { CandidateCard } from '@/components/deck/CandidateCard';
import { VacancyPickSheet } from '@/components/VacancyPickSheet';
import { useWorkerBrowseStore } from '@/store/useWorkerBrowseStore';
import { useEmployerStore } from '@/store/useEmployerStore';

/** The mirror image of the worker's swipe feed — an employer browsing
 *  worker anketas directly instead of waiting for applications. Every
 *  invite here goes straight onto one of the employer's own open shifts
 *  (picked below), so this only ever works once they actually have one —
 *  same "приглашение → чат → подтвердить/отклонить" flow as accepting
 *  someone who applied, just started from this side instead. */
export function FindWorkers() {
  const navigate = useNavigate();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const vacancies = useEmployerStore((s) => s.vacancies);
  const loadVacancies = useEmployerStore((s) => s.loadAll);
  const activeVacancies = useMemo(() => vacancies.filter((v) => v.status === 'active'), [vacancies]);

  const { shiftId, deck, index, loading, loaded, setVacancy, loadDeck, pass, invite } = useWorkerBrowseStore();
  const selectedVacancy = activeVacancies.find((v) => v.id === shiftId) ?? null;

  useEffect(() => {
    if (vacancies.length === 0) loadVacancies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nothing picked yet — default to the first active vacancy once they're
  // in; most employers only ever have one open shift at a time.
  useEffect(() => {
    if (!shiftId && activeVacancies.length > 0) setVacancy(activeVacancies[0].id, activeVacancies[0].position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVacancies]);

  useEffect(() => {
    if (shiftId && !loaded) loadDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  const remaining = deck.slice(index);
  const current = remaining[0];

  // Single path for both an actual drag-swipe-right and tapping the button
  // below — the button just triggers the same fling animation, so this is
  // the only place the resulting action lives.
  async function handleSwiped(direction: 'left' | 'right') {
    if (direction === 'left') {
      pass();
      return;
    }
    const chatId = await invite();
    if (chatId) navigate(`/e/chats/${chatId}`);
  }

  if (activeVacancies.length === 0) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between px-5 pt-4 pb-2 safe-top shrink-0">
          <div className="flex items-center gap-2">
            <Logo size={22} className="text-accent" />
            <span className="font-extrabold tracking-tight text-[15px]">WOLSO</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-5">
          <EmptyState
            icon={<Search size={26} />}
            title="Сначала опубликуйте смену"
            description="Приглашать соискателей можно только на активную вакансию — опубликуйте её, и здесь появится подбор подходящих анкет."
            actions={
              <Button fullWidth onClick={() => navigate('/e/vacancies/new')}>
                Опубликовать смену
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-2 safe-top shrink-0">
        <div className="flex items-center gap-2">
          <Logo size={22} className="text-accent" />
          <span className="font-extrabold tracking-tight text-[15px]">WOLSO</span>
        </div>
        <Chip tone="dark" onClick={() => setSheetOpen(true)} className="h-9 px-3.5 inline-flex items-center gap-1.5 max-w-[65%]">
          <SlidersHorizontal size={13} className="shrink-0" />
          <span className="truncate">{selectedVacancy ? selectedVacancy.positionLabel : 'Выберите смену'}</span>
        </Chip>
      </div>

      {deck.length > 0 && (
        <p className="px-5 pb-2 text-[12px] font-semibold uppercase tracking-wide text-text-faint shrink-0">
          Анкета {Math.min(index + 1, deck.length)} из {deck.length}
        </p>
      )}

      <SwipeDeck
        ref={deckRef}
        items={remaining}
        keyOf={(w) => w.id}
        loading={loading}
        renderCard={(worker) => <CandidateCard candidate={worker} />}
        onSwiped={(_worker, direction) => handleSwiped(direction)}
        rightLabel="Пригласить"
        leftLabel="Пропуск"
        empty={
          <EmptyState
            title="Подходящих анкет пока нет"
            description="Все, кто подошёл под эту смену, уже просмотрены — загляните позже или выберите другую вакансию."
            actions={
              activeVacancies.length > 1 ? (
                <Button fullWidth onClick={() => setSheetOpen(true)}>
                  Выбрать другую смену
                </Button>
              ) : null
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
            <UserPlus size={18} /> Пригласить
          </Button>
        </div>
      )}

      <p className="text-center text-[11px] text-text-faint pb-2 shrink-0">
        свайп вправо — пригласить на смену · влево — пропустить
      </p>

      <VacancyPickSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        vacancies={activeVacancies}
        selectedId={shiftId}
        onSelect={(v) => setVacancy(v.id, v.position)}
      />
    </div>
  );
}
