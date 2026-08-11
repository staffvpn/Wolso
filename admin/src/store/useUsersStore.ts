import { create } from 'zustand';
import type { MemberAccess, PlatformUser, TeamMember, UserStatus } from '@/types';
import { EMPLOYERS, SEEKERS } from '@/data/users';
import { TEAM } from '@/data/team';
import { useAuditStore } from './useAuditStore';

interface UsersState {
  seekers: PlatformUser[];
  employers: PlatformUser[];
  team: TeamMember[];
  toggleBlock: (id: string, kind: 'seeker' | 'employer', actor: { name: string; role: string }) => void;
  setTeamRole: (memberId: string, roleId: string, access: MemberAccess, actor: { name: string; role: string }) => void;
  setMemberAccess: (memberId: string, access: MemberAccess, actor: { name: string; role: string }) => void;
  inviteMember: (name: string, email: string, roleId: string, actor: { name: string; role: string }) => void;
  revokeAccess: (memberId: string, actor: { name: string; role: string }) => void;
}

function nextStatus(user: PlatformUser): { status: UserStatus; label: string } {
  const blocking = user.status !== 'suspended';
  return blocking ? { status: 'suspended', label: 'Заблокирован' } : { status: 'active', label: user.kind === 'seeker' ? 'Верифицирован' : 'Активен' };
}

export const useUsersStore = create<UsersState>((set) => ({
  seekers: SEEKERS,
  employers: EMPLOYERS,
  team: TEAM,

  toggleBlock: (id, kind, actor) => {
    const list = kind === 'seeker' ? SEEKERS : EMPLOYERS;
    const user = list.find((u) => u.id === id);
    if (!user) return;
    const { status, label } = nextStatus(user);
    const apply = (u: PlatformUser) => (u.id === id ? { ...u, status, statusLabel: label } : u);
    if (kind === 'seeker') set((s) => ({ seekers: s.seekers.map(apply) }));
    else set((s) => ({ employers: s.employers.map(apply) }));
    useAuditStore
      .getState()
      .log(actor.name, actor.role, `${status === 'suspended' ? 'заблокировала' : 'разблокировала'} ${user.name}`, status === 'suspended' ? 'danger' : 'neutral');
  },

  setTeamRole: (memberId, roleId, access, actor) => {
    const member = TEAM.find((m) => m.id === memberId);
    set((s) => ({ team: s.team.map((m) => (m.id === memberId ? { ...m, roleId, access } : m)) }));
    if (member) useAuditStore.getState().log(actor.name, actor.role, `изменила роль ${member.name} на «${roleId}»`, 'neutral');
  },

  setMemberAccess: (memberId, access, actor) => {
    const member = TEAM.find((m) => m.id === memberId);
    set((s) => ({ team: s.team.map((m) => (m.id === memberId ? { ...m, access } : m)) }));
    if (member) useAuditStore.getState().log(actor.name, actor.role, `обновила доступ ${member.name}`, 'neutral');
  },

  inviteMember: (name, email, roleId, actor) => {
    const member: TeamMember = { id: `u-${Date.now()}`, name, email, roleId, status: 'invited', lastActiveMinAgo: 0, since: new Date().getFullYear() };
    set((s) => ({ team: [member, ...s.team] }));
    useAuditStore.getState().log(actor.name, actor.role, `пригласила ${name} в команду`, 'neutral');
  },

  revokeAccess: (memberId, actor) => {
    const member = TEAM.find((m) => m.id === memberId);
    set((s) => ({ team: s.team.map((m) => (m.id === memberId ? { ...m, status: 'suspended' as UserStatus } : m)) }));
    if (member) useAuditStore.getState().log(actor.name, actor.role, `отозвала доступ у ${member.name}`, 'danger');
  },
}));
