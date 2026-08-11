import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useSessionStore } from '@/store/useSessionStore';
import { Login } from '@/screens/Login';
import { Logo } from './ui/Logo';

/** Blocks the admin app behind a real Telegram-login session. Nothing else
 *  can talk to the API before this resolves, so it sits above the router. */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useSessionStore((s) => s.status);
  const bootstrap = useSessionStore((s) => s.bootstrap);

  useEffect(() => {
    if (status === 'idle') bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'ready') return <>{children}</>;

  if (status === 'idle' || status === 'error') return <Login />;

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
        className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center"
      >
        <Logo size={22} className="text-accent" />
      </motion.div>
    </div>
  );
}
