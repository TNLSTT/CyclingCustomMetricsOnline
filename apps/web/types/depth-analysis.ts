export interface DepthActivitySummary {
  activityId: string;
  startTime: string;
  totalKj: number;
  depthKj: number;
  depthRatio: number | null;
}

export interface DepthDaySummary {
  date: string;
  totalKj: number;
  depthKj: number;
  depthRatio: number | null;
  movingAverage90: number | null;
  activities: DepthActivitySummary[];
}

export interface DepthAnalysisResponse {
  thresholdKj: number;
  minPowerWatts: number;
  days: DepthDaySummary[];
}
