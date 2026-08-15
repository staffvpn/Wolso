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

export interface Entitlement {
  freeAvailable: boolean;
  credits: number;
  isPro: boolean;
  proUntil: string | null;
  canAnalyze: boolean;
}

export interface HistoryItem {
  id: number;
  ideaText: string;
  mode: Mode;
  verdict: string;
  score: number;
  createdAt: string;
}

export interface HistoryDetail extends HistoryItem {
  result: AnalysisResult;
}
