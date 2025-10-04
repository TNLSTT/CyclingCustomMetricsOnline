import type { Activity, Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';
import { mergeProfileAnalytics, summarizeDurabilityAnalysis } from './profileAnalyticsService.js';
import type { MetricSample } from '../metrics/types.js';
import {
  computeAveragePower,
  computeBestRollingAverage,
  computeNormalizedPower,
  extractPowerSamples,
} from '../utils/power.js';

type ActivityWhereClause = Prisma.ActivityWhereInput & {
  startTime?: {
    gte?: Date;
    lte?: Date;
  };
};

export interface DurabilityFilters {
  minDurationSec: number;
  startDate?: Date;
  endDate?: Date;
  discipline?: string;
  keyword?: string;
}

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
  normalizedPowerWatts: number | null;
  normalizedPowerPctFtp: number | null;
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
  normalizedPowerWatts: number | null;
  normalizedPowerPctFtp: number | null;
  averagePowerWatts: number | null;
  averageHeartRateBpm: number | null;
  totalKj: number | null;
  tss: number | null;
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
  filters: DurabilityFilters;
  rides: DurabilityRideAnalysis[];
  disciplines: string[];
}

const DEFAULT_MIN_DURATION_SEC = 3 * 3600;
const NORMALIZED_WINDOW_SECONDS = 30;
const BEST_WINDOW_SECONDS = 20 * 60;
const MAX_SERIES_POINTS = 600;

function clampScore(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return Math.round(value);
}

function round(value: number | null, fractionDigits = 1): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function inferSampleRate(activity: Activity, samples: MetricSample[]): number {
  if (activity.sampleRateHz && activity.sampleRateHz > 0) {
    return activity.sampleRateHz;
  }

  if (samples.length >= 2) {
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;
    const delta = last.t - first.t;
    if (delta > 0) {
      return (samples.length - 1) / delta;
    }
  }

  if (activity.durationSec > 0 && samples.length > 0) {
    return samples.length / activity.durationSec;
  }

  return 1;
}

function toMetricSamples(samples: Array<{ t: number; power: number | null; heartRate: number | null }>): MetricSample[] {
  return samples
    .map((sample) => ({
      t: sample.t,
      power: sample.power,
      heartRate: sample.heartRate,
      cadence: null,
      speed: null,
      elevation: null,
    }))
    .sort((a, b) => a.t - b.t);
}

function selectSegmentSamples(samples: MetricSample[], start: number, end: number): MetricSample[] {
  return samples.filter((sample) => sample.t >= start && sample.t < end);
}

function computeAverage(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sum = values.reduce((total, entry) => total + entry, 0);
  return sum / values.length;
}

function computeAverageHeartRate(samples: MetricSample[]): number | null {
  const values = samples
    .map((sample) => sample.heartRate)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return computeAverage(values);
}

function computeTotalJoules(samples: MetricSample[], sampleRate: number): number | null {
  if (samples.length === 0 || sampleRate <= 0) {
    return null;
  }
  const interval = 1 / sampleRate;
  const total = samples.reduce((sum, sample) => {
    if (typeof sample.power === 'number' && Number.isFinite(sample.power)) {
      return sum + sample.power * interval;
    }
    return sum;
  }, 0);
  return total;
}

function computeSegmentMetrics(
  label: 'early' | 'middle' | 'late',
  samples: MetricSample[],
  sampleRate: number,
  ftpWatts: number | null,
  startSec: number,
  endSec: number,
): DurabilitySegmentMetrics {
  const durationSec = Math.max(0, endSec - startSec);
  const powerSamples = extractPowerSamples(samples);
  const windowSize = Math.max(1, Math.round(NORMALIZED_WINDOW_SECONDS * sampleRate));
  const { normalizedPower } = computeNormalizedPower(powerSamples, windowSize);
  const averagePower = computeAveragePower(powerSamples);
  const averageHeartRate = computeAverageHeartRate(samples);
  const ratio =
    averagePower != null && averagePower > 0 && averageHeartRate != null
      ? averageHeartRate / averagePower
      : null;

  return {
    label,
    startSec,
    endSec,
    durationSec,
    normalizedPowerWatts: normalizedPower != null ? round(normalizedPower, 1) : null,
    normalizedPowerPctFtp:
      normalizedPower != null && ftpWatts && ftpWatts > 0
        ? round((normalizedPower / ftpWatts) * 100, 1)
        : null,
    averagePowerWatts: averagePower != null ? round(averagePower, 1) : null,
    averageHeartRateBpm: averageHeartRate != null ? round(averageHeartRate, 0) : null,
    heartRatePowerRatio: ratio != null ? round(ratio, 3) : null,
  };
}

