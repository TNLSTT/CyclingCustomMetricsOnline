import { prisma } from '../prisma.js';
import type { ActivityWithMetrics } from '../utils/activityMapper.js';
import { mapActivity } from '../utils/activityMapper.js';

type Sample = {
  t: number;
  power: number | null;
  heartRate: number | null;
  elevation: number | null;
  speed: number | null;
};

type PowerHeartPoint = { power: number; heartRate: number };

type ClimbProfilePoint = {
  distanceKm: number;
  elevationM: number;
  elapsedSec: number;
};

type WPrimePoint = { elapsedSec: number; balanceJ: number };

export interface ActivityComparisonData {
  activity: ReturnType<typeof mapActivity>;
  averagePower: number | null;
  averageHeartRate: number | null;
  totalDistanceKm: number | null;
  cpEstimate: number | null;
  wPrimeCapacity: number;
  powerHeartRate: PowerHeartPoint[];
  climbProfile: ClimbProfilePoint[];
  wPrimeBalance: WPrimePoint[];
}

export function downsample<T>(values: T[], maxPoints: number): T[] {
  if (values.length <= maxPoints) {
    return values;
  }
  const step = Math.ceil(values.length / maxPoints);
  const sampled: T[] = [];
  for (let index = 0; index < values.length; index += step) {
    sampled.push(values[index]!);
  }
  const last = values[values.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

export function percentile(values: number[], ratio: number) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(ratio * (sorted.length - 1))));
  return sorted[index] ?? null;
}

export function computeWPrimeBalance(
  samples: Sample[],
  cpEstimate: number | null,
  wPrimeCapacity: number,
): WPrimePoint[] {
  if (samples.length === 0) {
    return [];
  }

  const cp = cpEstimate ?? 250;
  let balance = wPrimeCapacity;
  let previousT = samples[0]!.t;
  const points: WPrimePoint[] = [];

  for (const sample of samples) {
    const elapsedSec = sample.t;
    const dt = Math.max(0, elapsedSec - previousT);
    const power = sample.power;

    if (power != null && dt > 0) {
      if (power > cp) {
        const depletion = (power - cp) * dt;
        balance = Math.max(0, balance - depletion);
      } else if (power < cp) {
        const recoveryRate = cp - power;
        if (recoveryRate > 0) {
          const tau = wPrimeCapacity / recoveryRate;
          if (tau > 0) {
            const recovered = (wPrimeCapacity - balance) * (1 - Math.exp(-dt / tau));
            balance = Math.min(wPrimeCapacity, balance + recovered);
          }
        }
      }
    }

    points.push({ elapsedSec, balanceJ: Number(balance.toFixed(2)) });
    previousT = elapsedSec;
  }

  return points;
}

export function computeProfiles(samples: Sample[]) {
  const heartPower: PowerHeartPoint[] = [];
  const climb: ClimbProfilePoint[] = [];

  let distanceMeters = 0;
  let previousT = samples[0]?.t ?? 0;
  let previousSpeed: number | null = samples[0]?.speed ?? null;
  let currentElevation: number | null = samples[0]?.elevation ?? null;

  for (const sample of samples) {
    const elapsedSec = sample.t;
    const dt = Math.max(0, elapsedSec - previousT);

    const speed = sample.speed ?? previousSpeed;
    if (speed != null && dt > 0) {
      distanceMeters += speed * dt;
    }

    if (sample.elevation != null) {
      currentElevation = sample.elevation;
    }

    if (sample.power != null && sample.heartRate != null) {
      heartPower.push({ power: sample.power, heartRate: sample.heartRate });
    }

    if (currentElevation != null) {
      climb.push({
        distanceKm: Number((distanceMeters / 1000).toFixed(4)),
        elevationM: Number(currentElevation.toFixed(2)),
        elapsedSec,
      });
    }

    previousT = elapsedSec;
    previousSpeed = speed ?? previousSpeed;
  }

  return {
    heartPower: downsample(heartPower, 1500),
    climb: downsample(climb, 800),
  };
}

export function computeAverages(samples: Sample[]) {
  let powerSum = 0;
  let powerCount = 0;
  let hrSum = 0;
  let hrCount = 0;

  for (const sample of samples) {
    if (sample.power != null) {
      powerSum += sample.power;
      powerCount += 1;
    }
    if (sample.heartRate != null) {
      hrSum += sample.heartRate;
      hrCount += 1;
    }
  }

  return {
    averagePower: powerCount > 0 ? Number((powerSum / powerCount).toFixed(2)) : null,
    averageHeartRate: hrCount > 0 ? Number((hrSum / hrCount).toFixed(2)) : null,
  };
}

async function fetchActivityWithSamples(activityId: string, userId?: string) {
  const [activity, samples] = await Promise.all([
    prisma.activity.findFirst({
      where: { id: activityId, ...(userId ? { userId } : {}) },
      include: {
        metrics: {
          include: { metricDefinition: true },
          orderBy: { computedAt: 'desc' },
        },
      },
    }),
    prisma.activitySample.findMany({
      where: {
        activityId,
        ...(userId ? { activity: { userId } } : {}),
      },
      orderBy: { t: 'asc' },
      select: {
        t: true,
        power: true,
        heartRate: true,
        elevation: true,
        speed: true,
      },
    }),
  ]);

  if (!activity) {
    return { activity: null, samples: [] } as const;
  }

  const mappedSamples: Sample[] = samples.map((sample) => ({
    t: sample.t,
    power: sample.power ?? null,
    heartRate: sample.heartRate ?? null,
    elevation: sample.elevation ?? null,
    speed: sample.speed ?? null,
  }));

  return { activity, samples: mappedSamples } as const;
}

export async function buildActivityComparison(
  activityId: string,
  userId?: string,
): Promise<ActivityComparisonData> {
  const { activity, samples } = await fetchActivityWithSamples(activityId, userId);

  if (!activity) {
    const error = new Error('Activity not found');
    (error as { status?: number }).status = 404;
    throw error;
  }

  const mappedActivity = mapActivity(activity as ActivityWithMetrics);
  const powerValues = samples.map((sample) => sample.power).filter((value): value is number => value != null);
  const cpEstimate = percentile(powerValues, 0.9);
  const wPrimeCapacity = cpEstimate != null ? Math.max(10000, cpEstimate * 60) : 15000;

  const { averagePower, averageHeartRate } = computeAverages(samples);
  const { heartPower, climb } = computeProfiles(samples);
  const wPrime = computeWPrimeBalance(samples, cpEstimate, wPrimeCapacity);

  const climbProfile = climb;
  const totalDistanceKm = climbProfile.length > 0 ? climbProfile[climbProfile.length - 1]!.distanceKm : null;

  return {
    activity: mappedActivity,
    averagePower,
    averageHeartRate,
    totalDistanceKm,
    cpEstimate,
    wPrimeCapacity,
    powerHeartRate: heartPower,
    climbProfile,
    wPrimeBalance: downsample(wPrime, 1000),
  };
}
