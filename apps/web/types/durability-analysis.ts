export interface DurabilityTimeSeriesPoint {
  t: number;
  power: number | null;
  heartRate: number | null;
}

export interface DurabilitySegmentMetrics {
  label: 'early' | 'middle' | 'late';
  startSec: number;
  endSec: number;
  durationSec: number;
  stabilizedPowerWatts: number | null;
  stabilizedPowerPctFtp: number | null;
  averagePowerWatts: number | null;
  averageHeartRateBpm: number | null;
  heartRatePowerRatio: number | null;
}

export interface DurabilityRideAnalysis {
  activityId: string;
  startTime: string;
  source: string;
  durationSec: number;
  ftpWatts: number | null;
  stabilizedPowerWatts: number | null;
  stabilizedPowerPctFtp: number | null;
  averagePowerWatts: number | null;
  averageHeartRateBpm: number | null;
  totalKj: number | null;
  trainingLoadScore: number | null;
  heartRateDriftPct: number | null;
  bestLateTwentyMinWatts: number | null;
  bestLateTwentyMinPctFtp: number | null;
  durabilityScore: number;
  segments: {
    early: DurabilitySegmentMetrics;
    middle: DurabilitySegmentMetrics;
    late: DurabilitySegmentMetrics;
  };
  timeSeries: DurabilityTimeSeriesPoint[];
}

export interface DurabilityAnalysisResponse {
  ftpWatts: number | null;
  filters: {
    minDurationSec: number;
    startDate?: string;
    endDate?: string;
    discipline?: string;
    keyword?: string;
  };
  rides: DurabilityRideAnalysis[];
  disciplines: string[];
}
