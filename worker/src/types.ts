export interface Env {
  DB: D1Database;
  ADMIN_ORIGIN: string;
  APP_ORIGIN: string;
  BOT_TOKEN: string;
  SESSION_SECRET: string;
  OWNER_TELEGRAM_ID?: string;
  /** Optional — powers the AI legal-entity check on employer verification
   *  (see lib/aiVerification.ts). Without it, verification still works as
   *  a purely human review; the AI summary is just never populated. */
  ANTHROPIC_API_KEY?: string;
}

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

/** What we put in a signed session token. */
export type SessionPayload =
  | { kind: 'worker'; workerId: number; telegramId: number; exp: number }
  | { kind: 'company'; companyId: number; telegramId: number; exp: number }
  | { kind: 'staff'; staffId: number; telegramId: number; roleId: string; exp: number };

/** `Omit<Union, K>` collapses to shared keys only — this distributes it
 *  over each member so the discriminant + per-kind fields survive. */
export type SessionPayloadInput = SessionPayload extends infer T ? (T extends SessionPayload ? Omit<T, 'exp'> : never) : never;
