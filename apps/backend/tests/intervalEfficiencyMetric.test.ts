import { describe, expect, it } from 'vitest';
import type { Activity } from '@prisma/client';

import { intervalEfficiencyMetric } from '../src/metrics/intervalEfficiency.js';
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

describe('intervalEfficiencyMetric', () => {
  it('computes per-interval averages and efficiency', () => {
    const samples: MetricSample[] = [
      {
        t: 0,
        heartRate: 150,
        cadence: 90,
        power: 200,
        speed: null,
        elevation: null,
        temperature: 25,
      },
      {
        t: 1800,
        heartRate: 148,
        cadence: 92,
        power: 180,
        speed: null,
        elevation: null,
        temperature: 26,
      },
      {
        t: 3600,
        heartRate: 140,
        cadence: 85,
        power: 210,
        speed: null,
        elevation: null,
        temperature: 27,
      },
      {
        t: 4000,
        heartRate: 142,
        cadence: 83,
        power: 220,
        speed: null,
        elevation: null,
        temperature: 28,
      },
    ];

    const result = intervalEfficiencyMetric.compute(samples, { activity });
    expect(result.summary.interval_seconds).toBe(3600);
    expect(result.summary.interval_count).toBe(2);

    expect(Array.isArray(result.series)).toBe(true);
    const intervals = Array.isArray(result.series) ? (result.series as any[]) : [];
    expect(intervals).toHaveLength(2);

    expect(intervals[0]).toMatchObject({
      interval: 1,
      avg_power: 190,
      avg_hr: 149,
      avg_cadence: 91,
      avg_temp: 25.5,
      w_per_hr: 1.28,
    });

    expect(intervals[1]).toMatchObject({
      interval: 2,
      avg_power: 215,
      avg_hr: 141,
      avg_cadence: 84,
      avg_temp: 27.5,
      w_per_hr: 1.52,
    });
  });

  it('yields null efficiency when heart rate data is unavailable', () => {
    const samples: MetricSample[] = [
      {
        t: 0,
        heartRate: null,
        cadence: 90,
        power: 200,
        speed: null,
        elevation: null,
        temperature: 25,
      },
      {
        t: 10,
        heartRate: null,
        cadence: 90,
        power: 210,
        speed: null,
        elevation: null,
        temperature: null,
      },
    ];

    const result = intervalEfficiencyMetric.compute(samples, { activity });
    const intervals = Array.isArray(result.series) ? (result.series as any[]) : [];
    expect(intervals).toHaveLength(1);
    expect(intervals[0]).toMatchObject({
      interval: 1,
      avg_power: 205,
      avg_hr: null,
      avg_temp: 25,
      w_per_hr: null,
    });
  });
});
