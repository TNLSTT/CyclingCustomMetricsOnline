import {
  computeR2,
  linearRegression,
  median,
  quantile,
  theilSenSlope,
  type XYPoint,
} from '../utils/statistics.js';

import type { MetricModule, MetricSample } from './types.js';

const MIN_CADENCE = 20;
const BUCKET_SIZE = 10;
const REQUIRED_SECONDS_PER_BUCKET = 60;

interface BucketStats {
  cadenceStart: number;
  cadenceEnd: number;
  cadenceMid: number;
  seconds: number;
  medianHR: number;
  hr25: number;
  hr75: number;
}

function bucketKey(cadence: number): number {
  if (cadence >= 130) {
    return 130;
  }
  return Math.floor(cadence / BUCKET_SIZE) * BUCKET_SIZE;
}

function cadenceMidpoint(bucketStart: number): number {
  if (bucketStart >= 130) {
    return 135;
  }
  return bucketStart + BUCKET_SIZE / 2;
}

function fallbackIntervalSeconds(sampleRateHz: number | null | undefined) {
  if (typeof sampleRateHz === 'number' && Number.isFinite(sampleRateHz) && sampleRateHz > 0) {
    return 1 / sampleRateHz;
  }
  return 1;
}

function resolveSampleDuration(
  samples: MetricSample[],
  index: number,
  defaultInterval: number,
): number {
  const current = samples[index]!;
  const next = index < samples.length - 1 ? samples[index + 1] : null;
  if (next) {
    const delta = next.t - current.t;
    if (Number.isFinite(delta) && delta > 0) {
      return delta;
    }
  }

  if (index > 0) {
    const previous = samples[index - 1]!;
    const delta = current.t - previous.t;
    if (Number.isFinite(delta) && delta > 0) {
      return delta;
    }
  }

  return defaultInterval;
}

function buildBuckets(samples: MetricSample[], sampleRateHz: number | null | undefined) {
  const sortedSamples = [...samples].sort((a, b) => a.t - b.t);
  const buckets = new Map<
    number,
    { heartRates: number[]; seconds: number }
  >();
  const defaultInterval = fallbackIntervalSeconds(sampleRateHz);
  let validSeconds = 0;

  for (let index = 0; index < sortedSamples.length; index += 1) {
    const sample = sortedSamples[index]!;
    if (sample.heartRate == null || sample.cadence == null) {
      continue;
    }
    if (sample.cadence < MIN_CADENCE) {
      continue;
    }
    const durationSeconds = resolveSampleDuration(sortedSamples, index, defaultInterval);
    validSeconds += durationSeconds;
    const key = bucketKey(sample.cadence);
    const bucket = buckets.get(key) ?? { heartRates: [], seconds: 0 };
    bucket.heartRates.push(sample.heartRate);
    bucket.seconds += durationSeconds;
    buckets.set(key, bucket);
  }

  const bucketStats: BucketStats[] = [];
  for (const [key, value] of buckets) {
    if (value.seconds + 1e-6 < REQUIRED_SECONDS_PER_BUCKET) {
      continue;
    }
    bucketStats.push({
      cadenceStart: key,
      cadenceEnd: key >= 130 ? 999 : key + BUCKET_SIZE - 1,
      cadenceMid: cadenceMidpoint(key),
      seconds: Number.parseFloat(value.seconds.toFixed(3)),
      medianHR: median(value.heartRates),
      hr25: quantile(value.heartRates, 0.25),
      hr75: quantile(value.heartRates, 0.75),
    });
  }

  bucketStats.sort((a, b) => a.cadenceMid - b.cadenceMid);

  return { bucketStats, validSeconds: Number.parseFloat(validSeconds.toFixed(3)) };
}

function toPoints(bucketStats: BucketStats[]): XYPoint[] {
  return bucketStats.map((bucket) => ({
    x: bucket.cadenceMid,
    y: bucket.medianHR,
  }));
}

function computePiecewiseR2(points: XYPoint[], globalSsTot: number) {
  if (points.length < 4) {
    return null;
  }
  const midIndex = Math.floor(points.length / 2);
  const firstHalf = points.slice(0, midIndex);
  const secondHalf = points.slice(midIndex);
  if (firstHalf.length < 2 || secondHalf.length < 2) {
    return null;
  }
  const firstFit = linearRegression(firstHalf);
  const secondFit = linearRegression(secondHalf);

  let ssResPiecewise = 0;
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const prediction =
      i < firstHalf.length
        ? firstFit.slope * point.x + firstFit.intercept
        : secondFit.slope * point.x + secondFit.intercept;
    ssResPiecewise += (point.y - prediction) ** 2;
  }
  const piecewiseR2 = globalSsTot === 0 ? 1 : 1 - ssResPiecewise / globalSsTot;
  return piecewiseR2;
}

