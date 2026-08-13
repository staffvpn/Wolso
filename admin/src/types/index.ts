export type PermissionKey =
  | 'approveVacancies'
  | 'blockUsers'
  | 'viewSupportChats'
  | 'refundsPayouts'
  | 'changeCommission'
  | 'manageTeam'
  | 'transferOwnership'
  | 'switchUserRole'
  | 'manageData';

export type PermissionValue = 'yes' | 'no' | 'confirm';

export interface PermissionInfo {
  key: PermissionKey;
  label: string;
}

export interface RoleDef {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  color: string;
  permissions: Record<PermissionKey, PermissionValue>;
}

export type UserStatus = 'active' | 'invited' | 'suspended';

export interface TeamMember {
  id: string;
  name: string;
  /** Real staff accounts are Telegram-only — no email collection. Shown as
   *  a contact string derived from their Telegram id. */
  contact: string;
  roleId: string;
  status: UserStatus;
  since: number; // year
  /** No "last seen" tracking exists yet — this is time since the account
   *  was created, shown under "Регистрация" rather than "Активность". */
  createdMinAgo: number;
}

export type PlatformUserKind = 'seeker' | 'employer';

export interface PlatformUser {
  id: string;
  kind: PlatformUserKind;
  name: string;
  contact: string;
  status: UserStatus;
  statusLabel: string;
  /** Time since registration — no "last seen" tracking exists yet. */
  createdMinAgo: number;
  city: string;
  rating?: number;
  shiftsCompleted?: number;
}

export type PayoutStatus = 'paid' | 'processing' | 'dispute';

export interface Transaction {
  id: string;
  workerName: string;
  shiftLabel: string;
  companyName: string;
  amount: number;
  status: PayoutStatus;
  dateLabel: string;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorRoleLabel: string;
  action: string;
  minutesAgo: number;
  tone: 'neutral' | 'danger' | 'accent';
}

export interface VacancyRecord {
  id: string;
  position: string;
  companyName: string;
  city: string;
  hourlyRate: number;
  status: 'active' | 'closed' | 'rejected';
  responses: number;
  publishedMinAgo: number;
}

export interface DashboardDay {
  day: string;
  shifts: number;
  responses: number;
}

export interface DashboardStats {
  vacanciesPublished: number;
  vacanciesPublishedDeltaPct: number;
  closedSameDayPct: number;
  closedSameDayDeltaPp: number;
  activeWorkers: number;
  activeWorkersDeltaPct: number;
  weekly: DashboardDay[];
  topPositions: { label: string; count: number }[];
}
