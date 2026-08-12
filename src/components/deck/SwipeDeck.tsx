import { forwardRef, useImperativeHandle, useRef, type ReactElement, type ReactNode, type Ref } from 'react';
import { AnimatePresence } from 'framer-motion';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { DeckCard, type DeckCardHandle } from './DeckCard';

export interface SwipeDeckHandle {
  swipeLeft: () => void;
  swipeRight: () => void;
}

interface SwipeDeckProps<T> {
  items: T[];
  keyOf: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  onSwiped: (item: T, direction: 'left' | 'right') => void;
  loading?: boolean;
  empty?: ReactNode;
  stackSize?: number;
}

function SwipeDeckInner<T>(props: SwipeDeckProps<T>, ref: Ref<SwipeDeckHandle>) {
  const { items, keyOf, renderCard, onSwiped, loading, empty, stackSize = 2 } = props;
  const cardRefs = useRef(new Map<string, DeckCardHandle>());

  useImperativeHandle(ref, () => ({
    swipeLeft: () => {
      const top = items[0];
      if (!top) return;
      cardRefs.current.get(keyOf(top))?.fling('left');
    },
    swipeRight: () => {
      const top = items[0];
      if (!top) return;
      cardRefs.current.get(keyOf(top))?.fling('right');
    },
  }));

  if (loading) {
    return (
      <div className="relative flex-1 px-5 pb-4">
        <Skeleton className="absolute inset-x-5 inset-y-0 rounded-card" />
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="flex-1 flex items-center justify-center">{empty ?? <EmptyState title="Пусто" />}</div>;
  }

  const visible = items.slice(0, stackSize + 1);

  return (
    <div className="relative flex-1 px-5 pb-2 min-h-0">
      <AnimatePresence initial={false}>
        {visible
          .map((item, i) => (
            <DeckCard
              key={keyOf(item)}
              ref={(handle) => {
                if (handle) cardRefs.current.set(keyOf(item), handle);
                else cardRefs.current.delete(keyOf(item));
              }}
              index={i}
              active={i === 0}
              onSwiped={(direction) => onSwiped(item, direction)}
            >
              {renderCard(item)}
            </DeckCard>
          ))
          .reverse()}
      </AnimatePresence>
    </div>
  );
}

export const SwipeDeck = forwardRef(SwipeDeckInner) as <T>(
  props: SwipeDeckProps<T> & { ref?: Ref<SwipeDeckHandle> },
) => ReactElement;
