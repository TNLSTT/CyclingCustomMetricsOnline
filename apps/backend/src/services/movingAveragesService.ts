import { prisma } from '../prisma.js';
import { mergeProfileAnalytics, summarizeMovingAverages } from './profileAnalyticsService.js';
import type { MetricSample } from '../metrics/types.js';
import {
  computeBestRollingAverage,
  extractPowerSamples,
  sumPower,
} from '../utils/power.js';

const POWER_DURATIONS_SECONDS = [60, 300, 1200, 3600, 10800, 14400] as const;

type PowerDurationKey = `${(typeof POWER_DURATIONS_SECONDS)[number]}`;

interface ActivityRecord {
  id: string;
  startTime: Date;
  sampleRateHz: number | null;
}

interface DayAggregation {
  date: Date;
  totalKj: number;
  bestPower: Map<PowerDurationKey, number | null>;
}

export interface MovingAverageDay {
  date: string;
  totalKj: number;
  bestPower: Record<PowerDurationKey, number | null>;
}

function toDateKey(date: Date): string {
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

function initializeBestPowerMap(): Map<PowerDurationKey, number | null> {
  const map = new Map<PowerDurationKey, number | null>();
  for (const duration of POWER_DURATIONS_SECONDS) {
    map.set(String(duration) as PowerDurationKey, null);
  }
  return map;
}

function computeSampleRate(activity: ActivityRecord): number {
  if (activity.sampleRateHz && activity.sampleRateHz > 0) {
    return activity.sampleRateHz;
  }
  return 1;
}

function mergeDayAggregation(
  map: Map<string, DayAggregation>,
  activity: ActivityRecord,
  samples: MetricSample[],
) {
  const powerSamples = extractPowerSamples(samples);
  const sampleRate = computeSampleRate(activity);
  const totalJoules = sumPower(samples);
  const totalKj = totalJoules / 1000;

  const dayKey = toDateKey(activity.startTime);
  const startOfDay = toUtcStartOfDay(activity.startTime);

  const existing = map.get(dayKey);
  const bestPower = existing?.bestPower ?? initializeBestPowerMap();

  for (const duration of POWER_DURATIONS_SECONDS) {
    const windowSize = Math.max(1, Math.round(duration * sampleRate));
    const best = computeBestRollingAverage(powerSamples, windowSize);
    const key = String(duration) as PowerDurationKey;
    if (best != null && Number.isFinite(best)) {
      const rounded = Number.parseFloat(best.toFixed(1));
      const current = bestPower.get(key);
      if (current == null || rounded > current) {
        bestPower.set(key, rounded);
      }
    }
  }

  if (existing) {
    existing.totalKj += totalKj;
    return;
  }

  map.set(dayKey, {
    date: startOfDay,
    totalKj,
    bestPower,
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
        bestPower: new Map(entry.bestPower),
      });
    } else {
      timeline.push({
        date: new Date(cursor),
        totalKj: 0,
        bestPower: initializeBestPowerMap(),
      });
    }
    cursor = addUtcDays(cursor, 1);
  }

  return timeline;
}

function serializeDay(entry: DayAggregation): MovingAverageDay {
  const bestPower: Record<PowerDurationKey, number | null> = {
    '60': entry.bestPower.get('60') ?? null,
    '300': entry.bestPower.get('300') ?? null,
    '1200': entry.bestPower.get('1200') ?? null,
    '3600': entry.bestPower.get('3600') ?? null,
    '10800': entry.bestPower.get('10800') ?? null,
    '14400': entry.bestPower.get('14400') ?? null,
  };

  return {
    date: entry.date.toISOString(),
    totalKj: Number.parseFloat(entry.totalKj.toFixed(2)),
    bestPower,
  };
}

export async function computeMovingAverageInputs(userId?: string): Promise<MovingAverageDay[]> {
  const activities = (await prisma.activity.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      startTime: true,
      sampleRateHz: true,
    },
  })) as ActivityRecord[];

  if (activities.length === 0) {
    if (userId) {
      await mergeProfileAnalytics(userId, { movingAverages: summarizeMovingAverages([]) });
    }
    return [];
  }

  const samplesByActivity = new Map<string, MetricSample[]>();
  await Promise.all(
    activities.map(async (activity: ActivityRecord) => {
      const rows = (await prisma.activitySample.findMany({
        where: { activityId: activity.id },
        orderBy: { t: 'asc' },
        select: {
          t: true,
          power: true,
        },
      })) as Array<{ t: number; power: number | null }>;

      const mapped = rows.map((row) => ({
        t: row.t,
        power: row.power ?? null,
        heartRate: null,
        cadence: null,
        speed: null,
        elevation: null,
        temperature: null,
      }));

      samplesByActivity.set(activity.id, mapped);
    }),
  );

  const dayMap = new Map<string, DayAggregation>();
  for (const activity of activities) {
    const samples = samplesByActivity.get(activity.id) ?? [];
    mergeDayAggregation(dayMap, activity, samples);
  }

  const timeline = buildTimeline(dayMap);
  const days = timeline.map(serializeDay);

  if (userId) {
    await mergeProfileAnalytics(userId, { movingAverages: summarizeMovingAverages(days) });
  }

  return days;
}
