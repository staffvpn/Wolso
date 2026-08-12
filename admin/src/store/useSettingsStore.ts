import { create } from 'zustand';

interface SettingsState {
  platformName: string;
  supportEmail: string;
  defaultCity: string;
  defaultCommissionPct: number;
  payoutSchedule: 'instant' | 'daily' | 'weekly';
  notifyOnBelowMinWage: boolean;
  notifyOnNewEmployer: boolean;
  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  platformName: 'Wolso',
  supportEmail: 'support@stafftap.ru',
  defaultCity: 'Москва',
  defaultCommissionPct: 7,
  payoutSchedule: 'instant',
  notifyOnBelowMinWage: true,
  notifyOnNewEmployer: false,
  set: (key, value) => set({ [key]: value } as Pick<SettingsState, typeof key>),
}));
