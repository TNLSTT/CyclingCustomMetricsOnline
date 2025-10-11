import { prisma } from '../prisma.js';
import { normalizeNullableJson } from '../utils/prismaJson.js';

import type { MetricComputationResult } from '../metrics/types.js';
import type { TrainingFrontiersResponse } from './trainingFrontiersService.js';
import type { DurabilityAnalysisResponse } from './durabilityAnalysisService.js';
import type { AdaptationEdgesAnalysis } from './adaptationEdgesService.js';
import type { MovingAverageDay } from './movingAveragesService.js';
import type { DepthAnalysisResponse } from './depthAnalysisService.js';

type JsonRecord = Record<string, unknown>;

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
  summary: JsonRecord;
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toProfileAnalytics(value: unknown): ProfileAnalytics {
  if (!isObject(value)) {
    return {};
  }

  const analytics: ProfileAnalytics = {};

  if (isObject(value.metrics)) {
    analytics.metrics = value.metrics as Record<string, ProfileMetricSnapshot>;
  }
  if ('durability' in value && value.durability) {
    analytics.durability = value.durability as ProfileDurabilitySummary;
  }
  if ('trainingFrontiers' in value && value.trainingFrontiers) {
    analytics.trainingFrontiers = value.trainingFrontiers as ProfileTrainingFrontierSummary;
  }
  if ('adaptationEdges' in value && value.adaptationEdges) {
    analytics.adaptationEdges = value.adaptationEdges as ProfileAdaptationSummary;
  }
  if ('movingAverages' in value && value.movingAverages) {
    analytics.movingAverages = value.movingAverages as ProfileMovingAverageSummary;
  }
  if ('depthAnalysis' in value && value.depthAnalysis) {
    analytics.depthAnalysis = value.depthAnalysis as ProfileDepthSummary;
  }
  if (typeof value.lastUpdatedAt === 'string') {
    analytics.lastUpdatedAt = value.lastUpdatedAt;
  }

  return analytics;
}

function hasPartialUpdate(partial: ProfileAnalytics): boolean {
  return (
    (partial.metrics && Object.keys(partial.metrics).length > 0) ||
    partial.durability != null ||
    partial.trainingFrontiers != null ||
    partial.adaptationEdges != null ||
    partial.movingAverages != null ||
    partial.depthAnalysis != null
  );
}

function mergeAnalytics(base: ProfileAnalytics, partial: ProfileAnalytics): ProfileAnalytics {
  const merged: ProfileAnalytics = { ...base };

  if (partial.metrics) {
    merged.metrics = { ...(base.metrics ?? {}), ...partial.metrics };
  }

  if (partial.durability !== undefined) {
    merged.durability = partial.durability ?? null;
  }

  if (partial.trainingFrontiers !== undefined) {
    merged.trainingFrontiers = partial.trainingFrontiers ?? null;
  }

  if (partial.adaptationEdges !== undefined) {
    merged.adaptationEdges = partial.adaptationEdges ?? null;
  }

  if (partial.movingAverages !== undefined) {
    merged.movingAverages = partial.movingAverages ?? null;
  }

  if (partial.depthAnalysis !== undefined) {
    merged.depthAnalysis = partial.depthAnalysis ?? null;
  }

  merged.lastUpdatedAt = new Date().toISOString();
  return merged;
}

export async function mergeProfileAnalytics(userId: string, partial: ProfileAnalytics): Promise<void> {
  if (!hasPartialUpdate(partial)) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.profile.findUnique({
      where: { userId },
      select: { analytics: true },
    });

    const base = existing?.analytics ?? {};
    const merged = mergeAnalytics(toProfileAnalytics(base), partial);

    if (existing) {
      await tx.profile.update({
        where: { userId },
        data: { analytics: normalizeNullableJson(merged) },
      });
      return;
    }

    await tx.profile.create({
      data: {
        userId,
        analytics: normalizeNullableJson(merged),
      },
    });
  });
}

