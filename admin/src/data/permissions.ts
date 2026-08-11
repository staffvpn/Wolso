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
];

export const SYSTEM_ROLES: RoleDef[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Всё, включая биллинг и передачу владения',
    isSystem: true,
    color: '#1fae63',
    permissions: {
      approveVacancies: 'yes',
      blockUsers: 'yes',
      verifyDocuments: 'yes',
      viewSupportChats: 'yes',
      refundsPayouts: 'yes',
      changeCommission: 'yes',
      manageTeam: 'yes',
      transferOwnership: 'yes',
    },
  },
  {
    id: 'admin',
    name: 'Админ',
    description: 'Пользователи, финансы, настройки платформы',
    isSystem: true,
    color: '#2563a8',
    permissions: {
      approveVacancies: 'yes',
      blockUsers: 'yes',
      verifyDocuments: 'yes',
      viewSupportChats: 'yes',
      refundsPayouts: 'yes',
      changeCommission: 'yes',
      manageTeam: 'yes',
      transferOwnership: 'no',
    },
  },
  {
    id: 'moderator',
    name: 'Модератор',
    description: 'Проверка вакансий, документов и жалоб',
    isSystem: true,
    color: '#6b6d76',
    permissions: {
      approveVacancies: 'yes',
      blockUsers: 'confirm',
      verifyDocuments: 'yes',
      viewSupportChats: 'no',
      refundsPayouts: 'no',
      changeCommission: 'no',
      manageTeam: 'no',
      transferOwnership: 'no',
    },
  },
  {
    id: 'support',
    name: 'Поддержка',
    description: 'Чтение профилей и переписок, ответы в тикетах',
    isSystem: true,
    color: '#6b6d76',
    permissions: {
      approveVacancies: 'no',
      blockUsers: 'no',
      verifyDocuments: 'no',
      viewSupportChats: 'yes',
      refundsPayouts: 'no',
      changeCommission: 'no',
      manageTeam: 'no',
      transferOwnership: 'no',
    },
  },
];

export function roleById(id: string, roles: RoleDef[] = SYSTEM_ROLES): RoleDef {
  return roles.find((r) => r.id === id) ?? roles[roles.length - 1];
}

export function hasPermission(role: RoleDef, key: PermissionInfo['key']): boolean {
  return role.permissions[key] !== 'no';
}
