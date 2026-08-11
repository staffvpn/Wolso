import { useEffect, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { Button } from './ui/Button';
import { Logo } from './ui/Logo';
import { Welcome } from '@/screens/onboarding/Welcome';

/** Blocks rendering the real app until we've exchanged Telegram's initData
 *  for session tokens AND resolved a permanent role (worker or employer —
 *  one account, one role, chosen once). Nothing else can talk to the API
 *  before this resolves, so it sits above the router. */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    if (status === 'idle') bootstrap();
  }, [status, bootstrap]);

  if (status === 'ready') return <>{children}</>;
  if (status === 'needs_role') return <Welcome />;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-5 text-center safe-top safe-bottom">
      <motion.div
        animate={status === 'loading' || status === 'idle' ? { rotate: 360 } : {}}
        transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
        className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center"
      >
        <Logo size={22} className="text-accent" />
      </motion.div>

      {status === 'error' ? (
        <>
          <div className="space-y-1.5">
            <p className="font-bold text-[16px]">Не удалось войти</p>
            <p className="text-[14px] text-text-muted max-w-[280px]">{error}</p>
          </div>
          <Button onClick={bootstrap}>
            <RotateCw size={16} /> Попробовать снова
          </Button>
        </>
      ) : (
        <p className="text-text-muted text-[14px]">Заходим…</p>
      )}
    </div>
  );
}
