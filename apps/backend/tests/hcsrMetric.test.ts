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
  it('computes a positive slope when HR increases with cadence', async () => {
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

    const result = await Promise.resolve(hcsrMetric.compute(samples, { activity }));

    expect(result.summary.slope_bpm_per_rpm).toBeDefined();
    expect(result.summary.slope_bpm_per_rpm).toBeGreaterThan(0.4);
    expect(result.summary.r2).toBeGreaterThan(0.9);
    expect(result.summary.bucket_count).toBe(4);
    expect(Array.isArray(result.series)).toBe(true);
  });
});
