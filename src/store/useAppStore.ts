import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@/types';
import { getTelegramUser } from '@/lib/telegram';

interface AppState {
  onboarded: boolean;
  role: Role;
  displayName: string;
  photoUrl?: string;
  setOnboarded: (role: Role) => void;
  switchRole: (role: Role) => void;
  reset: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      onboarded: false,
      role: 'worker',
      displayName: getTelegramUser()?.first_name ?? 'Иван Ковалёв',
      photoUrl: getTelegramUser()?.photo_url,
      setOnboarded: (role) => set({ onboarded: true, role }),
      switchRole: (role) => set({ role }),
      reset: () => set({ onboarded: false, role: 'worker' }),
    }),
    { name: 'wolso/app' },
  ),
);
