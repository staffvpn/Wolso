import { create } from 'zustand';
import type { PermissionKey, PermissionValue, RoleDef } from '@/types';
import { SYSTEM_ROLES } from '@/data/permissions';
import { TEAM } from '@/data/team';

interface RolesState {
  roles: RoleDef[];
  memberCountFor: (roleId: string) => number;
  createRole: (name: string, description: string, permissions: Record<PermissionKey, PermissionValue>) => RoleDef;
  updatePermission: (roleId: string, key: PermissionKey, value: PermissionValue) => void;
  twoFactorRequired: boolean;
  setTwoFactorRequired: (v: boolean) => void;
}

export const useRolesStore = create<RolesState>((set) => ({
  roles: SYSTEM_ROLES,
  twoFactorRequired: true,
  setTwoFactorRequired: (v) => set({ twoFactorRequired: v }),

  memberCountFor: (roleId) => TEAM.filter((m) => m.roleId === roleId).length,

  createRole: (name, description, permissions) => {
    const role: RoleDef = {
      id: `custom-${Date.now()}`,
      name,
      description,
      isSystem: false,
      color: '#6b6d76',
      permissions,
    };
    set((s) => ({ roles: [...s.roles, role] }));
    return role;
  },

  updatePermission: (roleId, key, value) =>
    set((s) => ({
      roles: s.roles.map((r) => (r.id === roleId ? { ...r, permissions: { ...r.permissions, [key]: value } } : r)),
    })),
}));
