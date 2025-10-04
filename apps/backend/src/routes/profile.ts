import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { env } from '../env.js';
import { prisma } from '../prisma.js';

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
      res.json(null);
      return;
    }

    const profile = await getOrCreateProfile(userId);

    res.json(profile);
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
      res.json(created);
      return;
    }

    if (Object.keys(updateData).length === 0) {
      res.json(existing);
      return;
    }

    const updated = await prisma.profile.update({ where: { userId }, data: updateData });

    res.json(updated);
  }),
);
