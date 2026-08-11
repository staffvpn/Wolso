import { create } from 'zustand';
import type { PermissionKey, PermissionValue, RoleDef } from '@/types';
import { apiFetch } from '@/lib/apiClient';

interface RoleApiRow extends RoleDef {
  memberCount: number;
}

interface RolesState {
  roles: RoleDef[];
  memberCounts: Record<string, number>;
  loading: boolean;
  loaded: boolean;
  twoFactorRequired: boolean;
  load: () => Promise<void>;
  memberCountFor: (roleId: string) => number;
  createRole: (name: string, description: string, permissions: Record<PermissionKey, PermissionValue>) => Promise<RoleDef>;
  updatePermission: (roleId: string, key: PermissionKey, value: PermissionValue) => Promise<void>;
  setTwoFactorRequired: (v: boolean) => Promise<void>;
}

export const useRolesStore = create<RolesState>((set, get) => ({
  roles: [],
  memberCounts: {},
  loading: false,
  loaded: false,
  twoFactorRequired: true,

  load: async () => {
    set({ loading: true });
    const [{ roles }, { required }] = await Promise.all([
      apiFetch<{ roles: RoleApiRow[] }>('/admin/roles'),
      apiFetch<{ required: boolean }>('/admin/roles/two-factor'),
    ]);
    const memberCounts: Record<string, number> = {};
    const plain: RoleDef[] = roles.map(({ memberCount, ...role }) => {
      memberCounts[role.id] = memberCount;
      return role;
    });
    set({ roles: plain, memberCounts, loading: false, loaded: true, twoFactorRequired: required });
  },

  memberCountFor: (roleId) => get().memberCounts[roleId] ?? 0,

  createRole: async (name, description, permissions) => {
    const { id } = await apiFetch<{ id: string }>('/admin/roles', { method: 'POST', body: { name, description, permissions } });
    const role: RoleDef = { id, name, description, isSystem: false, color: '#6b6d76', permissions: { ...permissions, transferOwnership: 'no' } };
    set((s) => ({ roles: [...s.roles, role] }));
    return role;
  },

  updatePermission: async (roleId, key, value) => {
    set((s) => ({
      roles: s.roles.map((r) => (r.id === roleId ? { ...r, permissions: { ...r.permissions, [key]: value } } : r)),
    }));
    await apiFetch(`/admin/roles/${roleId}/permissions`, { method: 'PATCH', body: { key, value } });
  },

  setTwoFactorRequired: async (v) => {
    set({ twoFactorRequired: v });
    await apiFetch('/admin/roles/two-factor', { method: 'PUT', body: { required: v } });
  },
}));
