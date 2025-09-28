import { describe, expect, it } from 'vitest';

import { lateAerobicEfficiencyMetric } from '../src/metrics/lateAerobicEfficiency.js';
import type { MetricSample } from '../src/metrics/types.js';

describe('lateAerobicEfficiencyMetric', () => {
  it('computes watts per bpm for the late-ride window', () => {
    const totalMinutes = 120;
    const totalSeconds = totalMinutes * 60;

    const samples: MetricSample[] = Array.from({ length: totalSeconds }, (_, index) => {
      const t = index;
      const inWindow = t >= totalSeconds - 2100 && t < totalSeconds - 300;
      return {
        t,
        power: inWindow ? 210 : 180,
        heartRate: inWindow ? 140 : 125,
        cadence: null,
        speed: null,
        elevation: null,
      };
    });

    const activity = {
      id: 'act_1',
      userId: null,
      source: 'test',
      startTime: new Date(),
      durationSec: totalSeconds,
      sampleRateHz: 1,
      createdAt: new Date(),
    } as const;

    const computation = lateAerobicEfficiencyMetric.compute(samples, { activity });
    if (computation instanceof Promise) {
      throw new Error('Metric should compute synchronously in this test');
    }

    expect(computation.summary.watts_per_bpm).toBeCloseTo(1.5, 3);
    expect(computation.summary.average_power_w).toBeCloseTo(210);
    expect(computation.summary.average_heart_rate_bpm).toBeCloseTo(140);
    expect(computation.summary.valid_sample_count).toBe(1800);
    expect(computation.summary.total_window_sample_count).toBe(1800);
  });

  it('handles missing data gracefully', () => {
    const samples: MetricSample[] = Array.from({ length: 1000 }, (_, index) => ({
      t: index,
      power: index < 700 ? null : 200,
      heartRate: null,
      cadence: null,
      speed: null,
      elevation: null,
    }));

    const activity = {
      id: 'act_2',
      userId: null,
      source: 'test',
      startTime: new Date(),
      durationSec: 1000,
      sampleRateHz: 1,
      createdAt: new Date(),
    } as const;

    const computation = lateAerobicEfficiencyMetric.compute(samples, { activity });
    if (computation instanceof Promise) {
      throw new Error('Metric should compute synchronously in this test');
    }

    expect(computation.summary.watts_per_bpm).toBeNull();
    expect(computation.summary.average_power_w).toBeNull();
    expect(computation.summary.average_heart_rate_bpm).toBeNull();
    expect(computation.summary.valid_sample_count).toBe(0);
    expect(computation.summary.total_window_sample_count).toBeGreaterThan(0);
  });
});
