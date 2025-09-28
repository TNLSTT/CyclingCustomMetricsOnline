import { prisma } from '../prisma.js';
import type { MetricSample } from '../metrics/types.js';
import {
  computeAveragePower,
  computeBestRollingAverage,
  computeNormalizedPower,
  extractPowerSamples,
  sumPower,
} from '../utils/power.js';

const NORMALIZED_WINDOW_SECONDS = 30;
const FTP_WINDOW_SECONDS = 20 * 60;

type ActivityRecord = {
  id: string;
  startTime: Date;
  durationSec: number;
  sampleRateHz: number | null;
};

interface ActivityLoadSummary {
  activityId: string;
  startTime: Date;
  durationSec: number;
  totalKj: number;
  averagePower: number | null;
  normalizedPower: number | null;
  ftpCandidate: number | null;
}

type DayKey = string;

interface DayAggregation {
  date: Date;
  totalTss: number;
  totalKj: number;
  activityIds: string[];
}

export interface BlockSummary {
  start: string;
  end: string;
  totalTss: number;
  totalKj: number;
  dayCount: number;
  activityIds: string[];
}

export interface WindowSummary {
  windowDays: number;
  bestTss: BlockSummary | null;
  bestKj: BlockSummary | null;
}

export interface AdaptationEdgesAnalysis {
  ftpEstimate: number | null;
  windowSummaries: WindowSummary[];
}

function toDateKey(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

function toUtcStartOfDay(date: Date): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function roundNumber(value: number, fractionDigits = 1): number {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function computeSampleRate(activity: ActivityRecord): number {
  if (activity.sampleRateHz && activity.sampleRateHz > 0) {
    return activity.sampleRateHz;
  }
  return 1;
}

function computeActivitySummary(
  activity: ActivityRecord,
  samples: MetricSample[],
): ActivityLoadSummary {
  const powerSamples = extractPowerSamples(samples);
  const sampleRate = computeSampleRate(activity);
  const normalizedWindowSize = Math.max(1, Math.round(NORMALIZED_WINDOW_SECONDS * sampleRate));
  const ftpWindowSize = Math.max(1, Math.round(FTP_WINDOW_SECONDS * sampleRate));

  const { normalizedPower } = computeNormalizedPower(powerSamples, normalizedWindowSize);
  const averagePower = computeAveragePower(powerSamples);

  const bestTwentyMinute = computeBestRollingAverage(powerSamples, ftpWindowSize);
  const ftpCandidate = bestTwentyMinute != null ? bestTwentyMinute * 0.95 : null;

  const totalJoules = sumPower(samples);
  const totalKj = totalJoules / 1000;

  return {
    activityId: activity.id,
    startTime: activity.startTime,
    durationSec: activity.durationSec,
    totalKj,
    averagePower,
    normalizedPower,
    ftpCandidate,
  };
}

function computeFtpEstimate(summaries: ActivityLoadSummary[]): number | null {
  const maxCandidate = summaries.reduce((max, summary) => {
    if (summary.ftpCandidate != null && summary.ftpCandidate > max) {
      return summary.ftpCandidate;
    }
    return max;
  }, 0);

  if (maxCandidate > 0) {
    return maxCandidate;
  }

  const fallback = summaries.reduce((max, summary) => {
    if (summary.averagePower != null && summary.averagePower > max) {
      return summary.averagePower;
    }
    return max;
  }, 0);

  return fallback > 0 ? fallback : null;
}

function computeActivityTss(summary: ActivityLoadSummary, ftpEstimate: number | null): number {
  if (!ftpEstimate || ftpEstimate <= 0) {
    return 0;
  }

  const power = summary.normalizedPower ?? summary.averagePower ?? 0;
  if (power <= 0) {
    return 0;
  }

  const numerator = summary.durationSec * power * (power / ftpEstimate);
  const tss = numerator / (ftpEstimate * 36);
  return tss;
}

function mergeDayAggregation(
  map: Map<DayKey, DayAggregation>,
  dayKey: DayKey,
  startOfDay: Date,
  tss: number,
  totalKj: number,
  activityId: string,
) {
  const existing = map.get(dayKey);
  if (existing) {
    existing.totalTss += tss;
    existing.totalKj += totalKj;
    existing.activityIds.push(activityId);
    return;
  }

  map.set(dayKey, {
    date: startOfDay,
    totalTss: tss,
    totalKj,
    activityIds: [activityId],
  });
}

function buildTimeline(dayMap: Map<DayKey, DayAggregation>): DayAggregation[] {
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
        totalTss: entry.totalTss,
        totalKj: entry.totalKj,
        activityIds: [...entry.activityIds],
      });
    } else {
      timeline.push({
        date: new Date(cursor),
        totalTss: 0,
        totalKj: 0,
        activityIds: [],
      });
    }
    cursor = addUtcDays(cursor, 1);
  }

  return timeline;
}

function dedupeActivityIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function computeBestWindow(
  timeline: DayAggregation[],
  windowDays: number,
  metric: 'tss' | 'kj',
): BlockSummary | null {
  if (timeline.length < windowDays) {
    return null;
  }

  const selectPrimary = (entry: DayAggregation) => (metric === 'tss' ? entry.totalTss : entry.totalKj);
  const selectSecondary = (entry: DayAggregation) => (metric === 'tss' ? entry.totalKj : entry.totalTss);

  let primarySum = 0;
  let secondarySum = 0;
  let best: { primary: number; secondary: number; startIndex: number; endIndex: number } | null = null;

  for (let index = 0; index < timeline.length; index += 1) {
    primarySum += selectPrimary(timeline[index]!);
    secondarySum += selectSecondary(timeline[index]!);

    if (index >= windowDays) {
      primarySum -= selectPrimary(timeline[index - windowDays]!);
      secondarySum -= selectSecondary(timeline[index - windowDays]!);
    }

    if (index >= windowDays - 1) {
      if (!best || primarySum > best.primary) {
        best = {
          primary: primarySum,
          secondary: secondarySum,
          startIndex: index - windowDays + 1,
          endIndex: index,
        };
      }
    }
  }

  if (!best) {
    return null;
  }

  const slice = timeline.slice(best.startIndex, best.endIndex + 1);
  const activityIds = dedupeActivityIds(slice.flatMap((entry) => entry.activityIds));
  const start = slice[0]?.date ?? new Date();
  const end = slice[slice.length - 1]?.date ?? start;

  const totalTss = metric === 'tss' ? best.primary : best.secondary;
  const totalKj = metric === 'kj' ? best.primary : best.secondary;

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    totalTss: roundNumber(totalTss, 1),
    totalKj: roundNumber(totalKj, 1),
    dayCount: slice.length,
    activityIds,
  };
}

export async function computeAdaptationEdges(userId?: string): Promise<AdaptationEdgesAnalysis> {
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
    return { ftpEstimate: null, windowSummaries: [] };
  }

  const samplesByActivity = new Map<string, MetricSample[]>();
  await Promise.all(
    activities.map(async (activity) => {
      const rows = await prisma.activitySample.findMany({
        where: { activityId: activity.id },
        orderBy: { t: 'asc' },
        select: {
          t: true,
          power: true,
          heartRate: true,
          cadence: true,
          speed: true,
          elevation: true,
          temperature: true,
        },
      });

      const mapped = rows.map((sample) => ({
        t: sample.t,
        heartRate: sample.heartRate ?? null,
        cadence: sample.cadence ?? null,
        power: sample.power ?? null,
        speed: sample.speed ?? null,
        elevation: sample.elevation ?? null,
        temperature: sample.temperature ?? null,
      }));

      samplesByActivity.set(activity.id, mapped);
    }),
  );

  const summaries: ActivityLoadSummary[] = activities.map((activity) => {
    const activitySamples = samplesByActivity.get(activity.id) ?? [];
    return computeActivitySummary(activity, activitySamples);
  });

  const ftpEstimate = computeFtpEstimate(summaries);

  const dayMap = new Map<DayKey, DayAggregation>();
  for (const summary of summaries) {
    const tss = computeActivityTss(summary, ftpEstimate);
    const dayKey = toDateKey(summary.startTime);
    const startOfDay = toUtcStartOfDay(summary.startTime);
    mergeDayAggregation(dayMap, dayKey, startOfDay, tss, summary.totalKj, summary.activityId);
  }

  const timeline = buildTimeline(dayMap);

  const windowSummaries: WindowSummary[] = [];
  for (let windowDays = 3; windowDays <= 25; windowDays += 1) {
    const bestTss = computeBestWindow(timeline, windowDays, 'tss');
    const bestKj = computeBestWindow(timeline, windowDays, 'kj');
    if (!bestTss && !bestKj) {
      windowSummaries.push({ windowDays, bestTss: null, bestKj: null });
    } else {
      windowSummaries.push({
        windowDays,
        bestTss,
        bestKj,
      });
    }
  }

  return {
    ftpEstimate: ftpEstimate != null ? roundNumber(ftpEstimate, 1) : null,
    windowSummaries,
  };
}
