export type Role = 'worker' | 'employer';

export type Position =
  | 'barista' | 'waiter' | 'cook' | 'bartender' | 'host' | 'runner' | 'cashier'
  | 'dishwasher' | 'cleaner' | 'promoter' | 'courier' | 'loader' | 'security'
  | 'sommelier' | 'confectioner' | 'admin';

export interface PositionInfo {
  id: Position;
  label: string;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  logoInitial: string;
  logoColor: string;
  rating: number;
  reviewsCount: number;
  verified: boolean;
  inn?: string;
  /** Moderation gate — a company must be `approved` before it can publish
   *  vacancies. Only present on the owner's own `/employer/me` response. */
  verificationStatus?: 'pending_review' | 'approved' | 'rejected';
}

export type ShiftUrgency = 'normal' | 'urgent';

export interface Shift {
  id: string;
  companyId: string;
  /** Embedded by the API on every shift response (the SQL always joins
   *  companies) — read company info from here, not a separate lookup. */
  company?: Company;
  position: Position;
  positionLabel: string;
  date: string; // ISO date, day only
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  hourlyRate: number;
  totalPay: number;
  /** No location source wired up yet (needs Telegram's location API or
   *  geocoding) — undefined until that lands; UI hides the chip when absent. */
  distanceKm?: number;
  description: string;
  tags: string[];
  meal: boolean;
  urgency: ShiftUrgency;
  employmentType: 'shift' | 'permanent' | 'internship';
  timeOfDay: 'morning' | 'day' | 'evening' | 'night';
}

export type ApplicationStatus = 'pending' | 'accepted' | 'declined';
export type WorkStage = 'upcoming' | 'checked_in' | 'completed' | 'reviewed';

export interface Application {
  id: string;
  shiftId: string;
  /** Embedded by the API alongside every application — the shift a given
   *  application is for, company included. */
  shift?: Shift;
  status: ApplicationStatus;
  createdAt: string; // ISO datetime
  workStage?: WorkStage;
  checkInAt?: string;
  checkOutAt?: string;
  tipAmount?: number;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  from: 'me' | 'them';
  text: string;
  createdAt: string;
  kind?: 'text' | 'location' | 'system';
}

export interface Chat {
  id: string;
  companyId?: string;
  workerId?: string;
  contactName: string;
  logoInitial?: string;
  logoColor?: string;
  shiftId?: string;
  unread: number;
  lastMessagePreview?: string;
}

export interface WorkerExperience {
  position: Position;
  positionLabel: string;
  years: number;
}

export interface WorkerDocument {
  id: string;
  label: string;
  status: 'verified' | 'missing' | 'pending';
  note?: string;
}

export interface WorkerReview {
  companyName: string;
  rating: number;
  text: string;
}

export interface WorkerProfile {
  name: string;
  city: string;
  rating: number;
  shiftsCompleted: number;
  profileCompletion: number;
  positions: WorkerExperience[];
  documents: WorkerDocument[];
  reviews: WorkerReview[];
  referralCode: string;
}

export interface Transaction {
  id: string;
  kind: 'payout_in' | 'withdrawal_out';
  title: string;
  subtitle: string;
  amount: number;
  createdAt: string;
}

/** A pending applicant, as seen by the employer swiping candidates.
 *  Fields are limited to what the backend actually knows about a worker —
 *  no fabricated distance/online-presence/skills/reviews. */
export interface Candidate {
  id: string;
  /** The shift (vacancy) this application is for. */
  vacancyId: string;
  workerId: string;
  name: string;
  positionLabel: string;
  rating: number;
  shiftsCompleted: number;
  city: string;
  medBook: boolean;
  status: 'pending' | 'accepted' | 'declined';
}

export interface Vacancy {
  id: string;
  position: Position;
  positionLabel: string;
  date: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  hourlyRate: number;
  requirements: string[];
  urgent: boolean;
  createdAt: string;
  status: 'pending_review' | 'active' | 'rejected';
  responseCount: number;
}

export interface AppNotification {
  id: string;
  kind: 'accepted' | 'new_shifts' | 'message' | 'payout';
  title: string;
  subtitle: string;
  minutesAgo: number;
  read: boolean;
}

export interface Filters {
  positions: Position[];
  rateFrom: number;
  radiusKm: number | 'city';
  urgentOnly: boolean;
  employmentType: 'shift' | 'permanent' | 'internship';
  when: 'today' | 'tomorrow' | 'custom';
  timeOfDay: ('morning' | 'day' | 'evening' | 'night')[];
  verifiedOnly: boolean;
}
