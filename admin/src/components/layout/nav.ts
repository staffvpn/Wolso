import { LayoutDashboard, Users, Briefcase, Wallet, ShieldCheck, History, Settings, LifeBuoy, DatabaseZap, BadgeCheck, Megaphone, Flag } from 'lucide-react';
import type { RoleDef } from '@/types';
import { FEATURES } from '@/lib/features';

export interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  visible: (role: RoleDef) => boolean;
}

const yes = (role: RoleDef, key: keyof RoleDef['permissions']) => role.permissions[key] !== 'no';

export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Дашборд', icon: LayoutDashboard, visible: (r) => yes(r, 'changeCommission') || yes(r, 'refundsPayouts') },
  { to: '/users', label: 'Пользователи', icon: Users, visible: () => true },
  { to: '/vacancies', label: 'Вакансии и смены', icon: Briefcase, visible: (r) => yes(r, 'approveVacancies') },
  { to: '/verification', label: 'Проверка работодателей', icon: BadgeCheck, visible: (r) => yes(r, 'approveVacancies') },
  // Рядом с «Проверкой работодателей»: обе — очереди, в которые кто-то
  // должен смотреть каждый день, в отличие от справочных экранов ниже.
  { to: '/complaints', label: 'Жалобы', icon: Flag, visible: (r) => yes(r, 'blockUsers') },
  { to: '/support', label: 'Поддержка', icon: LifeBuoy, visible: (r) => yes(r, 'viewSupportChats') },
  { to: '/broadcast', label: 'Рассылка', icon: Megaphone, visible: (r) => yes(r, 'manageData') },
  { to: '/finance', label: 'Финансы', icon: Wallet, visible: (r) => FEATURES.payments && yes(r, 'refundsPayouts') },
  { to: '/roles', label: 'Роли и права', icon: ShieldCheck, visible: (r) => yes(r, 'manageTeam') },
  { to: '/audit-log', label: 'Аудит-лог', icon: History, visible: (r) => yes(r, 'manageTeam') || yes(r, 'changeCommission') },
  { to: '/data', label: 'Данные', icon: DatabaseZap, visible: (r) => yes(r, 'manageData') },
  { to: '/settings', label: 'Настройки', icon: Settings, visible: (r) => yes(r, 'manageTeam') },
];

export function navForRole(role: RoleDef): NavItem[] {
  return NAV_ITEMS.filter((item) => item.visible(role));
}
