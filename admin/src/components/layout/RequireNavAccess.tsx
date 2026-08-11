import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useCurrentRole } from '@/store/useSessionStore';
import { navForRole } from './nav';

/** Redirects to the first page the current role can actually see, if they land on (or get switched into) a route they no longer have access to. */
export function RequireNavAccess() {
  const role = useCurrentRole();
  const location = useLocation();
  const items = navForRole(role);
  const allowed = items.some((item) => location.pathname.startsWith(item.to));

  if (!allowed) {
    return <Navigate to={items[0]?.to ?? '/users'} replace />;
  }
  return <Outlet />;
}