export function calculateDurabilityScore(
  earlyNpPct: number | null,
  lateNpPct: number | null,
  heartRateDriftPct: number | null,
  bestLateTwentyMinPctFtp: number | null,
): number {
  let score = 100;

  if (earlyNpPct != null && lateNpPct != null) {
    const drop = earlyNpPct - lateNpPct;
    if (drop > 0) {
      score -= drop * 0.5;
    } else {
      score += Math.min(Math.abs(drop) * 0.2, 5);
    }
  }

  if (heartRateDriftPct != null && heartRateDriftPct > 0) {
    score -= heartRateDriftPct * 0.75;
  }

  if (bestLateTwentyMinPctFtp != null) {
    const bonus = bestLateTwentyMinPctFtp - 100;
    if (bonus > 0) {
      score += bonus * 0.5;
    }
  }

  return clampScore(score);
}

function downsampleSeries(points: DurabilityTimeSeriesPoint[], maxPoints: number): DurabilityTimeSeriesPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = Math.ceil(points.length / maxPoints);
  const sampled: DurabilityTimeSeriesPoint[] = [];
  for (let index = 0; index < points.length; index += step) {
    sampled.push(points[index]!);
  }
  const last = points[points.length - 1]!;
  if (sampled[sampled.length - 1]?.t !== last.t) {
    sampled.push(last);
  }
  return sampled;
}

function buildTimeSeries(samples: MetricSample[]): DurabilityTimeSeriesPoint[] {
  return samples.map((sample) => ({
    t: sample.t,
    power: sample.power ?? null,
    heartRate: sample.heartRate ?? null,
  }));
}

interface ActivityWithSamples extends Activity {
  samples: Array<{ t: number; power: number | null; heartRate: number | null }>;
}

function computeRideAnalysis(
  activity: ActivityWithSamples,
  ftpWatts: number | null,
): DurabilityRideAnalysis {
  const metricSamples = toMetricSamples(activity.samples);
  const sampleRate = inferSampleRate(activity, metricSamples);
  const totalWindow = Math.max(1, Math.round(NORMALIZED_WINDOW_SECONDS * sampleRate));
  const powerSamples = extractPowerSamples(metricSamples);
  const { normalizedPower } = computeNormalizedPower(powerSamples, totalWindow);
  const averagePower = computeAveragePower(powerSamples);
  const averageHeartRate = computeAverageHeartRate(metricSamples);
  const totalJoules = computeTotalJoules(metricSamples, sampleRate);
  const totalKj = totalJoules != null ? round(totalJoules / 1000, 1) : null;
  const intensityFactor =
    normalizedPower != null && ftpWatts && ftpWatts > 0 ? normalizedPower / ftpWatts : null;
  const tss =
    intensityFactor != null
      ? round(intensityFactor * intensityFactor * (activity.durationSec / 3600) * 100, 1)
      : null;

  const earlyEnd = activity.durationSec * 0.3;
  const middleEnd = activity.durationSec * 0.7;

  const earlySamples = selectSegmentSamples(metricSamples, 0, earlyEnd);
  const middleSamples = selectSegmentSamples(metricSamples, earlyEnd, middleEnd);
  const lateSamples = selectSegmentSamples(metricSamples, middleEnd, activity.durationSec + 1);

  const segments = {
    early: computeSegmentMetrics('early', earlySamples, sampleRate, ftpWatts, 0, earlyEnd),
    middle: computeSegmentMetrics('middle', middleSamples, sampleRate, ftpWatts, earlyEnd, middleEnd),
    late: computeSegmentMetrics('late', lateSamples, sampleRate, ftpWatts, middleEnd, activity.durationSec),
  };

  const heartRateRatioEarly = segments.early.heartRatePowerRatio;
  const heartRateRatioLate = segments.late.heartRatePowerRatio;
  const heartRateDriftPct =
    heartRateRatioEarly != null && heartRateRatioEarly > 0 && heartRateRatioLate != null
      ? round(((heartRateRatioLate - heartRateRatioEarly) / heartRateRatioEarly) * 100, 1)
      : null;

  const latePowerSamples = extractPowerSamples(lateSamples);
  const bestWindowSize = Math.max(1, Math.round(BEST_WINDOW_SECONDS * sampleRate));
  const bestLateTwentyMinute = computeBestRollingAverage(latePowerSamples, bestWindowSize);
  const bestLateTwentyMinutePct =
    bestLateTwentyMinute != null && ftpWatts && ftpWatts > 0
      ? round((bestLateTwentyMinute / ftpWatts) * 100, 1)
      : null;

  const durabilityScore = calculateDurabilityScore(
    segments.early.normalizedPowerPctFtp,
    segments.late.normalizedPowerPctFtp,
    heartRateDriftPct,
    bestLateTwentyMinutePct,
  );

  const timeSeries = downsampleSeries(buildTimeSeries(metricSamples), MAX_SERIES_POINTS);

  return {
    activityId: activity.id,
    startTime: activity.startTime.toISOString(),
    source: activity.source,
    durationSec: activity.durationSec,
    ftpWatts,
    normalizedPowerWatts: normalizedPower != null ? round(normalizedPower, 1) : null,
    normalizedPowerPctFtp:
      normalizedPower != null && ftpWatts && ftpWatts > 0
        ? round((normalizedPower / ftpWatts) * 100, 1)
        : null,
    averagePowerWatts: averagePower != null ? round(averagePower, 1) : null,
    averageHeartRateBpm: averageHeartRate != null ? round(averageHeartRate, 0) : null,
    totalKj,
    tss,
    heartRateDriftPct,
    bestLateTwentyMinWatts: bestLateTwentyMinute != null ? round(bestLateTwentyMinute, 1) : null,
    bestLateTwentyMinPctFtp: bestLateTwentyMinutePct,
    durabilityScore,
    segments,
    timeSeries,
  };
}

