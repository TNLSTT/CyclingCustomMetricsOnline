import type { GoalTrainingAssessment } from './activity';

export interface ProfileMetricSnapshot {
  activityId: string;
  activityStartTime: string;
  activityDurationSec: number;
  activitySource: string;
  metricVersion?: number;
  metricName?: string;
  metricDescription?: string;
  metricUnits?: string | null;
  computedAt: string;
  summary: Record<string, unknown>;
}

export interface ProfileDurabilitySummary {
  ftpWatts: number | null;
  rideCount: number;
  averageScore: number | null;
  bestScore: number | null;
  bestRide: {
    activityId: string;
    startTime: string;
    durationSec: number;
    normalizedPowerWatts: number | null;
    normalizedPowerPctFtp: number | null;
    heartRateDriftPct: number | null;
    totalKj: number | null;
    tss: number | null;
  } | null;
  totalTrainingLoadKj: number;
  filters: {
    minDurationSec: number;
    startDate: string | null;
    endDate: string | null;
    discipline: string | null;
    keyword: string | null;
  };
  generatedAt: string;
}

export interface ProfileTrainingFrontierSummary {
  ftpWatts: number | null;
  weightKg: number | null;
  hrMaxBpm: number | null;
  hrRestBpm: number | null;
  windowDays: number;
  bestDurationPower: Array<{
    durationSec: number;
    watts: number | null;
    pctFtp: number | null;
    activityId: string | null;
    startTime: string | null;
  }>;
  bestDurabilityEffort:
    | {
        durationSec: number;
        fatigueKj: number;
        value: number | null;
        pctFtp: number | null;
        activityId: string | null;
        startTime: string | null;
      }
    | null;
  bestEfficiencyWindow:
    | {
        durationSec: number;
        wattsPerHeartRate: number | null;
        wattsPerHeartRateReserve: number | null;
        averageWatts: number | null;
        averageHeartRate: number | null;
        activityId: string | null;
        startTime: string | null;
      }
    | null;
  bestTimeInZone:
    | {
        zoneKey: string;
        label: string;
        durationSec: number;
        value: number | null;
        averageWatts: number | null;
        averageHeartRate: number | null;
        activityId: string | null;
        startTime: string | null;
      }
    | null;
  bestRepeatability:
    | {
        targetKey: string;
        reps: number;
        activityId: string | null;
        startTime: string | null;
        startSec: number | null;
        dropFromFirstToLast: number | null;
      }
    | null;
  peakKjPerHour:
    | {
        durationHours: number;
        totalKj: number | null;
        pctFtp: number | null;
        averageWatts: number | null;
        activityId: string | null;
        startTime: string | null;
      }
    | null;
  generatedAt: string;
}

export interface ProfileAdaptationSummary {
  ftpEstimate: number | null;
  bestTssWindow:
    | {
        windowDays: number;
        totalTss: number;
        totalKj: number;
        activityIds: string[];
      }
    | null;
  bestKjWindow:
    | {
        windowDays: number;
        totalKj: number;
        totalTss: number;
        activityIds: string[];
      }
    | null;
  generatedAt: string;
}

export interface ProfileMovingAverageSummary {
  dayCount: number;
  totalKj: number;
  averageDailyKj: number | null;
  recent7DayAverageKj: number | null;
  recent28DayAverageKj: number | null;
  bestPower: Record<string, number | null>;
  lastDate: string | null;
  generatedAt: string;
}

export interface ProfileDepthSummary {
  thresholdKj: number;
  minPowerWatts: number;
  dayCount: number;
  totalKj: number;
  totalDepthKj: number;
  averageDepthRatio: number | null;
  bestDepthDay:
    | {
        date: string;
        depthKj: number;
        depthRatio: number | null;
        totalKj: number;
      }
    | null;
  generatedAt: string;
}

export interface ProfileAnalytics {
  metrics?: Record<string, ProfileMetricSnapshot>;
  durability?: ProfileDurabilitySummary | null;
  trainingFrontiers?: ProfileTrainingFrontierSummary | null;
  adaptationEdges?: ProfileAdaptationSummary | null;
  movingAverages?: ProfileMovingAverageSummary | null;
  depthAnalysis?: ProfileDepthSummary | null;
  lastUpdatedAt?: string;
}

export interface ProfileTarget {
  id: string;
  name: string;
  date: string | null;
  durationHours: number | null;
  distanceKm: number | null;
  criticalEffort:
    | {
        durationMinutes: number | null;
        powerWatts: number | null;
      }
    | null;
  targetAveragePowerWatts: number | null;
  notes: string | null;
}

export interface ProfilePowerBest {
  durationMinutes: number;
  watts: number | null;
}

export interface Profile {
  id: string;
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  primaryDiscipline: string | null;
  trainingFocus: string | null;
  weeklyGoalHours: number | null;
  ftpWatts: number | null;
  weightKg: number | null;
  hrMaxBpm: number | null;
  hrRestBpm: number | null;
  websiteUrl: string | null;
  instagramHandle: string | null;
  achievements: string | null;
  goalTrainingAssessment: GoalTrainingAssessment | null;
  events: ProfileTarget[];
  goals: ProfileTarget[];
  strengths: string | null;
  weaknesses: string | null;
  powerBests: ProfilePowerBest[];
  analytics: ProfileAnalytics | null;
  createdAt: string;
  updatedAt: string;
}
