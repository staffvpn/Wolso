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
  /** Whether the bot can still reach them — see BotStatus. */
  botStatus: BotStatus;
  /** When that was last established, ISO. */
  botStatusAt?: string;
}

/** Mirrors the worker's BotStatus. 'unknown' means nothing has told us
 *  either way yet, which is every account until a notification is sent to
 *  it or the check is run. */
export type BotStatus = 'active' | 'blocked' | 'deleted' | 'unreachable' | 'unknown';

export const BOT_STATUS_LABEL: Record<BotStatus, string> = {
  active: 'Бот активен',
  blocked: 'Заблокировал бота',
  deleted: 'Аккаунт удалён',
  unreachable: 'Не запускал бота',
  unknown: 'Не проверялся',
};

/** Short form for the table column, where the full label crowds the row. */
export const BOT_STATUS_SHORT: Record<BotStatus, string> = {
  active: 'Активен',
  blocked: 'Заблокировал',
  deleted: 'Удалён',
  unreachable: 'Нет чата',
  unknown: '—',
};

export const BOT_STATUS_TONE: Record<BotStatus, 'accent' | 'danger' | 'warning' | 'neutral'> = {
  active: 'accent',
  blocked: 'danger',
  deleted: 'danger',
  unreachable: 'warning',
  unknown: 'neutral',
};

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
  reviewsReceived: AdminReview[];
  reviewsGiven: AdminReview[];
}

/** One review, as shown in the dashboard. `counterpartyName` is whoever
 *  is on the other side of it — the company for a review a worker
 *  received, the worker for a review a company received. */
export interface AdminReview {
  id: string;
  rating: number;
  tags: string[];
  comment: string;
  createdAt?: string;
  positionLabel: string;
  shiftDate: string;
  counterpartyName: string;
}

export interface EmployerVacancy {
  id: string;
  positionLabel: string;
  date: string;
  endDate?: string;
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
  reviewsReceived: AdminReview[];
  reviewsGiven: AdminReview[];
}

/** An employer's profile awaiting (or already given) an admin decision on
 *  whether the legal entity behind it looks real — separate from vacancy
 *  moderation, and from the plain "is the profile filled in" check. */
export interface EmployerVerification {
  id: string;
  name: string;
  inn?: string;
  city: string;
  address?: string;
  description: string;
  foundedYear?: number;
  avatarUrl?: string;
  telegramId: number;
  telegramUsername?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  /** Research notes an AI web search turned up — informational only, the
   *  admin still makes the actual call. Undefined until a check has run
   *  (e.g. no ANTHROPIC_API_KEY configured, or the check hasn't fired yet). */
  aiSummary?: string;
  aiCheckedAt?: string;
  createdAt: string;
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

export type BroadcastAudience = 'all' | 'seekers' | 'employers';

/** A message sent from the bot to a whole audience at once. Sending runs
 *  in batches, so a row can be partially delivered — `done` is what tells
 *  a finished broadcast from an interrupted one. */
export interface Broadcast {
  id: string;
  text: string;
  audience: BroadcastAudience;
  city?: string;
  total: number;
  sent: number;
  failed: number;
  done: boolean;
  createdBy: string;
  createdAt: string;
}

export interface BroadcastProgress {
  id: number;
  processed: number;
  total: number;
  sent: number;
  failed: number;
  done: boolean;
}
