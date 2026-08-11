import { create } from 'zustand';
import type { Application } from '@/types';
import { applyToShift as applyToShiftApi } from '@/services/shiftsApi';
import { useNotificationsStore } from './useNotificationsStore';
import { useChatStore } from './useChatStore';
import { getShift } from '@/data/shifts';
import { getCompany } from '@/data/companies';

interface ApplicationsState {
  applications: Application[];
  apply: (shiftId: string) => Promise<void>;
  checkIn: (applicationId: string) => void;
  checkOut: (applicationId: string) => void;
  submitReview: (applicationId: string, rating: number, tags: string[], comment: string) => void;
  skipReview: (applicationId: string) => void;
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  applications: [],

  apply: async (shiftId) => {
    await applyToShiftApi(shiftId);
    const application: Application = {
      id: `app-${Date.now()}`,
      shiftId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      workStage: 'upcoming',
    };
    set((s) => ({ applications: [application, ...s.applications] }));

    // Simulate the manager responding a little later, like the mock chat does.
    const delayMs = randomBetween(4000, 9000);
    setTimeout(() => {
      const shift = getShift(shiftId);
      if (!shift) return;
      const company = getCompany(shift.companyId);
      const accepted = Math.random() > 0.25;

      set((s) => ({
        applications: s.applications.map((a) =>
          a.id === application.id ? { ...a, status: accepted ? 'accepted' : 'declined' } : a,
        ),
      }));

      if (accepted) {
        useNotificationsStore.getState().push({
          kind: 'accepted',
          title: `${company.name} взял(а) вас на смену`,
          subtitle: `${shift.date === new Date().toISOString().slice(0, 10) ? 'Сегодня' : shift.date} ${String(shift.startHour).padStart(2, '0')}:${String(shift.startMin).padStart(2, '0')}, ${company.address}`,
        });
        useChatStore.getState().openOrCreateChatForShift(shift.id);
      }
    }, delayMs);
  },

  checkIn: (applicationId) =>
    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, workStage: 'checked_in', checkInAt: new Date().toISOString() } : a,
      ),
    })),

  checkOut: (applicationId) =>
    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, workStage: 'completed', checkOutAt: new Date().toISOString() } : a,
      ),
    })),

  submitReview: (applicationId, _rating, _tags, _comment) => {
    set((s) => ({
      applications: s.applications.map((a) => (a.id === applicationId ? { ...a, workStage: 'reviewed' } : a)),
    }));
    useNotificationsStore.getState().push({
      kind: 'payout',
      title: 'Выплата отправлена',
      subtitle: 'Деньги придут на карту в течение часа',
    });
  },

  skipReview: (applicationId) => {
    const app = get().applications.find((a) => a.id === applicationId);
    if (!app) return;
    get().submitReview(applicationId, 0, [], '');
  },
}));
