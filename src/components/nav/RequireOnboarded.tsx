import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';

export function RequireOnboarded() {
  const onboarded = useAppStore((s) => s.onboarded);
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}
