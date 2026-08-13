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
  telegramId: number;
  telegramUsername?: string;
}

export interface UserPosition {
  id: string;
  position: string;
  positionLabel: string;
  months: number;
}

export interface UserPhoto {
  id: string;
  url: string;
}

export interface SeekerApplication {
  id: string;
  status: string;
  workStage: string;
  rating: number | null;
  cancelledBy: 'worker' | 'employer' | null;
  cancelReason: string | null;
  createdAt: string;
  positionLabel: string;
  date: string;
  startHour: number;
  startMin: number;
  companyName: string;
}

/** Everything the person themselves filled in, plus their application
 *  history — fetched only once a specific card is opened, the list stays
 *  on the thin PlatformUser shape. */
export interface SeekerDetail {
  id: string;
  name: string;
  telegramId: number;
  telegramUsername?: string;
  city: string;
  bio: string;
  skills: string;
  birthdate?: string;
  avatarUrl?: string;
  rating: number;
  shiftsCompleted: number;
  status: UserStatus;
  createdAt: string;
  positions: UserPosition[];
  photos: UserPhoto[];
  applications: SeekerApplication[];
}

export interface EmployerVacancy {
  id: string;
  positionLabel: string;
  date: string;
  status: string;
  responseCount: number;
}

export interface EmployerDetail {
  id: string;
  name: string;
  telegramId: number;
  telegramUsername?: string;
  address?: string;
  city: string;
  description: string;
  foundedYear?: number;
  avatarUrl?: string;
  rating: number;
  reviewsCount: number;
  status: UserStatus;
  createdAt: string;
  photos: UserPhoto[];
  vacancies: EmployerVacancy[];
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
