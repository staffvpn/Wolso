import { create } from 'zustand';
import type { PlatformUser, TeamMember } from '@/types';
import {
  fetchTeam,
  fetchSeekers,
  fetchEmployers,
  toggleBlockSeeker,
  toggleBlockEmployer,
  inviteTeamMember,
  setTeamMemberRole,
  revokeTeamAccess,
  switchSeekerToEmployer,
  switchEmployerToSeeker,
  deleteSeeker,
  deleteEmployer,
} from '@/services/usersApi';

interface UsersState {
  seekers: PlatformUser[];
  employers: PlatformUser[];
  team: TeamMember[];
  loading: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  toggleBlock: (id: string, kind: 'seeker' | 'employer') => Promise<void>;
  setTeamRole: (memberId: string, roleId: string) => Promise<void>;
  inviteMember: (name: string, telegramId: number, roleId: string) => Promise<void>;
  revokeAccess: (memberId: string) => Promise<void>;
  switchRole: (id: string, kind: 'seeker' | 'employer') => Promise<void>;
  deleteUser: (id: string, kind: 'seeker' | 'employer') => Promise<void>;
}

export const useUsersStore = create<UsersState>((set, get) => ({
  seekers: [],
  employers: [],
  team: [],
  loading: false,
  loaded: false,

  load: async () => {
    set({ loading: true });
    const [team, seekers, employers] = await Promise.all([fetchTeam(), fetchSeekers(), fetchEmployers()]);
    set({ team, seekers, employers, loading: false, loaded: true });
  },

  toggleBlock: async (id, kind) => {
    const status = kind === 'seeker' ? await toggleBlockSeeker(id) : await toggleBlockEmployer(id);
    const statusLabel = status === 'suspended' ? 'Заблокирован' : 'Активен';
    const apply = (u: PlatformUser) => (u.id === id ? { ...u, status, statusLabel } : u);
    if (kind === 'seeker') set({ seekers: get().seekers.map(apply) });
    else set({ employers: get().employers.map(apply) });
  },

  // These two used to update the store optimistically before the request
  // resolved — fine when the server never says no, but now that role
  // changes touching Owner can legitimately be rejected (403/400), an
  // optimistic update would show "success" in the UI for a call the
  // server actually refused. Await first, apply state only on success.
  setTeamRole: async (memberId, roleId) => {
    await setTeamMemberRole(memberId, roleId);
    set({ team: get().team.map((m) => (m.id === memberId ? { ...m, roleId } : m)) });
  },

  inviteMember: async (name, telegramId, roleId) => {
    await inviteTeamMember(name, telegramId, roleId);
    const team = await fetchTeam();
    set({ team });
  },

  revokeAccess: async (memberId) => {
    await revokeTeamAccess(memberId);
    set({ team: get().team.map((m) => (m.id === memberId ? { ...m, status: 'suspended' } : m)) });
  },

  switchRole: async (id, kind) => {
    if (kind === 'seeker') await switchSeekerToEmployer(id);
    else await switchEmployerToSeeker(id);
    const [seekers, employers] = await Promise.all([fetchSeekers(), fetchEmployers()]);
    set({ seekers, employers });
  },

  deleteUser: async (id, kind) => {
    if (kind === 'seeker') {
      await deleteSeeker(id);
      set({ seekers: get().seekers.filter((u) => u.id !== id) });
    } else {
      await deleteEmployer(id);
      set({ employers: get().employers.filter((u) => u.id !== id) });
    }
  },
}));
