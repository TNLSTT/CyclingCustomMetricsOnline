import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { env } from '../env.js';
import { getDurableTss } from '../services/durableTssService.js';

function firstValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return typeof value === 'string' ? value : undefined;
}

const filtersSchema = z.object({
  thresholdKj: z
    .string()
    .trim()
    .optional()
    .refine((value) => value === undefined || !Number.isNaN(Number(value)), {
      message: 'thresholdKj must be numeric',
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
});

const DEFAULT_THRESHOLD_KJ = 1000;

export const durableTssRouter = express.Router();

durableTssRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const raw = {
      thresholdKj: firstValue(req.query.thresholdKj),
      startDate: firstValue(req.query.startDate),
      endDate: firstValue(req.query.endDate),
    };

    const parsed = filtersSchema.safeParse(raw);
    if (!parsed.success) {
      const message = parsed.error.errors.at(0)?.message ?? 'Invalid filters provided.';
      res.status(400).json({ error: message });
      return;
    }

    const thresholdKjValue = parsed.data.thresholdKj != null ? Number(parsed.data.thresholdKj) : undefined;
    const filters = {
      thresholdKj: thresholdKjValue ?? DEFAULT_THRESHOLD_KJ,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : undefined,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : undefined,
    };

    const userId = req.user!.id;
    const response = await getDurableTss(userId, filters);

    res.json(response);
  }),
);
