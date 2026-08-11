import { create } from 'zustand';
import { TEAM } from '@/data/team';
import { roleById } from '@/data/permissions';
import { useRolesStore } from './useRolesStore';
import type { PermissionKey, RoleDef, TeamMember } from '@/types';

interface SessionState {
  currentMemberId: string;
  setCurrentMember: (id: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  currentMemberId: 'u-elena',
  setCurrentMember: (id) => set({ currentMemberId: id }),
}));

/** Reactive hooks — re-render when the demo user or their role's permissions change. */
export function useCurrentMember(): TeamMember {
  const id = useSessionStore((s) => s.currentMemberId);
  return TEAM.find((m) => m.id === id) ?? TEAM[0];
}

export function useCurrentRole(): RoleDef {
  const member = useCurrentMember();
  const roles = useRolesStore((s) => s.roles);
  return roleById(member.roleId, roles);
}

export function useCan(key: PermissionKey): boolean {
  const role = useCurrentRole();
  return role.permissions[key] !== 'no';
}
