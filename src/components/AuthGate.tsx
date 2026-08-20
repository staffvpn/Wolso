import { useEffect, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useProfileStore } from '@/store/useProfileStore';
import { useCompanyStore } from '@/store/useCompanyStore';
import { useApplicationsStore } from '@/store/useApplicationsStore';
import { Button } from './ui/Button';
import { LoadingScreen } from './ui/Loader';
import { Logo } from './ui/Logo';
import { Welcome } from '@/screens/onboarding/Welcome';
import { CompleteWorkerProfile } from '@/screens/onboarding/CompleteWorkerProfile';
import { CompleteEmployerProfile } from '@/screens/onboarding/CompleteEmployerProfile';
import { EmployerVerificationPending } from '@/screens/onboarding/EmployerVerificationPending';
import { ShiftCheckout } from '@/screens/worker/ShiftCheckout';

/** Every gate below blocks the entire app on one API call — if that call
 *  fails (and nothing here retries it automatically), showing the spinner
 *  forever would soft-lock the whole session with no way out. This is the
 *  one recoverable dead end: a real error message plus a button that
 *  actually re-fires the load. */
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-4 text-center safe-top safe-bottom">
      <p className="font-bold text-[16px]">Не удалось загрузить</p>
      <p className="text-[14px] text-text-muted max-w-[280px]">Проверьте соединение и попробуйте ещё раз.</p>
      <Button onClick={onRetry}>
        <RotateCw size={16} /> Попробовать снова
      </Button>
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
  const error = useProfileStore((s) => s.error);
  const complete = useProfileStore((s) => s.profileComplete);
  const load = useProfileStore((s) => s.load);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!loaded) return <LoadingScreen label="Загружаем профиль…" />;
  if (error) return <LoadError onRetry={load} />;
  if (!complete) return <CompleteWorkerProfile gate />;
  return <PendingReviewGate>{children}</PendingReviewGate>;
}

/** Once an employer closes a shift, the worker owes a review before doing
 *  anything else — same blocking treatment as an incomplete profile,
 *  just checked one layer in since it needs a complete profile first. */
function PendingReviewGate({ children }: { children: ReactNode }) {
  const loaded = useApplicationsStore((s) => s.loaded);
  const error = useApplicationsStore((s) => s.error);
  const owesReview = useApplicationsStore((s) => s.applications.some((a) => a.workStage === 'employer_closed'));
  const load = useApplicationsStore((s) => s.load);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!loaded) return <LoadingScreen label="Загружаем профиль…" />;
  if (error) return <LoadError onRetry={load} />;
  if (owesReview) return <ShiftCheckout gate />;
  return <>{children}</>;
}

function EmployerProfileGate({ children }: { children: ReactNode }) {
  const loaded = useCompanyStore((s) => s.loaded);
  const error = useCompanyStore((s) => s.error);
  const complete = useCompanyStore((s) => s.company?.profileComplete);
  const load = useCompanyStore((s) => s.load);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  if (!loaded) return <LoadingScreen label="Загружаем профиль…" />;
  if (error) return <LoadError onRetry={load} />;
  if (!complete) return <CompleteEmployerProfile gate />;
  return <EmployerVerificationGate>{children}</EmployerVerificationGate>;
}

/** A complete profile still isn't enough to publish vacancies or browse
 *  candidates — an admin has to approve it first (see requireVerifiedCompany
 *  on the worker side, and the dashboard's verification queue). A rejection
 *  reuses the same mandatory-completion form, with the reason shown, so
 *  fixing it up and saving resubmits in one place — same treatment as an
 *  incomplete profile gets. */
function EmployerVerificationGate({ children }: { children: ReactNode }) {
  const status = useCompanyStore((s) => s.company?.verificationStatus);
  const rejectionReason = useCompanyStore((s) => s.company?.rejectionReason);
  const load = useCompanyStore((s) => s.load);

  // Nothing pushes verification decisions to the client — poll while
  // waiting so approval shows up without the employer having to relaunch
  // the app.
  useEffect(() => {
    if (status !== 'pending') return;
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [status, load]);

  if (status === 'rejected') return <CompleteEmployerProfile gate rejectionReason={rejectionReason} />;
  if (status === 'pending') return <EmployerVerificationPending />;
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

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-5 text-center safe-top safe-bottom">
        {/* Deliberately the still mark, not the Loader — an animation that
            keeps playing under an error message reads as "still trying". */}
        <div className="h-12 w-12 rounded-full bg-accent-soft flex items-center justify-center">
          <Logo size={22} className="text-accent" />
        </div>
        <div className="space-y-1.5">
          <p className="font-bold text-[16px]">Не удалось войти</p>
          <p className="text-[14px] text-text-muted max-w-[280px]">{error}</p>
        </div>
        <Button onClick={bootstrap}>
          <RotateCw size={16} /> Попробовать снова
        </Button>
      </div>
    );
  }

  return <LoadingScreen label="Заходим…" />;
}
