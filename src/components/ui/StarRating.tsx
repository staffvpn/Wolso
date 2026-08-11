import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}

export function StarRating({ value, onChange, size = 28, readOnly }: StarRatingProps) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <motion.button
          key={n}
          type="button"
          disabled={readOnly}
          whileTap={readOnly ? undefined : { scale: 0.8 }}
          onClick={() => onChange?.(n)}
          className={cn(readOnly && 'pointer-events-none')}
        >
          <Star
            size={size}
            className={n <= value ? 'fill-accent text-accent' : 'fill-transparent text-border'}
            strokeWidth={1.5}
          />
        </motion.button>
      ))}
    </div>
  );
}
