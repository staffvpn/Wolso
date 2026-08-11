import { useEffect, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useCompanyStore } from '@/store/useCompanyStore';
import { Button } from './ui/Button';
import { Logo } from './ui/Logo';
import { Welcome } from '@/screens/onboarding/Welcome';
import { CompleteWorkerProfile } from '@/screens/onboarding/CompleteWorkerProfile';
import { CompleteEmployerProfile } from '@/screens/onboarding/CompleteEmployerProfile';

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-5 text-center safe-top safe-bottom">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
        className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center"
      >
        <Logo size={22} className="text-accent" />
      </motion.div>
      <p className="text-text-muted text-[14px]">{label}</p>
    </div>
  );
}

/** Wolso is one-account-one-role and requires a complete profile before the
 *  rest of the app is usable — a worker can't be swiped on without a real
 *  anketa, and an employer can't publish without one either. Sits between
 *  role resolution and the router, so nothing downstream has to think
 *  about "what if the profile is empty". */
function ProfileGate({ children }: { children: ReactNode }) {
  const role = useAuthStore((s) => s.role);
  return role === 'employer' ? <EmployerProfileGate>{children}</EmployerProfileGate> : <WorkerProfileGate>{children}</WorkerProfileGate>;
}

function WorkerProfileGate({ children }: { children: ReactNode }) {
  const loaded = useProfileStore((s) => s.loaded);
  const complete = useProfileStore((s) => s.profileComplete);
  const load = useProfileStore((s) => s.load);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!loaded) return <Spinner label="Загружаем профиль…" />;
  if (!complete) return <CompleteWorkerProfile gate />;
  return <>{children}</>;
}

function EmployerProfileGate({ children }: { children: ReactNode }) {
  const loaded = useCompanyStore((s) => s.loaded);
  const complete = useCompanyStore((s) => s.company?.profileComplete);
  const load = useCompanyStore((s) => s.load);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!loaded) return <Spinner label="Загружаем профиль…" />;
  if (!complete) return <CompleteEmployerProfile gate />;
  return <>{children}</>;
}

/** Blocks rendering the real app until we've exchanged Telegram's initData
 *  for session tokens, resolved a permanent role (worker or employer —
 *  one account, one role, chosen once), and confirmed the mandatory
 *  profile is filled in. Nothing else can talk to the API before this
 *  resolves, so it sits above the router. */
export function AuthGate({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    if (status === 'idle') bootstrap();
  }, [status, bootstrap]);

  if (status === 'ready') return <ProfileGate>{children}</ProfileGate>;
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
