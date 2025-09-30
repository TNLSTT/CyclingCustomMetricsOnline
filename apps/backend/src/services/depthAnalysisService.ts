import { prisma } from '../prisma.js';

interface DepthAnalysisOptions {
  thresholdKj: number;
  minPowerWatts: number;
}

type ActivityRecord = {
  id: string;
  startTime: Date;
  durationSec: number;
  sampleRateHz: number | null;
};

type SampleRecord = {
  t: number;
  power: number | null;
};

interface DepthActivitySummary {
  activityId: string;
  startTime: string;
  totalKj: number;
  depthKj: number;
  depthRatio: number | null;
}

interface DayAggregation {
  date: Date;
  totalKj: number;
  depthKj: number;
  activities: DepthActivitySummary[];
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

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toUtcStartOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function inferSampleRate(activity: ActivityRecord, samples: SampleRecord[]): number {
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

type DepthComputationResult = {
  totalJoules: number;
  depthJoules: number;
};

function computeDepthForActivity(
  activity: ActivityRecord,
  samples: SampleRecord[],
  options: DepthAnalysisOptions,
): DepthComputationResult {
  if (samples.length === 0) {
    return { totalJoules: 0, depthJoules: 0 };
  }

  const sampleRate = Math.max(1e-6, inferSampleRate(activity, samples));
  const intervalSeconds = 1 / sampleRate;
  const thresholdJoules = Math.max(0, options.thresholdKj * 1000);
  const minPower = Math.max(0, options.minPowerWatts);

  let cumulativeJoules = 0;
  let depthJoules = 0;

  for (const sample of samples) {
    const power = typeof sample.power === 'number' && Number.isFinite(sample.power) ? sample.power : 0;
    if (power <= 0) {
      continue;
    }

    const energy = power * intervalSeconds;
    const previousJoules = cumulativeJoules;
    cumulativeJoules += energy;

    if (power < minPower) {
      continue;
    }

    if (cumulativeJoules <= thresholdJoules) {
      continue;
    }

    const effectiveStart = Math.max(previousJoules, thresholdJoules);
    depthJoules += cumulativeJoules - effectiveStart;
  }

  return { totalJoules: cumulativeJoules, depthJoules };
}

function formatNumber(value: number, fractionDigits = 1): number {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function mergeDayAggregation(
  dayMap: Map<string, DayAggregation>,
  activity: ActivityRecord,
  summary: DepthComputationResult,
): void {
  const totalKj = summary.totalJoules / 1000;
  const depthKj = summary.depthJoules / 1000;
  const ratio = summary.totalJoules > 0 ? summary.depthJoules / summary.totalJoules : null;

  const dayKey = toDateKey(activity.startTime);
  const startOfDay = toUtcStartOfDay(activity.startTime);

  const activitySummary: DepthActivitySummary = {
    activityId: activity.id,
    startTime: activity.startTime.toISOString(),
    totalKj: formatNumber(totalKj, 2),
    depthKj: formatNumber(depthKj, 2),
    depthRatio: ratio != null ? formatNumber(ratio * 100, 1) : null,
  };

  const existing = dayMap.get(dayKey);
  if (existing) {
    existing.totalKj += totalKj;
    existing.depthKj += depthKj;
    existing.activities.push(activitySummary);
    return;
  }

  dayMap.set(dayKey, {
    date: startOfDay,
    totalKj,
    depthKj,
    activities: [activitySummary],
  });
}

function buildTimeline(dayMap: Map<string, DayAggregation>): DayAggregation[] {
  const keys = Array.from(dayMap.keys()).sort();
  if (keys.length === 0) {
    return [];
  }

  const timeline: DayAggregation[] = [];
  let cursor = toUtcStartOfDay(new Date(`${keys[0]}T00:00:00.000Z`));
  const end = toUtcStartOfDay(new Date(`${keys[keys.length - 1]}T00:00:00.000Z`));

  while (cursor.getTime() <= end.getTime()) {
    const key = toDateKey(cursor);
    const entry = dayMap.get(key);
    if (entry) {
      timeline.push({
        date: entry.date,
        totalKj: entry.totalKj,
        depthKj: entry.depthKj,
        activities: [...entry.activities],
      });
    } else {
      timeline.push({
        date: new Date(cursor),
        totalKj: 0,
        depthKj: 0,
        activities: [],
      });
    }
    cursor = addUtcDays(cursor, 1);
  }

  return timeline;
}

function computeRollingAverage(values: number[], windowSize: number): Array<number | null> {
  if (windowSize <= 0) {
    return values.map(() => null);
  }

  const result: Array<number | null> = values.map(() => null);
  const window: number[] = [];
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    window.push(value);
    sum += value;

    if (window.length > windowSize) {
      const removed = window.shift();
      if (removed != null) {
        sum -= removed;
      }
    }

    if (index >= windowSize - 1) {
      result[index] = formatNumber(sum / windowSize, 2);
    }
  }

  return result;
}

export async function computeDepthAnalysis(
  userId: string | undefined,
  options: DepthAnalysisOptions,
): Promise<DepthAnalysisResponse> {
  const activities = await prisma.activity.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      startTime: true,
      durationSec: true,
      sampleRateHz: true,
    },
  });

  if (activities.length === 0) {
    return {
      thresholdKj: options.thresholdKj,
      minPowerWatts: options.minPowerWatts,
      days: [],
    };
  }

  const samplesByActivity = new Map<string, SampleRecord[]>();

  await Promise.all(
    activities.map(async (activity) => {
      const rows = await prisma.activitySample.findMany({
        where: { activityId: activity.id },
        orderBy: { t: 'asc' },
        select: { t: true, power: true },
      });

      const mapped = rows.map((row) => ({ t: row.t, power: row.power ?? null }));
      samplesByActivity.set(activity.id, mapped);
    }),
  );

  const dayMap = new Map<string, DayAggregation>();

  activities.forEach((activity) => {
    const samples = samplesByActivity.get(activity.id) ?? [];
    const summary = computeDepthForActivity(activity, samples, options);
    if (summary.totalJoules <= 0) {
      return;
    }
    mergeDayAggregation(dayMap, activity, summary);
  });

  if (dayMap.size === 0) {
    return {
      thresholdKj: options.thresholdKj,
      minPowerWatts: options.minPowerWatts,
      days: [],
    };
  }

  const timeline = buildTimeline(dayMap);
  const movingAverage = computeRollingAverage(
    timeline.map((entry) => entry.depthKj),
    90,
  );

  const days: DepthDaySummary[] = timeline.map((entry, index) => {
    const ratio = entry.totalKj > 0 ? (entry.depthKj / entry.totalKj) * 100 : null;
    return {
      date: entry.date.toISOString(),
      totalKj: formatNumber(entry.totalKj, 2),
      depthKj: formatNumber(entry.depthKj, 2),
      depthRatio: ratio != null ? formatNumber(ratio, 1) : null,
      movingAverage90: movingAverage[index],
      activities: entry.activities.map((activitySummary) => ({
        ...activitySummary,
        depthKj: formatNumber(activitySummary.depthKj, 2),
        totalKj: formatNumber(activitySummary.totalKj, 2),
        depthRatio: activitySummary.depthRatio,
      })),
    };
  });

  return {
    thresholdKj: options.thresholdKj,
    minPowerWatts: options.minPowerWatts,
    days,
  };
}
