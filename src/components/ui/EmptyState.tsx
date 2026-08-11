import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function EmptyState({ icon, title, description, actions }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center text-center px-8 py-10 gap-4"
    >
      {icon && (
        <div className="h-16 w-16 rounded-2xl bg-surface-2 flex items-center justify-center text-text-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1.5">
        <h3 className="text-[19px] font-bold text-text">{title}</h3>
        {description && <p className="text-[14px] leading-relaxed text-text-muted max-w-[280px]">{description}</p>}
      </div>
      {actions && <div className="w-full flex flex-col gap-2.5 mt-1">{actions}</div>}
    </motion.div>
  );
}
