import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  notifyNewShifts: boolean;
  notifyEmployerReplies: boolean;
  notifyReminder: boolean;
  city: string;
  card: string;
  setNotifyNewShifts: (v: boolean) => void;
  setNotifyEmployerReplies: (v: boolean) => void;
  setNotifyReminder: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      notifyNewShifts: true,
      notifyEmployerReplies: true,
      notifyReminder: false,
      city: 'Москва',
      card: '···4120',
      setNotifyNewShifts: (v) => set({ notifyNewShifts: v }),
      setNotifyEmployerReplies: (v) => set({ notifyEmployerReplies: v }),
      setNotifyReminder: (v) => set({ notifyReminder: v }),
    }),
    { name: 'wolso/settings' },
  ),
);
