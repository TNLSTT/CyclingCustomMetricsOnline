export interface MetricSummary {
  key: string;
  summary: Record<string, unknown>;
  computedAt: string;
}

export interface ActivitySummary {
  id: string;
  source: string;
  startTime: string;
  durationSec: number;
  sampleRateHz: number | null;
  createdAt: string;
  metrics: MetricSummary[];
}

export interface PaginatedActivities {
  data: ActivitySummary[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MetricDefinition {
  key: string;
  name: string;
  version: number;
  description: string;
  units?: string | null;
  computeConfig?: Record<string, unknown> | null;
}

export interface MetricResultDetail {
  key: string;
  definition: MetricDefinition;
  summary: Record<string, unknown>;
  series?: unknown;
  computedAt: string;
}

export interface UploadResponse {
  activityId: string;
}

export interface ComputeMetricsResponse {
  activityId: string;
  results: Record<string, unknown>;
}

export interface IntervalEfficiencyInterval {
  interval: number | null;
  avg_power: number | null;
  avg_hr: number | null;
  avg_cadence: number | null;
  avg_temp: number | null;
  w_per_hr: number | null;
}

export interface IntervalEfficiencyResponse {
  intervals: IntervalEfficiencyInterval[];
  intervalSeconds: number;
  computedAt: string;
}
