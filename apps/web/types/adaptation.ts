export interface AdaptationBlockSummary {
  start: string;
  end: string;
  totalTrainingLoad: number;
  totalKj: number;
  dayCount: number;
  activityIds: string[];
}

export interface AdaptationWindowSummary {
  windowDays: number;
  bestTrainingLoad: AdaptationBlockSummary | null;
  bestKj: AdaptationBlockSummary | null;
}

export interface AdaptationEdgesResponse {
  ftpEstimate: number | null;
  windowSummaries: AdaptationWindowSummary[];
}
