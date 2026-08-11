import { useAppStore } from '@/store/useAppStore';

export function useRole() {
  return useAppStore((s) => s.role);
}
