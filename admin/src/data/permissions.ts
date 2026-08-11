import type { PermissionInfo, RoleDef } from '@/types';

export const PERMISSIONS: PermissionInfo[] = [
  { key: 'approveVacancies', label: 'Одобрять и отклонять вакансии' },
  { key: 'blockUsers', label: 'Блокировать пользователей' },
  { key: 'verifyDocuments', label: 'Проверять документы и медкнижки' },
  { key: 'viewSupportChats', label: 'Видеть переписки в поддержке' },
  { key: 'refundsPayouts', label: 'Возвраты и выплаты' },
  { key: 'changeCommission', label: 'Менять комиссию платформы' },
  { key: 'manageTeam', label: 'Приглашать и удалять команду' },
  { key: 'transferOwnership', label: 'Передача владения платформой' },
  { key: 'switchUserRole', label: 'Переключать роль пользователя (работник ↔ работодатель)' },
];

/** Roles themselves come from the API (`useRolesStore`) — this only has the
 *  static permission-key catalog and a lookup helper. */
export function roleById(id: string, roles: RoleDef[]): RoleDef {
  return roles.find((r) => r.id === id) ?? roles[roles.length - 1];
}

export function hasPermission(role: RoleDef, key: PermissionInfo['key']): boolean {
  return role.permissions[key] !== 'no';
}
