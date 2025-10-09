import express from 'express';
import asyncHandler from 'express-async-handler';
import { z, type ZodTypeAny } from 'zod';

import { recordMetricEvent } from '../services/telemetryService.js';

const jsonValueSchema: ZodTypeAny = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)]),
);

const metricEventSchema = z.object({
  type: z.enum(['feature_click', 'export']),
  activityId: z
    .string()
    .trim()
    .min(1)
    .optional(),
  durationMs: z
    .number()
    .int()
    .min(0)
    .optional(),
  success: z.boolean().optional(),
  meta: jsonValueSchema.optional(),
});

export const telemetryRouter = express.Router();

telemetryRouter.post(
  '/metric-events',
  asyncHandler(async (req, res) => {
    const body = metricEventSchema.parse(req.body);

    await recordMetricEvent({
      type: body.type,
      userId: req.user?.id,
      activityId: body.activityId,
      durationMs: body.durationMs,
      success: body.success,
      meta: body.meta ?? null,
    });

    res.status(204).send();
  }),
);
