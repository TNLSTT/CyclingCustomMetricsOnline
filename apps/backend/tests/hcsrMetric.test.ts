import { describe, expect, it } from 'vitest';

import { hcsrMetric } from '../src/metrics/hcsr.js';
import type { MetricSample } from '../src/metrics/types.js';

function buildSamples(): MetricSample[] {
  const samples: MetricSample[] = [];
  let t = 0;
  const cadenceBuckets = [
    { cadence: 60, seconds: 120 },
    { cadence: 80, seconds: 120 },
    { cadence: 100, seconds: 120 },
    { cadence: 120, seconds: 120 },
  ];
  const slope = 0.45;
  for (const bucket of cadenceBuckets) {
    for (let i = 0; i < bucket.seconds; i += 1) {
      const noise = ((i % 5) - 2) * 0.1;
      samples.push({
        t,
        cadence: bucket.cadence,
        heartRate: Math.round(95 + slope * bucket.cadence + noise),
        power: null,
        speed: null,
        elevation: null,
      });
      t += 1;
    }
  }
  return samples;
}

describe('hcsrMetric', () => {
  it('computes a positive slope when HR increases with cadence', () => {
    const samples = buildSamples();
    const activity = {
      id: 'act_1',
      userId: null,
      source: 'garmin-fit',
      startTime: new Date(),
      durationSec: samples[samples.length - 1].t,
      sampleRateHz: 1,
      createdAt: new Date(),
    } as const;

    const computation = hcsrMetric.compute(samples, { activity });
    if (computation instanceof Promise) {
      throw new Error('hcsrMetric.compute should resolve synchronously during this test');
    }

    expect(computation.summary.slope_bpm_per_rpm).toBeDefined();
    expect(computation.summary.slope_bpm_per_rpm).toBeGreaterThan(0.4);
    expect(computation.summary.r2).toBeGreaterThan(0.9);
    expect(computation.summary.bucket_count).toBe(4);
    expect(Array.isArray(computation.series)).toBe(true);
  });

  it('counts bucket durations using sample spacing when sample rate is below 1 Hz', () => {
    const cadence = 70;
    const samples: MetricSample[] = [];
    for (let i = 0; i < 30; i += 1) {
      samples.push({
        t: i * 2,
        cadence,
        heartRate: 120,
        power: null,
        speed: null,
        elevation: null,
      });
    }

    const activity = {
      id: 'act_low_rate',
      userId: null,
      source: 'garmin-fit',
      startTime: new Date(),
      durationSec: 60,
      sampleRateHz: 0.5,
      createdAt: new Date(),
    } as const;

    const computation = hcsrMetric.compute(samples, { activity });
    if (computation instanceof Promise) {
      throw new Error('hcsrMetric.compute should resolve synchronously during this test');
    }

    expect(computation.summary.bucket_count).toBe(1);
    expect(computation.summary.valid_seconds).toBeCloseTo(60, 3);
    expect(Array.isArray(computation.series)).toBe(true);
    const series = computation.series as Array<{ seconds: number }>;
    expect(series[0]?.seconds).toBeCloseTo(60, 3);
  });
});
