import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { hapticSelect } from '@/lib/telegram';

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        hapticSelect();
        onChange(!checked);
      }}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40',
        checked ? 'bg-accent' : 'bg-surface-2 border border-border',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 700, damping: 34 }}
        className={cn(
          'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}