function buildWhereClause(userId: string, filters: DurabilityFilters): ActivityWhereClause {
  const where: ActivityWhereClause = {
    userId,
    durationSec: { gte: filters.minDurationSec > 0 ? filters.minDurationSec : DEFAULT_MIN_DURATION_SEC },
  };

  if (filters.startDate || filters.endDate) {
    where.startTime = {};
    if (filters.startDate) {
      where.startTime.gte = filters.startDate;
    }
    if (filters.endDate) {
      where.startTime.lte = filters.endDate;
    }
  }

  if (filters.discipline && filters.discipline.trim().length > 0) {
    where.source = { contains: filters.discipline.trim(), mode: 'insensitive' };
  }

  if (filters.keyword && filters.keyword.trim().length > 0) {
    const keyword = filters.keyword.trim();
    where.OR = [
      { source: { contains: keyword, mode: 'insensitive' } },
      {
        metrics: {
          some: {
            OR: [
              { metricDefinition: { name: { contains: keyword, mode: 'insensitive' } } },
              { metricDefinition: { key: { contains: keyword, mode: 'insensitive' } } },
            ],
          },
        },
      },
    ];
  }

  return where;
}

export async function getDurabilityAnalysis(
  userId: string,
  filters: Partial<DurabilityFilters>,
): Promise<DurabilityAnalysisResponse> {
  const appliedFilters: DurabilityFilters = {
    minDurationSec:
      typeof filters.minDurationSec === 'number' && filters.minDurationSec > 0
        ? filters.minDurationSec
        : DEFAULT_MIN_DURATION_SEC,
    startDate: filters.startDate,
    endDate: filters.endDate,
    discipline: filters.discipline?.trim() || undefined,
    keyword: filters.keyword?.trim() || undefined,
  };

  const profile = await prisma.profile.findUnique({ where: { userId } });
  const ftpWatts = profile?.ftpWatts ?? null;

  const where = buildWhereClause(userId, appliedFilters);

  const activities = (await prisma.activity.findMany({
    where,
    orderBy: { startTime: 'desc' },
    include: {
      samples: {
        orderBy: { t: 'asc' },
        select: { t: true, power: true, heartRate: true },
      },
    },
  })) as Array<Activity & { samples: Array<{ t: number; power: number | null; heartRate: number | null }> }>;

  const analyses = activities
    .filter((activity) => activity.samples.length > 0)
    .map((activity): DurabilityRideAnalysis => computeRideAnalysis(activity, ftpWatts));

  const disciplines = Array.from(new Set(analyses.map((ride) => ride.source))).sort();

  const filtersResponse: DurabilityFilters = {
    ...appliedFilters,
    startDate: appliedFilters.startDate ? new Date(appliedFilters.startDate) : undefined,
    endDate: appliedFilters.endDate ? new Date(appliedFilters.endDate) : undefined,
  };

  const response = {
    ftpWatts,
    filters: filtersResponse,
    rides: analyses,
    disciplines,
  };

  await mergeProfileAnalytics(userId, { durability: summarizeDurabilityAnalysis(response) });

  return response;
}