function computeSlopeForHalf(samples: MetricSample[], maxTime: number | null) {
  const filtered = samples.filter((sample) => {
    if (sample.heartRate == null || sample.cadence == null) {
      return false;
    }
    if (sample.cadence < MIN_CADENCE) {
      return false;
    }
    if (maxTime == null) {
      return true;
    }
    return sample.t <= maxTime;
  });

  if (filtered.length < 2) {
    return null;
  }

  const points = filtered.map((sample) => ({
    x: sample.cadence as number,
    y: sample.heartRate as number,
  }));
  return linearRegression(points).slope;
}

function computeSlopeForSecondHalf(samples: MetricSample[], minTime: number) {
  const filtered = samples.filter((sample) => {
    if (sample.heartRate == null || sample.cadence == null) {
      return false;
    }
    if (sample.cadence < MIN_CADENCE) {
      return false;
    }
    return sample.t > minTime;
  });

  if (filtered.length < 2) {
    return null;
  }

  const points = filtered.map((sample) => ({
    x: sample.cadence as number,
    y: sample.heartRate as number,
  }));
  return linearRegression(points).slope;
}

export const hcsrMetric: MetricModule = {
  definition: {
    key: 'hcsr',
    name: 'HR-to-Cadence Scaling Ratio',
    version: 1,
    description:
      'Quantifies how heart rate scales with cadence across cadence buckets with fatigue diagnostics.',
    units: 'bpm/rpm',
    computeConfig: {
      cadenceBucketSize: BUCKET_SIZE,
      minCadence: MIN_CADENCE,
      requiredSecondsPerBucket: REQUIRED_SECONDS_PER_BUCKET,
    },
  },
  compute: (samples, context) => {
    const { bucketStats, validSeconds } = buildBuckets(
      samples,
      context.activity.sampleRateHz,
    );
    const points = toPoints(bucketStats);

    let slope: number | null = null;
    let intercept: number | null = null;
    let r2: number | null = null;
    let nonlinearityDelta: number | null = null;
    let piecewiseR2: number | null = null;

    if (points.length >= 2) {
      const robustFit = theilSenSlope(points);
      if (robustFit) {
        slope = Number.parseFloat(robustFit.slope.toFixed(4));
        intercept = Number.parseFloat(robustFit.intercept.toFixed(2));
      } else {
        const ols = linearRegression(points);
        slope = Number.parseFloat(ols.slope.toFixed(4));
        intercept = Number.parseFloat(ols.intercept.toFixed(2));
      }
      if (slope !== null && intercept !== null) {
        const { r2: computedR2, ssTot } = computeR2(points, slope, intercept);
        r2 = Number.parseFloat(computedR2.toFixed(4));
        const piecewise = computePiecewiseR2(points, ssTot);
        if (piecewise != null) {
          piecewiseR2 = Number.parseFloat(piecewise.toFixed(4));
          nonlinearityDelta = Number.parseFloat(
            (piecewiseR2 - (r2 ?? 0)).toFixed(4),
          );
        }
      }
    }

    const halfDuration = Math.floor(context.activity.durationSec / 2);
    const firstHalfSlope = computeSlopeForHalf(samples, halfDuration);
    const secondHalfSlope = computeSlopeForSecondHalf(samples, halfDuration);
    const deltaSlopeHalf =
      firstHalfSlope != null && secondHalfSlope != null
        ? Number.parseFloat((secondHalfSlope - firstHalfSlope).toFixed(4))
        : null;

    const series = bucketStats.map((bucket) => ({
      cadenceMid: bucket.cadenceMid,
      medianHR: bucket.medianHR,
      seconds: bucket.seconds,
      hr25: bucket.hr25,
      hr75: bucket.hr75,
    }));

    return {
      summary: {
        slope_bpm_per_rpm: slope,
        intercept_bpm: intercept,
        r2,
        nonlinearity_delta: nonlinearityDelta,
        half_split_delta_slope: deltaSlopeHalf,
        valid_seconds: validSeconds,
        bucket_count: bucketStats.length,
        piecewise_r2: piecewiseR2,
      },
      series,
    };
  },
};
