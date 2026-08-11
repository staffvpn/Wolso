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
}

export type ShiftUrgency = 'normal' | 'urgent';

export interface Shift {
  id: string;
  companyId: string;
  position: Position;
  positionLabel: string;
  date: string; // ISO date, day only
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  hourlyRate: number;
  totalPay: number;
  distanceKm: number;
  description: string;
  tags: string[];
  meal: boolean;
  urgency: ShiftUrgency;
  responseTimeMin: number;
  employmentType: 'shift' | 'permanent' | 'internship';
  timeOfDay: 'morning' | 'day' | 'evening' | 'night';
}

export type ApplicationStatus = 'pending' | 'accepted' | 'declined';
export type WorkStage = 'upcoming' | 'checked_in' | 'completed' | 'reviewed';

export interface Application {
  id: string;
  shiftId: string;
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
  companyId: string;
  contactName: string;
  online: boolean;
  shiftId?: string;
  unread: number;
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

export interface CandidateExperienceEntry {
  role: string;
  place: string;
  period: string;
}

export interface Candidate {
  id: string;
  vacancyId: string;
  name: string;
  position: Position;
  positionLabel: string;
  distanceKm: number;
  rating: number;
  shiftsCompleted: number;
  online: boolean;
  medBook: boolean;
  passportVerified: boolean;
  skills: string[];
  experience: CandidateExperienceEntry[];
  review?: { company: string; text: string };
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
  publishedMinAgo: number;
  status: 'active' | 'closed' | 'draft';
  reach: number;
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
