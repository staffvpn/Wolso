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
  /** Uploaded main photo — undefined until the employer uploads one, in
   *  which case UI falls back to the colored logoInitial badge. */
  avatarUrl?: string;
  description?: string;
  foundedYear?: number;
  /** Only present on the owner's own `/employer/me` response. */
  profileComplete?: boolean;
  profileCompletion?: number;
  photos?: { id: string; url: string }[];
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
  id: string;
  position: Position;
  positionLabel: string;
  months: number;
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
  profileComplete: boolean;
  positions: WorkerExperience[];
  reviews: WorkerReview[];
  referralCode: string;
  bio: string;
  skills: string;
  birthdate?: string;
  age?: number;
  avatarUrl?: string;
  photos: { id: string; url: string }[];
}

export interface Transaction {
  id: string;
  kind: 'payout_in' | 'withdrawal_out';
  title: string;
  subtitle: string;
  amount: number;
  createdAt: string;
}

/** Shared by both "someone who applied to my shift" (Candidate) and
 *  "someone I'm browsing directly" (WorkerListing) — CandidateCard only
 *  ever needs this much. Fields are limited to what the backend actually
 *  knows about a worker — no fabricated distance/online-presence/reviews. */
export interface CandidateProfile {
  id: string;
  workerId: string;
  name: string;
  positionLabel: string;
  rating: number;
  shiftsCompleted: number;
  city: string;
  bio?: string;
  skills?: string;
  age?: number;
  /** Avatar first, then any portfolio photos — the card taps through this
   *  whole list left-to-right, Tinder-style. */
  photos: string[];
}

/** A pending applicant, as seen by the employer swiping candidates. */
export interface Candidate extends CandidateProfile {
  /** The shift (vacancy) this application is for. */
  vacancyId: string;
  status: 'pending' | 'accepted' | 'declined';
}

/** A worker the employer is browsing directly (not tied to any one
 *  vacancy) — the "find staff" deck, filtered by the positions they pick. */
export type WorkerListing = CandidateProfile;

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
  /** 'upcoming' (default, no explicit chip selected) shows every shift from
   *  today onward — 'today'/'tomorrow' are deliberate narrowing filters a
   *  worker picks in the sheet, 'custom' means "dates I picked" but isn't
   *  actually wired to specific dates yet, so it also shows everything. */
  when: 'upcoming' | 'today' | 'tomorrow' | 'custom';
  timeOfDay: ('morning' | 'day' | 'evening' | 'night')[];
}
