import { useEffect, type ReactNode } from 'react';
import { useSessionStore } from '@/store/useSessionStore';
import { Login } from '@/screens/Login';
import { LoadingScreen } from './ui/Loader';

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

  return <LoadingScreen label="Входим…" />;
}
