import type { Profile as PrismaProfile } from '@prisma/client';
import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { env } from '../env.js';
import { prisma } from '../prisma.js';

const MAX_TARGET_ITEMS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseNullableNumber(value: unknown): number | null {
  const parsed = toNullableNumber(value);
  if (parsed === undefined) {
    return null;
  }
  if (typeof parsed === 'number' && Number.isNaN(parsed)) {
    return Number.NaN;
  }
  return parsed as number | null;
}

function normalizeCriticalEffortInput(value: unknown):
  | {
      durationMinutes: number | null;
      powerWatts: number | null;
    }
  | null {
  if (!isRecord(value)) {
    return null;
  }

  const durationMinutes = parseNullableNumber(value.durationMinutes);
  const powerWatts = parseNullableNumber(value.powerWatts);

  if (
    (durationMinutes == null || Number.isNaN(durationMinutes)) &&
    (powerWatts == null || Number.isNaN(powerWatts))
  ) {
    if (Number.isNaN(durationMinutes) || Number.isNaN(powerWatts)) {
      return {
        durationMinutes: durationMinutes as number | null,
        powerWatts: powerWatts as number | null,
      };
    }
    return null;
  }

  return {
    durationMinutes: durationMinutes as number | null,
    powerWatts: powerWatts as number | null,
  };
}

type TargetInput = {
  id: string;
  name: string;
  date: string | null;
  durationHours: number | null;
  distanceKm: number | null;
  criticalEffort:
    | {
        durationMinutes: number | null;
        powerWatts: number | null;
      }
    | null;
  targetAveragePowerWatts: number | null;
  notes: string | null;
};

function normalizeTargetList(value: unknown): TargetInput[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      return {
        id: '',
        name: '',
        date: null,
        durationHours: Number.NaN,
        distanceKm: Number.NaN,
        criticalEffort: null,
        targetAveragePowerWatts: Number.NaN,
        notes: null,
      } satisfies TargetInput;
    }

    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const dateValue = typeof entry.date === 'string' ? entry.date.trim() : null;
    const notes = typeof entry.notes === 'string' ? entry.notes : null;

    const durationHours = parseNullableNumber(entry.durationHours);
    const distanceKm = parseNullableNumber(entry.distanceKm);
    const targetAveragePowerWatts = parseNullableNumber(entry.targetAveragePowerWatts);

    const criticalEffort = normalizeCriticalEffortInput(entry.criticalEffort);

    return {
      id,
      name,
      date: dateValue && dateValue.length > 0 ? dateValue : null,
      durationHours,
      distanceKm,
      criticalEffort,
      targetAveragePowerWatts,
      notes: notes ? notes.trim() : null,
    } satisfies TargetInput;
  });
}

const criticalEffortSchema = z
  .object({
    durationMinutes: z
      .number({ invalid_type_error: 'Critical effort duration must be a number of minutes.' })
      .min(0, 'Critical effort duration cannot be negative.')
      .max(600, 'Critical effort duration must be 600 minutes or less.')
      .refine((value) => Number.isFinite(value), {
        message: 'Critical effort duration must be a number of minutes.',
      })
      .nullable(),
    powerWatts: z
      .number({ invalid_type_error: 'Critical effort power must be a number.' })
      .min(0, 'Critical effort power cannot be negative.')
      .max(2000, 'Critical effort power must be 2000W or less.')
      .refine((value) => Number.isFinite(value), {
        message: 'Critical effort power must be a number.',
      })
      .nullable(),
  })
  .nullable();

const targetSchema = z.object({
  id: z.string().trim().min(1, 'Each entry must include an id.').max(100),
  name: z.string().trim().min(1, 'Name is required.').max(200, 'Name must be 200 characters or fewer.'),
  date: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'Date must be a valid ISO 8601 string.',
    })
    .nullable(),
  durationHours: z
    .number({ invalid_type_error: 'Duration must be provided in hours.' })
    .min(0, 'Duration cannot be negative.')
    .max(200, 'Duration must be 200 hours or less.')
    .refine((value) => Number.isFinite(value), {
      message: 'Duration must be a number of hours.',
    })
    .nullable(),
  distanceKm: z
    .number({ invalid_type_error: 'Distance must be a number of kilometers.' })
    .min(0, 'Distance cannot be negative.')
    .max(5000, 'Distance must be 5000km or less.')
    .refine((value) => Number.isFinite(value), {
      message: 'Distance must be a number of kilometers.',
    })
    .nullable(),
  criticalEffort: criticalEffortSchema,
  targetAveragePowerWatts: z
    .number({ invalid_type_error: 'Target average power must be a number.' })
    .min(0, 'Target average power cannot be negative.')
    .max(2000, 'Target average power must be 2000W or less.')
    .refine((value) => Number.isFinite(value), {
      message: 'Target average power must be a number.',
    })
    .nullable(),
  notes: z.string().trim().max(500, 'Notes must be 500 characters or fewer.').nullable(),
});

