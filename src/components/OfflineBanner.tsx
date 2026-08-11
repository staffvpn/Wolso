import { AnimatePresence, motion } from 'framer-motion';
import { Zap, RotateCw } from 'lucide-react';
import { useOfflineStore } from '@/store/useOfflineStore';
import { Button } from './ui/Button';

export function OfflineBanner() {
  const offline = useOfflineStore((s) => s.offline);
  const pendingCount = useOfflineStore((s) => s.pendingCount);
  const setOffline = useOfflineStore((s) => s.setOffline);
  const flush = useOfflineStore((s) => s.flush);

  return (
    <AnimatePresence>
      {offline && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="absolute inset-0 z-[600] bg-bg flex flex-col items-center justify-center px-8 gap-4 text-center safe-top safe-bottom"
        >
          <div className="h-16 w-16 rounded-2xl bg-warning-soft flex items-center justify-center text-warning">
            <Zap size={28} />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-[19px] font-bold">Нет соединения</h3>
            <p className="text-[14px] leading-relaxed text-text-muted max-w-[300px]">
              Смены не обновились. Отклики, которые вы отправили, уйдут автоматически, как только связь вернётся.
            </p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 text-[13px] text-text-muted bg-surface border border-border rounded-full px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              {pendingCount} {pendingCount === 1 ? 'отклик ждёт' : 'отклика ждут'} отправки
            </div>
          )}
          <Button
            onClick={() => {
              setOffline(false);
              flush();
            }}
          >
            <RotateCw size={16} /> Повторить
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
