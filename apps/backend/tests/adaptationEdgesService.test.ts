import { describe, expect, it } from 'vitest';

import { computeAdaptationEdges } from '../src/services/adaptationEdgesService.js';
import { prismaMock } from './setup';

const USER_ID = 'user-1';
const BASE_START = new Date('2024-01-01T12:00:00Z');

async function createActivity(dayOffset: number, durationSec: number, power: number) {
  const startTime = new Date(BASE_START);
  startTime.setUTCDate(BASE_START.getUTCDate() + dayOffset);

  const activity = await prismaMock.activity.create({
    data: {
      source: 'test-fit',
      startTime,
      durationSec,
      sampleRateHz: 1,
      user: { connect: { id: USER_ID } },
    },
  });

  const samples = [] as Array<{
    activityId: string;
    t: number;
    heartRate: number | null;
    cadence: number | null;
    power: number | null;
    speed: number | null;
    elevation: number | null;
    temperature: number | null;
  }>;

  for (let t = 0; t <= durationSec; t += 1) {
    samples.push({
      activityId: activity.id,
      t,
      heartRate: null,
      cadence: null,
      power,
      speed: null,
      elevation: null,
      temperature: null,
    });
  }

  await prismaMock.activitySample.createMany({ data: samples });

  return activity;
}

describe('computeAdaptationEdges', () => {
  it('summarizes deepest blocks across rolling windows', async () => {
    const activities = await Promise.all([
      createActivity(0, 1800, 200),
      createActivity(1, 1800, 220),
      createActivity(2, 1800, 230),
      createActivity(3, 1800, 150),
      createActivity(4, 1800, 180),
    ]);

    const analysis = await computeAdaptationEdges(USER_ID);

    expect(analysis.ftpEstimate).toBeGreaterThan(0);
    expect(analysis.windowSummaries.length).toBeGreaterThan(0);

    const window3 = analysis.windowSummaries.find((entry) => entry.windowDays === 3);
    expect(window3?.bestKj).not.toBeNull();
    expect(window3?.bestKj?.activityIds.sort()).toEqual(
      [activities[0]!.id, activities[1]!.id, activities[2]!.id].sort(),
    );
    expect(window3?.bestKj?.totalKj ?? 0).toBeGreaterThan(window3?.bestKj?.totalTrainingLoad ?? 0);

    const window5 = analysis.windowSummaries.find((entry) => entry.windowDays === 5);
    expect(window5?.bestTrainingLoad?.activityIds.sort()).toEqual(
      activities.map((activity) => activity.id).sort(),
    );
    expect(window5?.bestTrainingLoad?.totalTrainingLoad ?? 0).toBeGreaterThan(0);

    const window25 = analysis.windowSummaries.find((entry) => entry.windowDays === 25);
    expect(window25?.bestKj).toBeNull();
    expect(window25?.bestTrainingLoad).toBeNull();
  });

  it('returns empty analysis when no activities exist', async () => {
    const analysis = await computeAdaptationEdges('missing-user');
    expect(analysis.ftpEstimate).toBeNull();
    expect(analysis.windowSummaries).toEqual([]);
  });
});