const POWER_BEST_DURATIONS = [
  { key: '60', minutes: 1 },
  { key: '300', minutes: 5 },
  { key: '1200', minutes: 20 },
  { key: '3600', minutes: 60 },
  { key: '10800', minutes: 180 },
  { key: '14400', minutes: 240 },
] as const;

type ProfilePowerBest = { durationMinutes: number; watts: number | null };

function formatTargetResponse(value: unknown): TargetInput[] {
  const entries = normalizeTargetList(value) ?? [];
  return entries
    .filter((entry) => entry.id.trim().length > 0 && entry.name.trim().length > 0)
    .map((entry) => {
      const durationHours =
        entry.durationHours != null && Number.isFinite(entry.durationHours)
          ? entry.durationHours
          : null;
      const distanceKm =
        entry.distanceKm != null && Number.isFinite(entry.distanceKm)
          ? entry.distanceKm
          : null;
      const targetAveragePowerWatts =
        entry.targetAveragePowerWatts != null && Number.isFinite(entry.targetAveragePowerWatts)
          ? entry.targetAveragePowerWatts
          : null;

      const effort = entry.criticalEffort;
      const criticalEffort = effort
        ? {
            durationMinutes:
              effort.durationMinutes != null && Number.isFinite(effort.durationMinutes)
                ? effort.durationMinutes
                : null,
            powerWatts:
              effort.powerWatts != null && Number.isFinite(effort.powerWatts)
                ? effort.powerWatts
                : null,
          }
        : null;

      const normalizedEffort =
        criticalEffort && criticalEffort.durationMinutes == null && criticalEffort.powerWatts == null
          ? null
          : criticalEffort;

      return {
        id: entry.id,
        name: entry.name,
        date: entry.date,
        durationHours,
        distanceKm,
        criticalEffort: normalizedEffort,
        targetAveragePowerWatts,
        notes: entry.notes ?? null,
      } satisfies TargetInput;
    });
}

function extractPowerBests(analytics: unknown): ProfilePowerBest[] {
  const defaults = POWER_BEST_DURATIONS.map((entry) => ({
    durationMinutes: entry.minutes,
    watts: null,
  }));

  if (!isRecord(analytics)) {
    return defaults;
  }

  const movingAverages = analytics.movingAverages;
  if (!isRecord(movingAverages)) {
    return defaults;
  }

  const bestPower = movingAverages.bestPower;
  if (!isRecord(bestPower)) {
    return defaults;
  }

  return POWER_BEST_DURATIONS.map((entry) => {
    const value = (bestPower as Record<string, unknown>)[entry.key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { durationMinutes: entry.minutes, watts: Number(value) };
    }
    return { durationMinutes: entry.minutes, watts: null };
  });
}

function buildProfileResponse(profile: PrismaProfile) {
  const analytics = isRecord(profile.analytics) ? profile.analytics : null;

  return {
    ...profile,
    analytics,
    events: formatTargetResponse(profile.events),
    goals: formatTargetResponse(profile.goals),
    strengths: typeof profile.strengths === 'string' ? profile.strengths : null,
    weaknesses: typeof profile.weaknesses === 'string' ? profile.weaknesses : null,
    powerBests: extractPowerBests(analytics),
  };
}

