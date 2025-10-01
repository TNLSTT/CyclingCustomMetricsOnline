export interface DurationPowerPoint {
  durationSec: number;
  value: number | null;
  pctFtp?: number | null;
  activityId: string | null;
  startTime: string | null;
  windowStartSec: number | null;
}

export interface KjFrontierPoint {
  durationHours: number;
  value: number | null;
  pctFtp?: number | null;
  averageWatts: number | null;
  totalKj: number | null;
  activityId: string | null;
  startTime: string | null;
  windowStartSec: number | null;
}

export interface DurationPowerFrontier {
  durations: DurationPowerPoint[];
  convexHull: DurationPowerPoint[];
  kjFrontier: KjFrontierPoint[];
  peakKjPerHour: KjFrontierPoint | null;
}

export interface DurabilityEffort {
  fatigueKj: number;
  durationSec: number;
  value: number | null;
  pctFtp: number | null;
  deltaWatts: number | null;
  deltaPct: number | null;
  activityId: string | null;
  startTime: string | null;
  windowStartSec: number | null;
}

export interface DurabilityFrontier {
  efforts: DurabilityEffort[];
}

export interface EfficiencyWindow {
  durationSec: number;
  value: number | null;
  pctFtp: number | null;
  averageWatts: number | null;
  averageHeartRate: number | null;
  wattsPerBpm: number | null;
  wattsPerHeartRateReserve: number | null;
  cadenceCoverage: number;
  movingCoverage: number;
  activityId: string | null;
  startTime: string | null;
  windowStartSec: number | null;
}

export interface EfficiencyFrontier {
  windows: EfficiencyWindow[];
}

export interface RepeatabilitySequence {
  targetKey: string;
  activityId: string;
  startTime: string;
  startSec: number;
  reps: number;
  avgWattsByRep: number[];
  avgPctByRep: number[];
  decaySlope: number;
  dropFromFirstToLast: number;
}

export interface RepeatabilityFrontier {
  sequences: RepeatabilitySequence[];
  bestRepeatability: Array<{
    targetKey: string;
    reps: number;
    activityId: string | null;
    startTime: string | null;
    startSec: number | null;
  }>;
}

export interface ZoneStreakSummary {
  zoneKey: string;
  label: string;
  minPct: number;
  maxPct: number | null;
  durationSec: number;
  value: number | null;
  averageWatts: number | null;
  averageHeartRate: number | null;
  activityId: string | null;
  startTime: string | null;
  windowStartSec: number | null;
}

export interface TimeInZoneFrontier {
  streaks: ZoneStreakSummary[];
}

export interface TrainingFrontiersResponse {
  windowDays: number;
  ftpWatts: number | null;
  weightKg: number | null;
  hrMaxBpm: number | null;
  hrRestBpm: number | null;
  durationPower: DurationPowerFrontier;
  durability: DurabilityFrontier;
  efficiency: EfficiencyFrontier;
  repeatability: RepeatabilityFrontier;
  timeInZone: TimeInZoneFrontier;
}