function roundNumber(value: number, fractionDigits: number): number {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function safeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

export interface ProfileMetricMetadata {
  metricVersion?: number;
  metricName?: string;
  metricDescription?: string;
  metricUnits?: string | null;
}

export function buildMetricSnapshots(
  activity: { id: string; startTime: Date; durationSec: number; source: string },
  metricMetadata: Record<string, ProfileMetricMetadata>,
  results: Record<string, MetricComputationResult>,
): Record<string, ProfileMetricSnapshot> {
  const computedAt = new Date().toISOString();
  const snapshots: Record<string, ProfileMetricSnapshot> = {};

  for (const [key, result] of Object.entries(results)) {
    if (!result || !isObject(result.summary)) {
      continue;
    }

    const metadata = metricMetadata[key] ?? {};

    snapshots[key] = {
      activityId: activity.id,
      activityStartTime: activity.startTime.toISOString(),
      activityDurationSec: activity.durationSec,
      activitySource: activity.source,
      metricVersion: metadata.metricVersion,
      metricName: metadata.metricName,
      metricDescription: metadata.metricDescription,
      metricUnits: metadata.metricUnits ?? null,
      computedAt,
      summary: { ...(result.summary as JsonRecord) },
    };
  }

  return snapshots;
}

export function summarizeDurabilityAnalysis(
  analysis: DurabilityAnalysisResponse,
): ProfileDurabilitySummary {
  const rideCount = analysis.rides.length;
  const totalScore = analysis.rides.reduce((sum, ride) => sum + (ride.durabilityScore ?? 0), 0);
  const bestRide = analysis.rides.reduce<typeof analysis.rides[number] | null>((best, ride) => {
    if (!best) {
      return ride;
    }
    if ((ride.durabilityScore ?? 0) > (best.durabilityScore ?? 0)) {
      return ride;
    }
    return best;
  }, null);
  const totalKj = analysis.rides.reduce((sum, ride) => sum + (ride.totalKj ?? 0), 0);

  return {
    ftpWatts: analysis.ftpWatts ?? null,
    rideCount,
    averageScore: rideCount > 0 ? roundNumber(totalScore / rideCount, 1) : null,
    bestScore: bestRide?.durabilityScore ?? null,
    bestRide:
      bestRide != null
        ? {
            activityId: bestRide.activityId,
            startTime: bestRide.startTime,
            durationSec: bestRide.durationSec,
            normalizedPowerWatts: bestRide.normalizedPowerWatts ?? null,
            normalizedPowerPctFtp: bestRide.normalizedPowerPctFtp ?? null,
            heartRateDriftPct: bestRide.heartRateDriftPct ?? null,
            totalKj: bestRide.totalKj ?? null,
            tss: bestRide.tss ?? null,
          }
        : null,
    totalTrainingLoadKj: roundNumber(totalKj, 1),
    filters: {
      minDurationSec: analysis.filters.minDurationSec,
      startDate: analysis.filters.startDate ? analysis.filters.startDate.toISOString() : null,
      endDate: analysis.filters.endDate ? analysis.filters.endDate.toISOString() : null,
      discipline: analysis.filters.discipline ?? null,
      keyword: analysis.filters.keyword ?? null,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeTrainingFrontiers(
  response: TrainingFrontiersResponse,
): ProfileTrainingFrontierSummary {
  const bestDurations = [...response.durationPower.durations]
    .filter((point) => point.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
    .slice(0, 5)
    .map((point) => ({
      durationSec: point.durationSec,
      watts: safeNumber(point.value ?? null),
      pctFtp: safeNumber(point.pctFtp ?? null),
      activityId: point.activityId ?? null,
      startTime: point.startTime ?? null,
    }));

  const bestDurability = response.durability.efforts.reduce<
    | {
        durationSec: number;
        fatigueKj: number;
        value: number | null;
        pctFtp: number | null;
        activityId: string | null;
        startTime: string | null;
      }
    | null
  >((best, effort) => {
    if (effort.value == null) {
      return best;
    }
    if (!best || (effort.value ?? 0) > (best.value ?? 0)) {
      return {
        durationSec: effort.durationSec,
        fatigueKj: effort.fatigueKj,
        value: safeNumber(effort.value),
        pctFtp: safeNumber(effort.pctFtp ?? null),
        activityId: effort.activityId ?? null,
        startTime: effort.startTime ?? null,
      };
    }
    return best;
  }, null);

  const bestEfficiency = response.efficiency.windows.reduce<
    | {
        durationSec: number;
        wattsPerHeartRate: number | null;
        wattsPerHeartRateReserve: number | null;
        averageWatts: number | null;
        averageHeartRate: number | null;
        activityId: string | null;
        startTime: string | null;
      }
    | null
  >((best, window) => {
    if (window.wattsPerBpm == null) {
      return best;
    }
    if (!best || (window.wattsPerBpm ?? 0) > (best.wattsPerHeartRate ?? 0)) {
      return {
        durationSec: window.durationSec,
        wattsPerHeartRate: safeNumber(window.wattsPerBpm),
        wattsPerHeartRateReserve: safeNumber(window.wattsPerHeartRateReserve ?? null),
        averageWatts: safeNumber(window.averageWatts ?? null),
        averageHeartRate: safeNumber(window.averageHeartRate ?? null),
        activityId: window.activityId ?? null,
        startTime: window.startTime ?? null,
      };
    }
    return best;
  }, null);

  const bestTimeInZone = response.timeInZone.streaks.reduce<
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
    | null
  >((best, streak) => {
    if (!best || streak.durationSec > best.durationSec) {
      return {
        zoneKey: streak.zoneKey,
        label: streak.label,
        durationSec: streak.durationSec,
        value: safeNumber(streak.value ?? null),
        averageWatts: safeNumber(streak.averageWatts ?? null),
        averageHeartRate: safeNumber(streak.averageHeartRate ?? null),
        activityId: streak.activityId ?? null,
        startTime: streak.startTime ?? null,
      };
    }
    return best;
  }, null);

  const bestRepeatability = response.repeatability.bestRepeatability.reduce<
    | {
        targetKey: string;
        reps: number;
        activityId: string | null;
        startTime: string | null;
        startSec: number | null;
        dropFromFirstToLast: number | null;
      }
    | null
  >((best, entry) => {
    const matchingSequence = response.repeatability.sequences.find((sequence) => {
      if (
        sequence.targetKey !== entry.targetKey ||
        sequence.activityId !== entry.activityId ||
        sequence.startTime !== entry.startTime
      ) {
        return false;
      }
      if (entry.startSec != null && sequence.startSec !== entry.startSec) {
        return false;
      }
      return true;
    });
    const drop = safeNumber(matchingSequence?.dropFromFirstToLast ?? null);
    const candidate = {
      targetKey: entry.targetKey,
      reps: entry.reps,
      activityId: entry.activityId ?? null,
      startTime: entry.startTime ?? null,
      startSec: entry.startSec ?? null,
      dropFromFirstToLast: drop,
    };

    if (!best) {
      return candidate;
    }

    if (candidate.reps > best.reps) {
      return candidate;
    }

    if (
      candidate.reps === best.reps &&
      (candidate.dropFromFirstToLast ?? Number.POSITIVE_INFINITY) <
        (best.dropFromFirstToLast ?? Number.POSITIVE_INFINITY)
    ) {
      return candidate;
    }

    return best;
  }, null);

  const peakKjPerHour = response.durationPower.peakKjPerHour
    ? {
        durationHours: response.durationPower.peakKjPerHour.durationHours,
        totalKj: safeNumber(response.durationPower.peakKjPerHour.totalKj ?? null),
        pctFtp: safeNumber(response.durationPower.peakKjPerHour.pctFtp ?? null),
        averageWatts: safeNumber(response.durationPower.peakKjPerHour.averageWatts ?? null),
        activityId: response.durationPower.peakKjPerHour.activityId ?? null,
        startTime: response.durationPower.peakKjPerHour.startTime ?? null,
      }
    : null;

  return {
    ftpWatts: response.ftpWatts ?? null,
    weightKg: response.weightKg ?? null,
    hrMaxBpm: response.hrMaxBpm ?? null,
    hrRestBpm: response.hrRestBpm ?? null,
    windowDays: response.windowDays,
    bestDurationPower: bestDurations,
    bestDurabilityEffort: bestDurability,
    bestEfficiencyWindow: bestEfficiency,
    bestTimeInZone: bestTimeInZone,
    bestRepeatability,
    peakKjPerHour,
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeAdaptationEdges(
  analysis: AdaptationEdgesAnalysis,
): ProfileAdaptationSummary {
  const bestTssWindow = analysis.windowSummaries.reduce<
    | {
        windowDays: number;
        totalTss: number;
        totalKj: number;
        activityIds: string[];
      }
    | null
  >((best, summary) => {
    if (!summary.bestTss) {
      return best;
    }
    if (!best || summary.bestTss.totalTss > best.totalTss) {
      return {
        windowDays: summary.windowDays,
        totalTss: summary.bestTss.totalTss,
        totalKj: summary.bestTss.totalKj,
        activityIds: [...summary.bestTss.activityIds],
      };
    }
    return best;
  }, null);

  const bestKjWindow = analysis.windowSummaries.reduce<
    | {
        windowDays: number;
        totalKj: number;
        totalTss: number;
        activityIds: string[];
      }
    | null
  >((best, summary) => {
    if (!summary.bestKj) {
      return best;
    }
    if (!best || summary.bestKj.totalKj > best.totalKj) {
      return {
        windowDays: summary.windowDays,
        totalKj: summary.bestKj.totalKj,
        totalTss: summary.bestKj.totalTss,
        activityIds: [...summary.bestKj.activityIds],
      };
    }
    return best;
  }, null);

  return {
    ftpEstimate: analysis.ftpEstimate ?? null,
    bestTssWindow,
    bestKjWindow,
    generatedAt: new Date().toISOString(),
  };
}

const POWER_KEYS = ['60', '300', '1200', '3600', '10800', '14400'] as const;

export function summarizeMovingAverages(days: MovingAverageDay[]): ProfileMovingAverageSummary {
  const totalKj = days.reduce((sum, day) => sum + (day.totalKj ?? 0), 0);
  const dayCount = days.length;

  const recentAverage = (window: number): number | null => {
    if (days.length === 0) {
      return null;
    }
    const slice = days.slice(-window);
    if (slice.length === 0) {
      return null;
    }
    const total = slice.reduce((sum, day) => sum + (day.totalKj ?? 0), 0);
    return roundNumber(total / slice.length, 2);
  };

  const bestPower: Record<string, number | null> = {};
  for (const key of POWER_KEYS) {
    let max: number | null = null;
    for (const day of days) {
      const value = day.bestPower[key] ?? null;
      if (value != null && (max == null || value > max)) {
        max = value;
      }
    }
    bestPower[key] = max;
  }

  return {
    dayCount,
    totalKj: roundNumber(totalKj, 2),
    averageDailyKj: dayCount > 0 ? roundNumber(totalKj / dayCount, 2) : null,
    recent7DayAverageKj: recentAverage(7),
    recent28DayAverageKj: recentAverage(28),
    bestPower,
    lastDate: days.length > 0 ? days[days.length - 1]!.date : null,
    generatedAt: new Date().toISOString(),
  };
}

export function summarizeDepthAnalysis(response: DepthAnalysisResponse): ProfileDepthSummary {
  const totals = response.days.reduce(
    (acc, day) => {
      const totalKj = day.totalKj ?? 0;
      const depthKj = day.depthKj ?? 0;
      const ratio = day.depthRatio ?? null;

      return {
        totalKj: acc.totalKj + totalKj,
        depthKj: acc.depthKj + depthKj,
        ratios: ratio != null ? acc.ratios.concat(ratio) : acc.ratios,
        best: !acc.best || depthKj > acc.best.depthKj
          ? { date: day.date, depthKj, depthRatio: ratio, totalKj }
          : acc.best,
      };
    },
    { totalKj: 0, depthKj: 0, ratios: [] as number[], best: null as null | { date: string; depthKj: number; depthRatio: number | null; totalKj: number } },
  );

  const averageDepthRatio = totals.ratios.length > 0
    ? roundNumber(
        totals.ratios.reduce((sum, value) => sum + value, 0) / totals.ratios.length,
        1,
      )
    : null;

  return {
    thresholdKj: response.thresholdKj,
    minPowerWatts: response.minPowerWatts,
    dayCount: response.days.length,
    totalKj: roundNumber(totals.totalKj, 2),
    totalDepthKj: roundNumber(totals.depthKj, 2),
    averageDepthRatio,
    bestDepthDay: totals.best
      ? {
          date: totals.best.date,
          depthKj: roundNumber(totals.best.depthKj, 2),
          depthRatio: totals.best.depthRatio != null ? roundNumber(totals.best.depthRatio, 1) : null,
          totalKj: roundNumber(totals.best.totalKj, 2),
        }
      : null,
    generatedAt: new Date().toISOString(),
  };
}
