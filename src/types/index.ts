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
  city?: string;
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
  /** ИНН — required to submit for verification (see verificationStatus).
   *  Only present on the owner's own `/employer/me` response. */
  inn?: string;
  /** Admin has to approve a complete profile before it can publish
   *  vacancies or browse candidates — see VerificationGate. Only present
   *  on the owner's own `/employer/me` response. */
  verificationStatus?: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  /** Research notes an AI web search turned up for the admin moderating
   *  this profile — informational only, never shown to the employer. */
  aiSummary?: string;
}

export type ShiftUrgency = 'normal' | 'urgent';

/** What a worker is after. 'any' — both, which is what every anketa
 *  written before the question existed means (see migration 0029). */
export type LookingFor = 'any' | 'shift' | 'permanent';

/** Whether a posting is a one-off (or multi-day) shift or an ongoing job —
 *  picked by the employer when publishing, shown on every card, and
 *  filterable from the worker's feed. */
export type EmploymentType = 'shift' | 'permanent';

export interface Shift {
  id: string;
  companyId: string;
  /** Embedded by the API on every shift response (the SQL always joins
   *  companies) — read company info from here, not a separate lookup. */
  company?: Company;
  position: Position;
  positionLabel: string;
  date: string; // ISO date, day only — first (or only) day
  /** Last day of a multi-day posting — one shift, several consecutive
   *  days, not several separate shifts. Absent means single-day. */
  endDate?: string;
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
  employmentType: EmploymentType;
  timeOfDay: 'morning' | 'day' | 'evening' | 'night';
}

/** 'invited' is a swipe-right/"accept" from the employer that isn't a hire
 *  yet — just an invitation the worker still has to confirm ('accepted')
 *  or turn down ('declined', same as if they'd never been invited).
 *  'cancelled' is either side backing out of an 'invited' or already-
 *  'accepted' application after the fact — always with a reason, see
 *  cancelledBy/cancelReason below. */
export type ApplicationStatus = 'pending' | 'invited' | 'accepted' | 'declined' | 'cancelled';
/** 'employer_closed' is the real "this shift happened" signal now — set
 *  when the employer confirms it, not by worker self-checkout. Both
 *  sides' review becomes mandatory from that point ('reviewed' once the
 *  worker has submitted theirs; the employer's is bundled into the close
 *  action itself, see employer.ts). */
export type WorkStage = 'upcoming' | 'checked_in' | 'employer_closed' | 'reviewed';

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
  closedByEmployerAt?: string;
  /** Only set once status is 'cancelled' — who backed out and why. */
  cancelledBy?: 'worker' | 'employer';
  cancelReason?: string;
  cancelledAt?: string;
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
  avatarUrl?: string;
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

/** One review someone left about you, on either side — the employer's
 *  review of a worker after closing a shift, or the worker's review of
 *  the employer afterwards. `authorName` is whoever wrote it. */
export interface Review {
  id: string;
  rating: number;
  tags: string[];
  comment: string;
  createdAt?: string;
  positionLabel: string;
  shiftDate: string;
  authorName: string;
  authorAvatarUrl?: string;
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
  /** Shifts, permanent work, or both — shown on the anketa employers read
   *  and used by their search filter. */
  lookingFor: LookingFor;
  /** The picture is the one Telegram had at signup, not one they chose.
   *  Drives the "поставьте своё фото" nudge — see Profile.tsx. */
  avatarIsFromTelegram: boolean;
  /** Staff took the anketa out of circulation from the dashboard: no
   *  employer sees it in «найти сотрудников» and new responses are
   *  refused. Everything already agreed keeps working. */
  hidden: boolean;
  /** What staff wrote when hiding it, if anything — shown to the person so
   *  they know what to fix. */
  hiddenReason?: string;
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
  /** What they've done and for how long — the same list they fill in on
   *  their own profile, so the detail view can show real experience
   *  instead of just a position label. */
  experience?: { positionLabel: string; months: number }[];
  /** Avatar first, then any portfolio photos — the card taps through this
   *  whole list left-to-right, Tinder-style. */
  photos: string[];
  /** What they're looking for — undefined on an API that predates
   *  migration 0029, in which case the card simply doesn't show it. */
  lookingFor?: LookingFor;
}

/** A pending applicant, as seen by the employer swiping candidates. */
export interface Candidate extends CandidateProfile {
  /** The shift (vacancy) this application is for. */
  vacancyId: string;
  status: ApplicationStatus;
  workStage?: WorkStage;
  closedByEmployerAt?: string;
  cancelledBy?: 'worker' | 'employer';
  cancelReason?: string;
  cancelledAt?: string;
}

/** A worker the employer is browsing directly (not tied to any one
 *  vacancy) — the "find staff" deck, filtered by the positions they pick. */
export type WorkerListing = CandidateProfile;

export interface Vacancy {
  id: string;
  position: Position;
  positionLabel: string;
  date: string;
  endDate?: string;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  hourlyRate: number;
  requirements: string[];
  /** What the employer wrote in «Описание» — carried so the edit form can
   *  prefill it instead of silently blanking it on save. */
  description: string;
  employmentType: EmploymentType;
  urgent: boolean;
  createdAt: string;
  status: 'pending_review' | 'active' | 'rejected' | 'closed';
  responseCount: number;
}

export interface AppNotification {
  id: string;
  kind:
    | 'accepted'
    | 'new_shifts'
    | 'message'
    | 'payout'
    | 'shift_closed'
    | 'invited'
    | 'invite_accepted'
    | 'invite_declined'
    | 'cancelled_by_employer'
    | 'cancelled_by_worker';
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
  /** 'any' is the default — the feed used to default to 'shift', which
   *  silently hid every permanent posting until someone opened filters. */
  employmentType: EmploymentType | 'any';
  /** 'upcoming' (default, no explicit chip selected) shows every shift from
   *  today onward — 'today'/'tomorrow' are deliberate narrowing filters a
   *  worker picks in the sheet, 'custom' means "dates I picked" but isn't
   *  actually wired to specific dates yet, so it also shows everything. */
  when: 'upcoming' | 'today' | 'tomorrow' | 'custom';
  timeOfDay: ('morning' | 'day' | 'evening' | 'night')[];
}
