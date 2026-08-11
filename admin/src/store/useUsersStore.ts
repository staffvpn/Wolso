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
    const statusLabel = status === 'suspended' ? 'Заблокирован' : kind === 'seeker' ? 'Верифицирован' : 'Активен';
    const apply = (u: PlatformUser) => (u.id === id ? { ...u, status, statusLabel } : u);
    if (kind === 'seeker') set({ seekers: get().seekers.map(apply) });
    else set({ employers: get().employers.map(apply) });
  },

  setTeamRole: async (memberId, roleId) => {
    set({ team: get().team.map((m) => (m.id === memberId ? { ...m, roleId } : m)) });
    await setTeamMemberRole(memberId, roleId);
  },

  inviteMember: async (name, telegramId, roleId) => {
    await inviteTeamMember(name, telegramId, roleId);
    const team = await fetchTeam();
    set({ team });
  },

  revokeAccess: async (memberId) => {
    set({ team: get().team.map((m) => (m.id === memberId ? { ...m, status: 'suspended' } : m)) });
    await revokeTeamAccess(memberId);
  },
}));
