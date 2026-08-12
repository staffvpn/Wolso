import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, X, SlidersHorizontal, Search } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { IconButton } from '@/components/ui/IconButton';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/deck/SwipeDeck';
import { CandidateCard } from '@/components/deck/CandidateCard';
import { WorkerPositionSheet } from '@/components/WorkerPositionSheet';
import { useWorkerBrowseStore } from '@/store/useWorkerBrowseStore';
import { useChatStore } from '@/store/useChatStore';
import { POSITION_LABEL } from '@/data/positions';

/** The mirror image of the worker's swipe feed — an employer browsing
 *  worker anketas directly instead of waiting for applications, filtered
 *  to the positions they actually need so a search for waiters never
 *  turns up a hostess. */
export function FindWorkers() {
  const navigate = useNavigate();
  const deckRef = useRef<SwipeDeckHandle>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { positions, deck, index, loading, loaded, setPositions, loadDeck, pass, advance } = useWorkerBrowseStore();
  const startChatWithWorker = useChatStore((s) => s.startChatWithWorker);

  useEffect(() => {
    if (!loaded && positions.length > 0) loadDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remaining = deck.slice(index);
  const current = remaining[0];

  // Single path for both an actual drag-swipe-right and tapping "Написать"
  // below — the button just triggers the same fling animation, so this is
  // the only place the resulting action lives.
  async function handleSwiped(worker: (typeof remaining)[number], direction: 'left' | 'right') {
    if (direction === 'left') {
      pass();
      return;
    }
    const chatId = await startChatWithWorker(worker.workerId);
    advance();
    navigate(`/e/chats/${chatId}`);
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
          <span className="truncate">{positions.length > 0 ? positions.map((p) => POSITION_LABEL[p]).join(', ') : 'Кого ищете?'}</span>
        </Chip>
      </div>

      {positions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon={<Search size={26} />}
            title="Выберите, кого ищете"
            description="Отметьте одну или несколько должностей — покажем анкеты подходящих соискателей."
            actions={
              <Button fullWidth onClick={() => setSheetOpen(true)}>
                Выбрать должность
              </Button>
            }
          />
        </div>
      ) : (
        <>
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
            onSwiped={(worker, direction) => handleSwiped(worker, direction)}
            empty={
              <EmptyState
                title="Подходящих анкет пока нет"
                description="Все, кто подошёл под выбранные должности, уже просмотрены — попробуйте другую должность или загляните позже."
                actions={
                  <Button fullWidth onClick={() => setSheetOpen(true)}>
                    Изменить должность
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
                <Mail size={18} /> Написать
              </Button>
            </div>
          )}

          <p className="text-center text-[11px] text-text-faint pb-2 shrink-0">
            свайп вправо — написать · влево — пропустить
          </p>
        </>
      )}

      <WorkerPositionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selected={positions}
        onApply={(next) => {
          setPositions(next);
          loadDeck();
        }}
      />
    </div>
  );
}
