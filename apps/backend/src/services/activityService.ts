import { Prisma } from '@prisma/client';

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
    temperature: sample.temperature ?? null,
    latitude: sample.latitude ?? null,
    longitude: sample.longitude ?? null,
  }));
}

const DUPLICATE_ACTIVITY_MESSAGE =
  'An activity with the same start time and duration already exists for this user.';

function isDuplicateActivityError(error: unknown): error is Error {
  return error instanceof Error && error.message === DUPLICATE_ACTIVITY_MESSAGE;
}

export async function saveActivity(normalized: NormalizedActivity, userId?: string) {
  if (normalized.samples.length === 0) {
    throw new Error('No samples parsed from FIT file.');
  }

  try {
    const activity = await prisma.$transaction(async (tx) => {
      const existing = await tx.activity.findFirst({
        where: {
          startTime: normalized.startTime,
          durationSec: normalized.durationSec,
          userId: userId ?? null,
        },
      });

      if (existing) {
        throw new Error(DUPLICATE_ACTIVITY_MESSAGE);
      }

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
  } catch (error: unknown) {
    if (isDuplicateActivityError(error)) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error(DUPLICATE_ACTIVITY_MESSAGE);
    }

    throw error;
  }
}

export async function deleteActivity(activityId: string, userId?: string) {
  if (userId) {
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, userId },
    });

    if (!activity) {
      throw new Error('Activity not found');
    }
  }

  return prisma.activity.delete({
    where: {
      id: activityId,
    },
  });
}
