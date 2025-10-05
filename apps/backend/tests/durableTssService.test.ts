import { describe, expect, it, vi } from 'vitest';
import type { Activity, Prisma, Profile } from '@prisma/client';

import type { DurableTssRide } from '../src/services/durableTssService.js';
import { __test__, resolveFtpWatts } from '../src/services/durableTssService.js';
import * as powerUtils from '../src/utils/power.js';

// Narrow the internal test-only function
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

// ---- resolveFtpWatts tests ----

function createProfile(overrides: Partial<Profile> = {}): Profile {
  const base: Profile = {
    id: 'profile-1',
    userId: 'user-1',
    displayName: null,
    avatarUrl: null,
    bio: null,
    location: null,
    primaryDiscipline: null,
    trainingFocus: null,
    weeklyGoalHours: null,
    ftpWatts: null,
    weightKg: null,
    hrMaxBpm: null,
    hrRestBpm: null,
    websiteUrl: null,
    instagramHandle: null,
    achievements: null,
    analytics: {} as Prisma.JsonObject,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { ...base, ...overrides };
}

describe('resolveFtpWatts', () => {
  it('returns the explicit FTP value when present', () => {
    const profile = createProfile({ ftpWatts: 255 });
    expect(resolveFtpWatts(profile)).toBe(255);
  });

  it('falls back to the adaptation FTP estimate when FTP is missing', () => {
    const profile = createProfile({
      ftpWatts: null,
      analytics: {
        adaptationEdges: {
          ftpEstimate: 247.3,
        },
      } as Prisma.JsonObject,
    });

    expect(resolveFtpWatts(profile)).toBeCloseTo(247.3, 5);
  });

  it('returns null when neither explicit FTP nor an estimate are available', () => {
    const profile = createProfile({ ftpWatts: null, analytics: {} as Prisma.JsonObject });
    expect(resolveFtpWatts(profile)).toBeNull();
  });

  it('ignores non-numeric FTP estimates', () => {
    const profile = createProfile({
      ftpWatts: null,
      analytics: {
        adaptationEdges: {
          ftpEstimate: 'not-a-number',
        },
      } as Prisma.JsonObject,
    });

    expect(resolveFtpWatts(profile)).toBeNull();
  });
});
