import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { env } from '../env.js';
import { getDurabilityAnalysis } from '../services/durabilityAnalysisService.js';

function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' ? value : undefined;
}

const filtersSchema = z.object({
  minDurationMinutes: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Number(value)), {
      message: 'minDurationMinutes must be numeric',
    }),
  startDate: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
      message: 'startDate must be a valid date',
    }),
  endDate: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
      message: 'endDate must be a valid date',
    }),
  discipline: z.string().trim().max(100).optional(),
  keyword: z.string().trim().max(100).optional(),
});

export const durabilityAnalysisRouter = express.Router();

durabilityAnalysisRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const raw = {
      minDurationMinutes: firstValue(req.query.minDurationMinutes),
      startDate: firstValue(req.query.startDate),
      endDate: firstValue(req.query.endDate),
      discipline: firstValue(req.query.discipline),
      keyword: firstValue(req.query.keyword),
    };

    const parsed = filtersSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.errors.at(0)?.message ?? 'Invalid filters provided.';
      res.status(400).json({ error: message });
      return;
    }

    const filtersInput = parsed.data;
    const filters = {
      minDurationSec:
        filtersInput.minDurationMinutes != null
          ? Math.round(Number(filtersInput.minDurationMinutes) * 60)
          : undefined,
      startDate: filtersInput.startDate ? new Date(filtersInput.startDate) : undefined,
      endDate: filtersInput.endDate ? new Date(filtersInput.endDate) : undefined,
      discipline: filtersInput.discipline,
      keyword: filtersInput.keyword,
    };

    const userId = req.user!.id;
    const analysis = await getDurabilityAnalysis(userId, filters);

    res.status(200).json(analysis);
  }),
);
