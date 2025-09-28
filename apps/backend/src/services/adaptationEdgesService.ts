import { prisma } from '../prisma.js';

const MIN_WINDOW_DAYS = 3;
const MAX_WINDOW_DAYS = 25;
const EPSILON = 1e-6;

function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function round(value: number, fractionDigits = 2): number {
  return Number.isFinite(value) ? Number(value.toFixed(fractionDigits)) : 0;
}

function readNumber(summary: Record<string, unknown>, key: string): number | null {
  const value = summary[key];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return value;
}

interface ActivityLoadEntry {
  activityId: string;
  startTime: Date;
  durationSec: number;
  normalizedPower: number | null;
  averagePower: number | null;
}

interface DayTotals {
  dateKey: string;
  tss: number;
  kilojoules: number;
  activityIds: string[];
}

export interface AdaptationBlockDayBreakdown {
  date: string;
  tss: number;
  kilojoules: number;
  activityIds: string[];
}

export interface AdaptationBlock {
  total: number;
  averagePerDay: number;
  startDate: string;
  endDate: string;
  activityIds: string[];
  contributingDays: AdaptationBlockDayBreakdown[];
}

export interface AdaptationWindowResult {
  days: number;
  bestTss: AdaptationBlock | null;
  bestKilojoules: AdaptationBlock | null;
}

export interface AdaptationEdgesSummary {
  ftpEstimate: number | null;
  totalActivities: number;
  totalKilojoules: number;
  totalTss: number;
  analyzedDays: number;
  windows: AdaptationWindowResult[];
}

function buildBlock(
  days: DayTotals[],
  startIndex: number,
  length: number,
  field: 'tss' | 'kilojoules',
): AdaptationBlock {
  const slice = days.slice(startIndex, startIndex + length);
  const total = slice.reduce((sum, day) => sum + day[field], 0);
  const averagePerDay = total / length;
  const startDate = fromDateKey(slice[0]!.dateKey);
  const endDate = fromDateKey(slice[slice.length - 1]!.dateKey);
  const allActivities = new Set<string>();

  for (const day of slice) {
    for (const activityId of day.activityIds) {
      allActivities.add(activityId);
    }
  }

  const contributingDays: AdaptationBlockDayBreakdown[] = slice.map((day) => ({
    date: fromDateKey(day.dateKey).toISOString(),
    tss: round(day.tss, 2),
    kilojoules: round(day.kilojoules, 2),
    activityIds: [...day.activityIds],
  }));

  return {
    total: round(total, 2),
    averagePerDay: round(averagePerDay, 2),
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    activityIds: [...allActivities],
    contributingDays,
  };
}

function findBestWindow(
  days: DayTotals[],
  length: number,
  field: 'tss' | 'kilojoules',
): AdaptationBlock | null {
  if (days.length < length) {
    return null;
  }

  let bestSum = Number.NEGATIVE_INFINITY;
  let bestStart = -1;
  let windowSum = 0;

  for (let index = 0; index < days.length; index += 1) {
    windowSum += days[index]![field];
    if (index >= length) {
      windowSum -= days[index - length]![field];
    }
    if (index >= length - 1 && windowSum > bestSum + EPSILON) {
      bestSum = windowSum;
      bestStart = index - length + 1;
    }
  }

  if (bestStart < 0 || bestSum <= EPSILON) {
    return null;
  }

  return buildBlock(days, bestStart, length, field);
}

