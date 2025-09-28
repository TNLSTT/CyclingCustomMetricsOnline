import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { env } from '../env.js';
import { prisma } from '../prisma.js';

const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(100).optional().nullable(),
  avatarUrl: z.string().trim().url().max(2048).optional().nullable(),
  bio: z.string().trim().max(1000).optional().nullable(),
  location: z.string().trim().max(120).optional().nullable(),
  primaryDiscipline: z.string().trim().max(60).optional().nullable(),
  trainingFocus: z.string().trim().max(500).optional().nullable(),
  favoriteRide: z.string().trim().max(280).optional().nullable(),
  websiteUrl: z.string().trim().url().max(2048).optional().nullable(),
  instagramHandle: z.string().trim().max(120).optional().nullable(),
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
      favoriteRide: toNullable(req.body.favoriteRide),
      websiteUrl: toNullable(req.body.websiteUrl),
      instagramHandle: toNullable(req.body.instagramHandle),
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
