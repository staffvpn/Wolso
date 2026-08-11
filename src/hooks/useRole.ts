import { useAuthStore } from '@/store/useAuthStore';

/** The Telegram account's permanent role. Only valid once AuthGate has
 *  resolved (status 'ready'), which is guaranteed for anything that
 *  renders under it. */
export function useRole() {
  return useAuthStore((s) => s.role) ?? 'worker';
}
