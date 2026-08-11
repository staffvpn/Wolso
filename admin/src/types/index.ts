export type PermissionKey =
  | 'approveVacancies'
  | 'blockUsers'
  | 'verifyDocuments'
  | 'viewSupportChats'
  | 'refundsPayouts'
  | 'changeCommission'
  | 'manageTeam'
  | 'transferOwnership';

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

export type UserStatus = 'active' | 'invited' | 'suspended' | 'pending_docs';

export interface MemberAccess {
  moderation: boolean;
  finance: boolean;
  team: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  roleId: string;
  access?: MemberAccess;
  status: UserStatus;
  lastActiveMinAgo: number;
  since: number; // year
}

export type PlatformUserKind = 'seeker' | 'employer';

export interface PlatformUser {
  id: string;
  kind: PlatformUserKind;
  name: string;
  contact: string;
  status: UserStatus;
  statusLabel: string;
  lastActiveMinAgo: number;
  city: string;
  rating?: number;
  shiftsCompleted?: number;
  companyInn?: string;
  verified?: boolean;
}

export type ModerationStatus = 'pending' | 'approved' | 'returned' | 'rejected';

export interface ModerationFlag {
  label: string;
  tone: 'danger' | 'warning' | 'info' | 'neutral';
}

export interface ModerationVacancy {
  id: string;
  position: string;
  companyName: string;
  companyInn: string;
  companyRating: number;
  city: string;
  submittedMinAgo: number;
  flag: ModerationFlag | null;
  status: ModerationStatus;
  hourlyRate: number;
  regionalMinWage: number;
  durationHours: number;
  address: string;
  experienceReq: string;
  description: string;
  shiftsPosted: number;
}

export interface ComplaintItem {
  id: string;
  targetName: string;
  targetType: 'worker' | 'employer';
  reporterName: string;
  reason: string;
  text: string;
  submittedMinAgo: number;
  status: ModerationStatus;
}

export interface DocumentReview {
  id: string;
  applicantName: string;
  docType: string;
  applicantCity: string;
  applicantRating: number;
  submittedMinAgo: number;
  status: ModerationStatus;
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
  status: 'active' | 'moderation' | 'closed' | 'rejected';
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
  payoutVolume: number;
  platformCommission: number;
  weekly: DashboardDay[];
  topPositions: { label: string; count: number }[];
  attention: { label: string; count: number; tone: 'danger' | 'warning' | 'info' }[];
}
