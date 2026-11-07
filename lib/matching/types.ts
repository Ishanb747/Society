export interface BankTxn {
  date: Date;
  amount: number; // credit, whole rupees
  narration: string;
  utr: string | null;
  vpa: string | null;
}

export interface FlatSnapshot {
  id: string;
  outstanding: number; // total due right now, incl. late fee
  billAmount: number; // one month's bill
  upiIds: string[];
  surnames: string[];
}

export interface Candidate {
  flatId: string;
  score: number;
  reasons: string[];
}

export type MatchStatus = "AUTO_POSTED" | "REVIEW" | "UNMATCHED";

export interface MatchResult {
  status: MatchStatus;
  flatId: string | null; // posted flat (AUTO_POSTED) or best suggestion (REVIEW)
  score: number;
  reasons: string[];
  candidates: Candidate[];
}
