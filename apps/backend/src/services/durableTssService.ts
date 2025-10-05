import type { Activity, Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';
import type { MetricSample } from '../metrics/types.js';
import { computeNormalizedPower, extractPowerSamples } from '../utils/power.js';

const NORMALIZED_WINDOW_SECONDS = 30;
const MIN_THRESHOLD_KJ = 1;
const MAX_THRESHOLD_KJ = 5000;

interface ActivityWithSamples extends Activity {
  samples: Array<{ t: number; power: number | null; heartRate: number | null }>;
}

export interface DurableTssFilters {
  thresholdKj: number;
  startDate?: Date;
  endDate?: Date;
}

export interface DurableTssRide {
  activityId: string;
  startTime: string;
  source: string;
  totalKj: number | null;
  postThresholdKj: number | null;
  postThresholdDurationSec: number | null;
  durableTss: number | null;
}

export interface DurableTssResponse {
  ftpWatts: number | null;
  thresholdKj: number;
  filters: DurableTssFilters;
  rides: DurableTssRide[];
}

function clampThreshold(value: number): number {
  if (Number.isNaN(value)) {
    return MIN_THRESHOLD_KJ;
  }
  if (value < MIN_THRESHOLD_KJ) {
    return MIN_THRESHOLD_KJ;
  }
  if (value > MAX_THRESHOLD_KJ) {
    return MAX_THRESHOLD_KJ;
  }
  return Math.round(value);
}

function toMetricSamples(
  samples: Array<{ t: number; power: number | null; heartRate: number | null }>,
): MetricSample[] {
  return samples
    .map((sample) => ({
      t: sample.t,
      power: sample.power ?? null,
      heartRate: sample.heartRate ?? null,
      cadence: null,
      speed: null,
      elevation: null,
      temperature: null,
    }))
    .sort((a, b) => a.t - b.t);
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

function roundNumber(value: number | null, fractionDigits = 1): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function computeDurableTssForActivity(
  activity: ActivityWithSamples,
  ftpWatts: number | null,
  thresholdKj: number,
): DurableTssRide {
  const metricSamples = toMetricSamples(activity.samples);
  const sampleRate = inferSampleRate(activity, metricSamples);

  if (metricSamples.length === 0 || sampleRate <= 0) {
    return {
      activityId: activity.id,
      startTime: activity.startTime.toISOString(),
      source: activity.source,
      totalKj: null,
      postThresholdKj: null,
      postThresholdDurationSec: null,
      durableTss: null,
    };
  }

  const interval = 1 / sampleRate;
  const thresholdJoules = thresholdKj * 1000;
  let cumulativeJoules = 0;
  let postThresholdJoules = 0;
  let startIndex: number | null = null;

  for (let index = 0; index < metricSamples.length; index += 1) {
    const sample = metricSamples[index]!;
    const power = typeof sample.power === 'number' && Number.isFinite(sample.power) ? sample.power : null;
    const joules = power != null ? power * interval : 0;

    if (startIndex != null) {
      postThresholdJoules += joules;
    } else if (cumulativeJoules + joules >= thresholdJoules) {
      startIndex = index;
      const overshoot = cumulativeJoules + joules - thresholdJoules;
      if (overshoot > 0) {
        postThresholdJoules += overshoot;
      }
    }

    cumulativeJoules += joules;
  }

  const totalKj = roundNumber(cumulativeJoules / 1000, 1);
  const postThresholdKj = startIndex != null ? roundNumber(postThresholdJoules / 1000, 1) : null;

  let durableTss: number | null = null;
  let postThresholdDurationSec: number | null = null;

  if (startIndex != null) {
    const segmentSamples = metricSamples.slice(startIndex);
    postThresholdDurationSec = roundNumber(segmentSamples.length * interval, 0);

    if (ftpWatts && ftpWatts > 0 && segmentSamples.length > 0) {
      const powerSamples = extractPowerSamples(segmentSamples);
      const normalizedWindow = Math.max(
        1,
        Math.min(Math.round(NORMALIZED_WINDOW_SECONDS * sampleRate), powerSamples.length),
      );
      const { normalizedPower } = computeNormalizedPower(powerSamples, normalizedWindow);
      if (normalizedPower != null && Number.isFinite(normalizedPower) && powerSamples.length > 0) {
        const intensityFactor = normalizedPower / ftpWatts;
        const durationHours = (segmentSamples.length * interval) / 3600;
        if (durationHours > 0) {
          const tss = intensityFactor * intensityFactor * durationHours * 100;
          durableTss = roundNumber(tss, 1);
        }
      }
    }
  }

  return {
    activityId: activity.id,
    startTime: activity.startTime.toISOString(),
    source: activity.source,
    totalKj,
    postThresholdKj,
    postThresholdDurationSec,
    durableTss,
  };
}

export async function getDurableTss(userId: string, filters: DurableTssFilters): Promise<DurableTssResponse> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  const ftpWatts = profile?.ftpWatts ?? null;

  const thresholdKj = clampThreshold(filters.thresholdKj);

  const where: Prisma.ActivityWhereInput = {
    userId,
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

  const activities = (await prisma.activity.findMany({
    where,
    orderBy: { startTime: 'asc' },
    include: {
      samples: {
        orderBy: { t: 'asc' },
        select: { t: true, power: true, heartRate: true },
      },
    },
  })) as ActivityWithSamples[];

  const rides = activities
    .filter((activity) => activity.samples.length > 0)
    .map((activity) => computeDurableTssForActivity(activity, ftpWatts, thresholdKj));

  return {
    ftpWatts,
    thresholdKj,
    filters: {
      thresholdKj,
      startDate: filters.startDate,
      endDate: filters.endDate,
    },
    rides,
  };
}
