export interface AdaptationBlockDay {
  date: string;
  tss: number;
  kilojoules: number;
  activityIds: string[];
}

export interface AdaptationBlock {
  total: number;
  averagePerDay: number;
  startDate: string;
  endDate: string;
  activityIds: string[];
  contributingDays: AdaptationBlockDay[];
}

export interface AdaptationWindow {
  days: number;
  bestTss: AdaptationBlock | null;
  bestKilojoules: AdaptationBlock | null;
}

export interface AdaptationEdgesResponse {
  ftpEstimate: number | null;
  totalActivities: number;
  totalKilojoules: number;
  totalTss: number;
  analyzedDays: number;
  windows: AdaptationWindow[];
}
