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
  closedByEmployerAt: string | null;
  rating: number | null;
  reviewTags: string[];
  reviewComment: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  shift?: {
    id: number;
    companyId: number;
    position: string;
    positionLabel: string;
    date: string;
    endDate?: string;
    dates?: string[];
    startHour: number;
    startMin: number;
    endHour: number;
    endMin: number;
    hourlyRate: number;
    totalPay: number;
    description: string;
    /** What the employer ticked when publishing ("Медкнижка", …). The API
     *  has always sent these; this type just never declared them. */
    requirements?: string[];
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
    closedByEmployerAt: a.closedByEmployerAt ?? undefined,
    cancelledBy: (a.cancelledBy as Application['cancelledBy']) ?? undefined,
    cancelReason: a.cancelReason ?? undefined,
    cancelledAt: a.cancelledAt ?? undefined,
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
          endDate: a.shift.endDate,
          dates: a.shift.dates,
          startHour: a.shift.startHour,
          startMin: a.shift.startMin,
          endHour: a.shift.endHour,
          endMin: a.shift.endMin,
          hourlyRate: a.shift.hourlyRate,
          totalPay: a.shift.totalPay,
          description: a.shift.description,
          // Same drop as in shiftsApi: the employer's requirements were
          // being thrown away here, so the expanded response card had
          // nothing to show for them.
          tags: a.shift.requirements ?? [],
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
  loaded: boolean;
  error: boolean;
  load: () => Promise<void>;
  apply: (shiftId: string) => Promise<void>;
  checkIn: (applicationId: string) => Promise<void>;
  /** The worker's answer to an employer's invitation. */
  respondToInvite: (applicationId: string, accept: boolean) => Promise<void>;
  /** Backing out of an already-confirmed shift — reason is mandatory. */
  cancelApplication: (applicationId: string, reason: string) => Promise<void>;
  submitReview: (applicationId: string, rating: number, tags: string[], comment: string) => Promise<void>;
}

export const useApplicationsStore = create<ApplicationsState>((set) => ({
  applications: [],
  loading: false,
  loaded: false,
  error: false,

  load: async () => {
    set({ loading: true, error: false });
    try {
      const { applications } = await apiFetch<{ applications: ApiApplication[] }>('/applications');
      set({ applications: applications.map(fromApi), loading: false, loaded: true });
    } catch {
      // PendingReviewGate (AuthGate.tsx) blocks the entire app on `loaded`
      // — a request that fails and never resolves it would soft-lock every
      // worker session on a spinner forever, so this has to settle either way.
      set({ loading: false, loaded: true, error: true });
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

  respondToInvite: async (applicationId, accept) => {
    await apiFetch(`/applications/${applicationId}/respond`, { method: 'POST', body: { accept } });
    set((s) => ({
      applications: s.applications.map((a) => (a.id === applicationId ? { ...a, status: accept ? 'accepted' : 'declined' } : a)),
    }));
  },

  cancelApplication: async (applicationId, reason) => {
    await apiFetch(`/applications/${applicationId}/cancel`, { method: 'POST', body: { reason } });
    set((s) => ({
      applications: s.applications.map((a) =>
        a.id === applicationId ? { ...a, status: 'cancelled', cancelledBy: 'worker', cancelReason: reason } : a,
      ),
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
}));
