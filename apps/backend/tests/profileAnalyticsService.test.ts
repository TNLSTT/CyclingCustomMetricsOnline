import { describe, expect, it } from 'vitest';

import {
  buildMetricSnapshots,
  mergeProfileAnalytics,
} from '../src/services/profileAnalyticsService.js';
import { prismaMock } from './setup.js';

describe('mergeProfileAnalytics', () => {
  it('stores metric snapshots and merges subsequent updates', async () => {
    const userId = 'user-analytics';

    const firstSnapshots = {
      'normalized-power': {
        activityId: 'activity-1',
        activityStartTime: new Date('2024-01-01T00:00:00Z').toISOString(),
        activityDurationSec: 3600,
        activitySource: 'garmin',
        computedAt: new Date('2024-01-02T00:00:00Z').toISOString(),
        summary: { normalized_power_w: 255 },
      },
    };

    await mergeProfileAnalytics(userId, { metrics: firstSnapshots });

    let profile = await prismaMock.profile.findUnique({ where: { userId } });
    expect(profile).not.toBeNull();
    const analytics = profile?.analytics as { metrics?: Record<string, unknown> } | null;
    expect(analytics?.metrics).toBeDefined();
    expect(analytics?.metrics).toHaveProperty('normalized-power');

    const secondSnapshots = {
      'interval-efficiency': {
        activityId: 'activity-2',
        activityStartTime: new Date('2024-02-01T00:00:00Z').toISOString(),
        activityDurationSec: 5400,
        activitySource: 'garmin',
        computedAt: new Date('2024-02-02T00:00:00Z').toISOString(),
        summary: { watts_per_hr: 2.85 },
      },
    };

    await mergeProfileAnalytics(userId, { metrics: secondSnapshots });

    profile = await prismaMock.profile.findUnique({ where: { userId } });
    const merged = profile?.analytics as { metrics?: Record<string, unknown> } | null;
    expect(merged?.metrics).toBeDefined();
    expect(merged?.metrics).toHaveProperty('normalized-power');
    expect(merged?.metrics).toHaveProperty('interval-efficiency');
  });
});

describe('buildMetricSnapshots', () => {
  it('includes metric metadata when available', () => {
    const activity = {
      id: 'activity-1',
      startTime: new Date('2024-03-01T00:00:00Z'),
      durationSec: 3600,
      source: 'test',
    };

    const metadata = {
      'normalized-power': {
        metricVersion: 3,
        metricName: 'Normalized Power',
        metricDescription: 'Estimates sustained power output',
        metricUnits: 'W',
      },
    };

    const snapshots = buildMetricSnapshots(activity, metadata, {
      'normalized-power': {
        summary: { normalized_power_w: 280 },
      },
    });

    expect(snapshots['normalized-power']).toMatchObject({
      metricVersion: 3,
      metricName: 'Normalized Power',
      metricDescription: 'Estimates sustained power output',
      metricUnits: 'W',
    });
  });
});