function buildDaySeries(entries: ActivityLoadEntry[], ftp: number | null) {
  const dayMap = new Map<string, DayTotals>();
  let totalKilojoules = 0;
  let totalTss = 0;

  for (const entry of entries) {
    const dateKey = toDateKey(entry.startTime);
    let record = dayMap.get(dateKey);
    if (!record) {
      record = { dateKey, tss: 0, kilojoules: 0, activityIds: [] };
      dayMap.set(dateKey, record);
    }

    if (typeof entry.averagePower === 'number' && Number.isFinite(entry.averagePower)) {
      const energy = (entry.averagePower * entry.durationSec) / 1000;
      record.kilojoules += energy;
      totalKilojoules += energy;
    }

    if (
      ftp &&
      ftp > 0 &&
      typeof entry.normalizedPower === 'number' &&
      Number.isFinite(entry.normalizedPower) &&
      entry.durationSec > 0
    ) {
      const intensityFactor = entry.normalizedPower / ftp;
      const tss = (entry.durationSec / 3600) * intensityFactor * intensityFactor * 100;
      record.tss += tss;
      totalTss += tss;
    }

    record.activityIds.push(entry.activityId);
  }

  const keys = Array.from(dayMap.keys()).sort();
  if (keys.length === 0) {
    return { days: [] as DayTotals[], totalKilojoules, totalTss };
  }

  const firstDay = fromDateKey(keys[0]!);
  const lastDay = fromDateKey(keys[keys.length - 1]!);

  const days: DayTotals[] = [];
  for (let current = firstDay; current.getTime() <= lastDay.getTime(); current = addDays(current, 1)) {
    const key = toDateKey(current);
    const record = dayMap.get(key);
    if (record) {
      days.push({
        dateKey: record.dateKey,
        tss: record.tss,
        kilojoules: record.kilojoules,
        activityIds: [...record.activityIds],
      });
    } else {
      days.push({ dateKey: key, tss: 0, kilojoules: 0, activityIds: [] });
    }
  }

  return { days, totalKilojoules, totalTss };
}

export async function computeAdaptationEdges(userId?: string | null): Promise<AdaptationEdgesSummary> {
  const metricResults = await prisma.metricResult.findMany({
    where: {
      metricDefinition: { key: 'normalized-power' },
      ...(userId ? { activity: { userId } } : {}),
    },
    include: {
      activity: true,
    },
    orderBy: {
      activity: { startTime: 'asc' },
    },
  });

  const entries: ActivityLoadEntry[] = metricResults
    .map((result) => {
      const activity = result.activity;
      if (!activity) {
        return null;
      }
      const summary = result.summary as Record<string, unknown>;
      const normalizedPower = summary ? readNumber(summary, 'normalized_power_w') : null;
      const averagePower = summary ? readNumber(summary, 'average_power_w') : null;
      return {
        activityId: result.activityId,
        startTime: new Date(activity.startTime),
        durationSec: activity.durationSec,
        normalizedPower,
        averagePower,
      } satisfies ActivityLoadEntry;
    })
    .filter((entry): entry is ActivityLoadEntry => entry !== null && entry.durationSec > 0);

  if (entries.length === 0) {
    return {
      ftpEstimate: null,
      totalActivities: 0,
      totalKilojoules: 0,
      totalTss: 0,
      analyzedDays: 0,
      windows: [],
    };
  }

  const ftpEstimate = entries.reduce((max, entry) => {
    if (typeof entry.normalizedPower === 'number' && Number.isFinite(entry.normalizedPower)) {
      return Math.max(max, entry.normalizedPower);
    }
    return max;
  }, 0);

  const ftp = ftpEstimate > 0 ? ftpEstimate : null;

  const { days, totalKilojoules, totalTss } = buildDaySeries(entries, ftp);

  const windows: AdaptationWindowResult[] = [];
  for (let length = MIN_WINDOW_DAYS; length <= MAX_WINDOW_DAYS; length += 1) {
    windows.push({
      days: length,
      bestTss: ftp ? findBestWindow(days, length, 'tss') : null,
      bestKilojoules: findBestWindow(days, length, 'kilojoules'),
    });
  }

  return {
    ftpEstimate: ftp,
    totalActivities: entries.length,
    totalKilojoules: round(totalKilojoules, 2),
    totalTss: round(totalTss, 2),
    analyzedDays: days.length,
    windows,
  };
}
