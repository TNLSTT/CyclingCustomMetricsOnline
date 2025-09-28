export interface AdaptationBlockSummary {
  start: string;
  end: string;
  totalTss: number;
  totalKj: number;
  dayCount: number;
  activityIds: string[];
}

export interface AdaptationWindowSummary {
  windowDays: number;
  bestTss: AdaptationBlockSummary | null;
  bestKj: AdaptationBlockSummary | null;
}

export interface AdaptationEdgesResponse {
  ftpEstimate: number | null;
  windowSummaries: AdaptationWindowSummary[];
}
