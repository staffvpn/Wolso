import { create } from 'zustand';
import type { Application, Shift } from '@/types';
import { apiFetch, resolveMediaUrl } from '@/lib/apiClient';
import { useNotificationsStore } from './useNotificationsStore';

interface ApiApplication {
  id: number;
  shiftId: number;
  status: Application['status'];
  workStage: Application['workStage'];
  checkInAt: string | null;
  checkOutAt: string | null;
  rating: number | null;
  reviewTags: string[];
  reviewComment: string | null;
  createdAt: string;
  shift?: {
    id: number;
    companyId: number;
    position: string;
    positionLabel: string;
    date: string;
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
    hourlyRate: number;
    totalPay: number;
    description: string;
    meal: boolean;
    urgency: string;
    employmentType: string;
    timeOfDay: string;
    company?: Shift['company'];
  };
}

function fromApi(a: ApiApplication): Application {
  return {
    id: String(a.id),
    shiftId: String(a.shiftId),
    status: a.status,
    workStage: a.workStage,
    checkInAt: a.checkInAt ?? undefined,
    checkOutAt: a.checkOutAt ?? undefined,
    createdAt: a.createdAt,
    shift: a.shift
      ? {
          id: String(a.shift.id),
          companyId: String(a.shift.companyId),
          // The API sends a relative /media/... path — needs the API
          // origin prefixed on, same as everywhere else avatarUrl shows up.
          company: a.shift.company ? { ...a.shift.company, avatarUrl: resolveMediaUrl(a.shift.company.avatarUrl) } : undefined,
          position: a.shift.position as Shift['position'],
          positionLabel: a.shift.positionLabel,
          date: a.shift.date,
          startHour: a.shift.startHour,
          startMin: a.shift.startMin,
          endHour: a.shift.endHour,
          endMin: a.shift.endMin,
          hourlyRate: a.shift.hourlyRate,
          totalPay: a.shift.totalPay,
          description: a.shift.description,
          tags: [],
          meal: a.shift.meal,
          urgency: (a.shift.urgency as Shift['urgency']) ?? 'normal',
          employmentType: a.shift.employmentType as Shift['employmentType'],
          timeOfDay: a.shift.timeOfDay as Shift['timeOfDay'],
        }
      : undefined,
  };
}

interface ApplicationsState {
  applications: Application[];
  loading: boolean;
  load: () => Promise<void>;
  apply: (shiftId: string) => Promise<void>;
  checkIn: (applicationId: string) => Promise<void>;
  checkOut: (applicationId: string) => Promise<void>;
  submitReview: (applicationId: string, rating: number, tags: string[], comment: string) => Promise<void>;
  skipReview: (applicationId: string) => Promise<void>;
}

export const useApplicationsStore = create<ApplicationsState>((set, get) => ({
  applications: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const { applications } = await apiFetch<{ applications: ApiApplication[] }>('/applications');
      set({ applications: applications.map(fromApi), loading: false });
    } catch {
      set({ loading: false });
    }
  },

  apply: async (shiftId) => {
    const { application } = await apiFetch<{ application: ApiApplication }>('/applications', {
      method: 'POST',
      body: { shiftId: Number(shiftId) },
    });
    set((s) => ({ applications: [fromApi(application), ...s.applications] }));
  },

  checkIn: async (applicationId) => {
    await apiFetch(`/applications/${applicationId}/check-in`, { method: 'POST' });
    set((s) => ({
      applications: s.applications.map((a) => (a.id === applicationId ? { ...a, workStage: 'checked_in' } : a)),
    }));
  },

  checkOut: async (applicationId) => {
    await apiFetch(`/applications/${applicationId}/check-out`, { method: 'POST' });
    set((s) => ({
      applications: s.applications.map((a) => (a.id === applicationId ? { ...a, workStage: 'completed' } : a)),
    }));
  },

  submitReview: async (applicationId, rating, tags, comment) => {
    await apiFetch(`/applications/${applicationId}/review`, { method: 'POST', body: { rating, tags, comment } });
    set((s) => ({
      applications: s.applications.map((a) => (a.id === applicationId ? { ...a, workStage: 'reviewed' } : a)),
    }));
    useNotificationsStore.getState().push({
      kind: 'accepted',
      title: 'Смена засчитана',
      subtitle: 'Спасибо за отзыв — до встречи на следующей смене',
    });
  },

  skipReview: async (applicationId) => {
    await get().submitReview(applicationId, 0, [], '');
  },
}));