const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional().nullable(),
  avatarUrl: z.string().trim().url().max(2048).optional().nullable(),
  bio: z.string().trim().max(1000).optional().nullable(),
  location: z.string().trim().max(100).optional().nullable(),
  primaryDiscipline: z.string().trim().max(100).optional().nullable(),
  trainingFocus: z.string().trim().max(200).optional().nullable(),
  websiteUrl: z.string().trim().url().max(2048).optional().nullable(),
  instagramHandle: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]+$/, 'Instagram handle can only include letters, numbers, dots, hyphens, and underscores.')
    .max(60)
    .optional()
    .nullable(),
  achievements: z.string().trim().max(500).optional().nullable(),
  weeklyGoalHours: z
    .number({ invalid_type_error: 'Weekly training goal must be a number.' })
    .int('Weekly training goal must be a whole number of hours.')
    .min(0, 'Weekly training goal cannot be negative.')
    .max(80, 'Weekly training goal must be 80 hours or less.')
    .refine((value) => Number.isFinite(value), {
      message: 'Weekly training goal must be a number.',
    })
    .optional()
    .nullable(),
  ftpWatts: z
    .number({ invalid_type_error: 'FTP must be a number.' })
    .int('FTP must be entered as whole watts.')
    .min(0, 'FTP cannot be negative.')
    .max(2000, 'FTP must be 2000W or less.')
    .refine((value) => Number.isFinite(value), {
      message: 'FTP must be a number.',
    })
    .optional()
    .nullable(),
  weightKg: z
    .number({ invalid_type_error: 'Weight must be a number.' })
    .min(0, 'Weight cannot be negative.')
    .max(250, 'Weight must be 250kg or less.')
    .refine((value) => Number.isFinite(value), {
      message: 'Weight must be a number.',
    })
    .optional()
    .nullable(),
  hrMaxBpm: z
    .number({ invalid_type_error: 'Max heart rate must be a number.' })
    .int('Max heart rate must be a whole number of bpm.')
    .min(0, 'Max heart rate cannot be negative.')
    .max(250, 'Max heart rate must be 250 bpm or less.')
    .refine((value) => Number.isFinite(value), {
      message: 'Max heart rate must be a number.',
    })
    .optional()
    .nullable(),
  hrRestBpm: z
    .number({ invalid_type_error: 'Resting heart rate must be a number.' })
    .int('Resting heart rate must be a whole number of bpm.')
    .min(0, 'Resting heart rate cannot be negative.')
    .max(200, 'Resting heart rate must be 200 bpm or less.')
    .refine((value) => Number.isFinite(value), {
      message: 'Resting heart rate must be a number.',
    })
    .optional()
    .nullable(),
  events: z.array(targetSchema).max(MAX_TARGET_ITEMS, 'You can track up to 20 events.').optional(),
  goals: z.array(targetSchema).max(MAX_TARGET_ITEMS, 'You can track up to 20 goals.').optional(),
  strengths: z.string().trim().max(500).optional().nullable(),
  weaknesses: z.string().trim().max(500).optional().nullable(),
});

function toNullable<T>(value: T | undefined | null): T | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' && value.trim().length === 0) {
    return null;
  }
  return value;
}

function toNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return Number.NaN;
    }
    return parsed;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : Number.NaN;
  }
  return Number.NaN;
}

export const profileRouter = express.Router();

async function getOrCreateProfile(userId: string) {
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  return prisma.profile.create({ data: { userId } });
}

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(200).json(null);
      return;
    }

    const profile = await getOrCreateProfile(userId);

    res.status(200).json(buildProfileResponse(profile));
  }),
);

profileRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload = {
      displayName: toNullable(req.body.displayName),
      avatarUrl: toNullable(req.body.avatarUrl),
      bio: toNullable(req.body.bio),
      location: toNullable(req.body.location),
      primaryDiscipline: toNullable(req.body.primaryDiscipline),
      trainingFocus: toNullable(req.body.trainingFocus),
      websiteUrl: toNullable(req.body.websiteUrl),
      instagramHandle: toNullable(req.body.instagramHandle),
      achievements: toNullable(req.body.achievements),
      weeklyGoalHours: toNullableNumber(req.body.weeklyGoalHours),
      ftpWatts: toNullableNumber(req.body.ftpWatts),
      weightKg: toNullableNumber(req.body.weightKg),
      hrMaxBpm: toNullableNumber(req.body.hrMaxBpm),
      hrRestBpm: toNullableNumber(req.body.hrRestBpm),
      events: normalizeTargetList(req.body.events),
      goals: normalizeTargetList(req.body.goals),
      strengths: toNullable(req.body.strengths),
      weaknesses: toNullable(req.body.weaknesses),
    };

    const parsed = profileUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      const errorMessage =
        parsed.error.errors.at(0)?.message ?? 'Invalid profile details provided.';
      res.status(400).json({ error: errorMessage });
      return;
    }

    const data = parsed.data;

    const cleanedEntries = Object.entries(data).filter(([, value]) => value !== undefined);
    const updateData = Object.fromEntries(cleanedEntries);

    const userId = req.user.id;

    const existing = await prisma.profile.findUnique({ where: { userId } });

    if (!existing) {
      const created = await prisma.profile.create({ data: { userId, ...updateData } });
      res.status(200).json(buildProfileResponse(created));
      return;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(200).json(buildProfileResponse(existing));
      return;
    }

    const updated = await prisma.profile.update({ where: { userId }, data: updateData });

    res.status(200).json(buildProfileResponse(updated));
  }),
);
