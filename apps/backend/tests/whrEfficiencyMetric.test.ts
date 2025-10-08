import { describe, expect, it } from 'vitest';
import type { Activity } from '@prisma/client';

import { whrEfficiencyMetric } from '../src/metrics/whrEfficiency.js';
import type { MetricSample } from '../src/metrics/types.js';

const baseActivity: Activity = {
  id: 'activity-1',
  userId: null,
  source: 'test',
  startTime: new Date('2024-01-01T00:00:00Z'),
  durationSec: 3600,
  sampleRateHz: 1,
  createdAt: new Date('2024-01-01T00:00:00Z'),
};

describe('whrEfficiencyMetric', () => {
  it('computes watts-per-heart-rate percentiles across rolling windows', async () => {
    const samples: MetricSample[] = [];
    for (let minute = 0; minute < 60; minute += 1) {
      const t = minute * 60;
      const isLate = minute >= 30;
      const basePower = isLate ? 240 : 250;
      const baseHeartRate = isLate ? 170 : 160;

      samples.push({
        t,
        heartRate: baseHeartRate + (minute % 3),
        power: basePower + (minute % 4),
        cadence: null,
        speed: null,
        elevation: null,
      });
      samples.push({
        t: t + 30,
        heartRate: baseHeartRate + 1 + (minute % 2),
        power: basePower - 5 + (minute % 3),
        cadence: null,
        speed: null,
        elevation: null,
      });
    }

    const result = await whrEfficiencyMetric.compute(samples, { activity: baseActivity });
    const summary = result.summary as Record<string, unknown>;

    expect(summary.window_seconds).toBe(300);
    expect(summary.window_count).toBe(12);
    expect(summary.valid_window_count).toBe(12);
    expect(summary.valid_sample_count).toBe(120);
    expect(summary.total_sample_count).toBe(120);
    expect(summary.coverage_ratio).toBe(1);

    expect(summary.median_w_per_bpm).toBeGreaterThan(1.4);
    expect(summary.median_w_per_bpm).toBeLessThan(1.6);
    expect(summary.drift_percent).toBeLessThan(0);

    const series = Array.isArray(result.series) ? (result.series as Record<string, unknown>[]) : [];
    expect(series).toHaveLength(12);
    expect(series[0]).toMatchObject({
      window_index: 1,
      sample_count: 10,
      valid_sample_count: 10,
      coverage_ratio: 1,
    });
    expect(typeof series[0]?.p50_w_per_bpm === 'number').toBe(true);
    expect(typeof series[0]?.p25_w_per_bpm === 'number').toBe(true);
    expect(typeof series[0]?.p75_w_per_bpm === 'number').toBe(true);

    expect(series[11]).toMatchObject({ window_index: 12 });
  });

  it('returns null summaries when no paired power and heart rate data is present', async () => {
    const samples: MetricSample[] = [
      { t: 0, heartRate: null, power: 200, cadence: null, speed: null, elevation: null },
      { t: 30, heartRate: 150, power: null, cadence: null, speed: null, elevation: null },
      { t: 60, heartRate: null, power: null, cadence: null, speed: null, elevation: null },
    ];

    const result = await whrEfficiencyMetric.compute(samples, { activity: baseActivity });
    const summary = result.summary as Record<string, unknown>;

    expect(summary.median_w_per_bpm).toBeNull();
    expect(summary.coverage_ratio).toBe(0);
    expect(summary.valid_sample_count).toBe(0);
    expect(Array.isArray(result.series)).toBe(true);
    expect((result.series as unknown[]).length).toBe(0);
  });
});
