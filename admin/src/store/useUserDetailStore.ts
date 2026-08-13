import { create } from 'zustand';
import type { EmployerDetail, SeekerDetail } from '@/types';
import {
  fetchSeekerDetail,
  fetchEmployerDetail,
  updateSeeker as updateSeekerApi,
  updateEmployer as updateEmployerApi,
} from '@/services/usersApi';

/** The expanded card's full profile + edit state — kept separate from
 *  useUsersStore (which only ever needs the thin list shape) since this
 *  is fetched fresh per person, only once their card is actually open. */
interface UserDetailState {
  seeker: SeekerDetail | null;
  employer: EmployerDetail | null;
  loading: boolean;
  loadSeeker: (id: string) => Promise<void>;
  loadEmployer: (id: string) => Promise<void>;
  updateSeeker: (id: string, update: { name?: string; city?: string; bio?: string; skills?: string; birthdate?: string }) => Promise<void>;
  updateEmployer: (
    id: string,
    update: { name?: string; address?: string; city?: string; description?: string; foundedYear?: number },
  ) => Promise<void>;
  clear: () => void;
}

export const useUserDetailStore = create<UserDetailState>((set, get) => ({
  seeker: null,
  employer: null,
  loading: false,

  loadSeeker: async (id) => {
    set({ loading: true, employer: null });
    const seeker = await fetchSeekerDetail(id);
    set({ seeker, loading: false });
  },

  loadEmployer: async (id) => {
    set({ loading: true, seeker: null });
    const employer = await fetchEmployerDetail(id);
    set({ employer, loading: false });
  },

  updateSeeker: async (id, update) => {
    await updateSeekerApi(id, update);
    const current = get().seeker;
    if (current && current.id === id) set({ seeker: { ...current, ...update } });
  },

  updateEmployer: async (id, update) => {
    await updateEmployerApi(id, update);
    const current = get().employer;
    if (current && current.id === id) set({ employer: { ...current, ...update } });
  },

  clear: () => set({ seeker: null, employer: null }),
}));
