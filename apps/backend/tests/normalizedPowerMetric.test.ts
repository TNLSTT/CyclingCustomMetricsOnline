import { describe, expect, it } from 'vitest';
import type { Activity } from '@prisma/client';

import { normalizedPowerMetric } from '../src/metrics/normalizedPower.js';
import type { MetricSample } from '../src/metrics/types.js';

const activity: Activity = {
  id: 'activity-1',
  userId: null,
  source: 'test',
  startTime: new Date('2024-01-01T00:00:00Z'),
  durationSec: 7200,
  sampleRateHz: 1,
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

describe('normalizedPowerMetric', () => {
  it('computes normalized power statistics for variable efforts', () => {
    const samples: MetricSample[] = [];
    for (let t = 0; t < 120; t += 1) {
      let power = 150;
      if (t >= 30 && t < 60) {
        power = 250;
      } else if (t >= 60 && t < 90) {
        power = 400;
      } else if (t >= 90) {
        power = 80;
      }
      samples.push({
        t,
        heartRate: null,
        cadence: null,
        power,
        speed: null,
        elevation: null,
      });
    }

    const result = normalizedPowerMetric.compute(samples, { activity });
    const summary = result.summary as Record<string, unknown>;

    const normalizedPower = summary.normalized_power_w as number;
    const averagePower = summary.average_power_w as number;
    const variabilityIndex = summary.variability_index as number;
    const coastingShare = summary.coasting_share as number;
    const validSamples = summary.valid_power_samples as number;
    const rollingWindows = summary.rolling_window_count as number;

    expect(typeof normalizedPower).toBe('number');
    expect(typeof averagePower).toBe('number');
    expect(normalizedPower).toBeGreaterThan(averagePower);
    expect(variabilityIndex).toBeGreaterThan(1);
    expect(coastingShare).toBe(0);
    expect(validSamples).toBe(120);
    expect(rollingWindows).toBe(91);
    expect(Array.isArray(result.series)).toBe(true);
    expect((result.series as any[]).length).toBe(91);
  });

  it('yields null normalized power when insufficient samples are present', () => {
    const samples: MetricSample[] = Array.from({ length: 10 }).map((_, index) => ({
      t: index,
      heartRate: null,
      cadence: null,
      power: 200,
      speed: null,
      elevation: null,
    }));

    const result = normalizedPowerMetric.compute(samples, { activity });
    const summary = result.summary as Record<string, unknown>;

    expect(summary.normalized_power_w).toBeNull();
    const insufficientRolling = summary.rolling_window_count as number;
    expect(insufficientRolling).toBe(0);
  });
});
