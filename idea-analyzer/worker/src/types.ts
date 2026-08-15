export interface Env {
  DB: D1Database;
  APP_ORIGIN: string;
  BOT_TOKEN: string;
  WEBHOOK_SECRET: string;
  /** Optional — without it, generateAnalysis() falls back to a rule-based
   *  generator instead of calling the Claude API. See lib/analysis.ts. */
  ANTHROPIC_API_KEY?: string;
}

export type Mode = 'praise' | 'criticize' | 'destroy' | 'monetize';

export interface EconomicsLine {
  label: string;
  value: string;
}

export interface AnalysisResult {
  verdict: string;
  score: number;
  scoreLabel: string;
  audience: string[];
  risks: string[];
  competitors: string[];
  weaknesses: string[];
  checklist: string[];
  economics: EconomicsLine[];
  improvements: string[];
}

export interface UserRow {
  id: number;
  telegram_id: number;
  first_name: string;
  username: string | null;
  free_used: number;
  credits: number;
  pro_until: string | null;
  created_at: string;
}

export interface Entitlement {
  freeAvailable: boolean;
  credits: number;
  isPro: boolean;
  proUntil: string | null;
  canAnalyze: boolean;
}
