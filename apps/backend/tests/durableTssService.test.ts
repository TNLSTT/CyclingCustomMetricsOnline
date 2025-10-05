import { describe, expect, it, vi } from 'vitest';
import type { Activity } from '@prisma/client';

import type { DurableTssRide } from '../src/services/durableTssService.js';
import { __test__ } from '../src/services/durableTssService.js';
import * as powerUtils from '../src/utils/power.js';

const computeDurableTssForActivity = __test__.computeDurableTssForActivity as (
  activity: Activity & {
    samples: Array<{ t: number; power: number | null; heartRate: number | null }>;
  },
  ftpWatts: number | null,
  thresholdKj: number,
) => DurableTssRide;

describe('computeDurableTssForActivity', () => {
  it('falls back to average power when normalized power cannot be computed', () => {
    const computeNormalizedPowerSpy = vi
      .spyOn(powerUtils, 'computeNormalizedPower')
      .mockReturnValue({ normalizedPower: null, rolling: [] });

    const activity: Activity & {
      samples: Array<{ t: number; power: number | null; heartRate: number | null }>;
      metrics: [];
    } = {
      id: 'ride-1',
      userId: 'user-1',
      source: 'test',
      startTime: new Date('2024-01-01T08:00:00Z'),
      durationSec: 3600,
      sampleRateHz: 1,
      createdAt: new Date('2024-01-01T08:00:00Z'),
      samples: [],
      metrics: [],
    };

    for (let t = 0; t < 25; t += 1) {
      let power: number | null;
      if (t < 5) {
        power = 300;
      } else {
        power = t % 2 === 0 ? 200 : null;
      }

      activity.samples.push({
        t,
        power,
        heartRate: null,
      });
    }

    const ride = computeDurableTssForActivity(activity, 250, 1);

    expect(computeNormalizedPowerSpy).toHaveBeenCalled();
    expect(ride.durableTss).not.toBeNull();
    expect(ride.durableTss).toBeCloseTo(0.1, 1);

    computeNormalizedPowerSpy.mockRestore();
  });

  it('clamps the normalized power window to the available power samples', () => {
    const computeNormalizedPowerSpy = vi.spyOn(powerUtils, 'computeNormalizedPower');

    const activity: Activity & {
      samples: Array<{ t: number; power: number | null; heartRate: number | null }>;
      metrics: [];
    } = {
      id: 'ride-2',
      userId: 'user-1',
      source: 'test',
      startTime: new Date('2024-01-01T09:00:00Z'),
      durationSec: 600,
      sampleRateHz: 4,
      createdAt: new Date('2024-01-01T09:00:00Z'),
      samples: [],
      metrics: [],
    };

    const totalSamples = 50;
    for (let index = 0; index < totalSamples; index += 1) {
      activity.samples.push({
        t: index / activity.sampleRateHz,
        power: 300,
        heartRate: null,
      });
    }

    computeDurableTssForActivity(activity, 250, 1);

    expect(computeNormalizedPowerSpy).toHaveBeenCalled();
    const windowSize = computeNormalizedPowerSpy.mock.calls[0]?.[1];
    expect(windowSize).toBe(37);

    computeNormalizedPowerSpy.mockRestore();
  });
});
