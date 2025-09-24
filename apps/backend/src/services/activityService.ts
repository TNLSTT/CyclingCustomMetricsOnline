import type { Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';
import type { NormalizedActivity } from '../types.js';

const SAMPLE_INSERT_CHUNK = 5000;

type ActivityCreateInput = Prisma.ActivityCreateInput;
type ActivitySampleCreateManyInput = Prisma.ActivitySampleCreateManyInput;

function buildActivityData(
  normalized: NormalizedActivity,
  userId?: string,
): ActivityCreateInput {
  return {
    source: normalized.source,
    startTime: normalized.startTime,
    durationSec: normalized.durationSec,
    sampleRateHz: normalized.sampleRateHz,
    user: userId ? { connect: { id: userId } } : undefined,
  };
}

function buildSampleRows(
  activityId: string,
  normalized: NormalizedActivity,
): ActivitySampleCreateManyInput[] {
  return normalized.samples.map((sample) => ({
    activityId,
    t: sample.t,
    heartRate: sample.heartRate ?? null,
    cadence: sample.cadence ?? null,
    power: sample.power ?? null,
    speed: sample.speed ?? null,
    elevation: sample.elevation ?? null,
  }));
}

export async function saveActivity(
  normalized: NormalizedActivity,
  userId?: string,
) {
  if (normalized.samples.length === 0) {
    throw new Error('No samples parsed from FIT file.');
  }

  const activity = await prisma.$transaction(async (tx) => {
    const created = await tx.activity.create({
      data: buildActivityData(normalized, userId),
    });

    const rows = buildSampleRows(created.id, normalized);

    for (let i = 0; i < rows.length; i += SAMPLE_INSERT_CHUNK) {
      const chunk = rows.slice(i, i + SAMPLE_INSERT_CHUNK);
      await tx.activitySample.createMany({ data: chunk });
    }

    return created;
  });

  return activity;
}

export async function deleteActivity(activityId: string, userId?: string) {
  return prisma.activity.delete({
    where: {
      id: activityId,
      ...(userId ? { userId } : {}),
    },
  });
}
