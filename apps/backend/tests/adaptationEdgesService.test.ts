import { beforeEach, describe, expect, it } from 'vitest';

import { prisma } from '../src/prisma.js';
import { computeAdaptationEdges } from '../src/services/adaptationEdgesService.js';

async function ensureNormalizedPowerDefinition() {
  const definition = await prisma.metricDefinition.upsert({
    where: { key: 'normalized-power' },
    update: {
      name: 'Normalized Power',
      description: 'Test definition',
      version: 1,
      units: 'W',
    },
    create: {
      key: 'normalized-power',
      name: 'Normalized Power',
      description: 'Test definition',
      version: 1,
      units: 'W',
    },
  });

  return definition.id;
}

interface ActivityParams {
  start: string;
  durationSec: number;
  averagePower: number | null;
  normalizedPower: number | null;
  userId: string;
  definitionId: string;
}

async function createActivityWithMetric(params: ActivityParams) {
  const activity = await prisma.activity.create({
    data: {
      source: 'test',
      startTime: new Date(params.start),
      durationSec: params.durationSec,
      sampleRateHz: 1,
      user: { connect: { id: params.userId } },
    },
  });

  await prisma.metricResult.upsert({
    where: {
      activityId_metricDefinitionId: {
        activityId: activity.id,
        metricDefinitionId: params.definitionId,
      },
    },
    update: {
      summary: {
        normalized_power_w: params.normalizedPower,
        average_power_w: params.averagePower,
      },
      series: null,
      computedAt: new Date(),
    },
    create: {
      activityId: activity.id,
      metricDefinitionId: params.definitionId,
      summary: {
        normalized_power_w: params.normalizedPower,
        average_power_w: params.averagePower,
      },
      series: null,
      computedAt: new Date(),
    },
  });

  return activity.id;
}

describe('computeAdaptationEdges', () => {
  const userId = 'user-1';
  let definitionId: string;

  beforeEach(async () => {
    definitionId = await ensureNormalizedPowerDefinition();
  });

  it('summarizes the strongest contiguous training blocks', async () => {
    const dates = [
      '2024-01-01T08:00:00Z',
      '2024-01-02T08:00:00Z',
      '2024-01-03T08:00:00Z',
      '2024-01-04T08:00:00Z',
    ];
    const durations = [3600, 5400, 7200, 3600];
    const averagePowers = [180, 200, 220, 150];
    const normalizedPowers = [190, 210, 230, 160];

    for (let index = 0; index < dates.length; index += 1) {
      await createActivityWithMetric({
        start: dates[index]!,
        durationSec: durations[index]!,
        averagePower: averagePowers[index]!,
        normalizedPower: normalizedPowers[index]!,
        userId,
        definitionId,
      });
    }

    const summary = await computeAdaptationEdges(userId);

    expect(summary.ftpEstimate).toBeCloseTo(230, 5);
    expect(summary.totalActivities).toBe(4);
    expect(summary.totalKilojoules).toBeCloseTo(3852, 5);
    expect(summary.totalTss).toBeCloseTo(441.68, 2);
    expect(summary.analyzedDays).toBe(4);

    const window3 = summary.windows.find((window) => window.days === 3);
    expect(window3).toBeDefined();
    expect(window3?.bestTss).not.toBeNull();
    expect(window3?.bestTss?.total).toBeCloseTo(393.29, 2);
    expect(window3?.bestTss?.startDate).toBe('2024-01-01T00:00:00.000Z');
    expect(window3?.bestTss?.endDate).toBe('2024-01-03T00:00:00.000Z');
    expect(window3?.bestTss?.contributingDays).toHaveLength(3);
    expect(window3?.bestTss?.contributingDays[0]?.tss).toBeCloseTo(68.24, 2);
    expect(window3?.bestTss?.contributingDays[1]?.tss).toBeCloseTo(125.05, 2);
    expect(window3?.bestKilojoules?.total).toBeCloseTo(3312, 5);
    expect(window3?.bestKilojoules?.contributingDays[2]?.kilojoules).toBeCloseTo(1584, 5);

    const window10 = summary.windows.find((window) => window.days === 10);
    expect(window10?.bestKilojoules).toBeNull();
  });

  it('omits TSS blocks when normalized power is unavailable', async () => {
    const dates = [
      '2024-02-01T08:00:00Z',
      '2024-02-02T08:00:00Z',
      '2024-02-03T08:00:00Z',
    ];

    for (const date of dates) {
      await createActivityWithMetric({
        start: date,
        durationSec: 3600,
        averagePower: 190,
        normalizedPower: null,
        userId,
        definitionId,
      });
    }

    const summary = await computeAdaptationEdges(userId);

    expect(summary.ftpEstimate).toBeNull();
    const window3 = summary.windows.find((window) => window.days === 3);
    expect(window3?.bestTss).toBeNull();
    expect(window3?.bestKilojoules).not.toBeNull();
  });
});
