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
  name?: string | null;
  distanceMeters?: number | null;
  totalElevationGain?: number | null;
  averagePower?: number | null;
  averageHeartRate?: number | null;
  averageCadence?: number | null;
}

export type NumericLike = number | string;

export interface ActivityTrackPoint {
  lat: NumericLike;
  lon: NumericLike;
  t?: NumericLike;
}

export interface ActivityTrackBounds {
  minLatitude: NumericLike;
  maxLatitude: NumericLike;
  minLongitude: NumericLike;
  maxLongitude: NumericLike;
}

export interface ActivityTrackResponse {
  points: ActivityTrackPoint[];
  bounds: ActivityTrackBounds;
}

export interface PowerStreamSample {
  t: number;
  power: number | null;
}

export interface PowerStreamResponse {
  samples: PowerStreamSample[];
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

export interface UploadSuccess {
  activityId: string;
  fileName: string;
}

export interface UploadFailure {
  fileName: string;
  error: string;
}

export interface UploadResponse {
  uploads: UploadSuccess[];
  failures: UploadFailure[];
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

export interface IntervalEfficiencyHistoryPoint {
  activityId: string;
  activityStartTime: string;
  activityDurationSec: number;
  computedAt: string;
  intervalCount: number;
  averageWPerHr: number | null;
  firstIntervalWPerHr: number | null;
  lastIntervalWPerHr: number | null;
  intervals: IntervalEfficiencyInterval[];
}

export interface IntervalEfficiencyHistoryResponse {
  metric: {
    key: string;
    name: string;
    description: string;
    units?: string | null;
  };
  intervalSeconds: number;
  points: IntervalEfficiencyHistoryPoint[];
}
