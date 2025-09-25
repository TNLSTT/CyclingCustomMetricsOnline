import type { Prisma } from '@prisma/client';
import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { prisma } from '../prisma.js';
import { deleteActivity } from '../services/activityService.js';
import { runMetrics } from '../metrics/runner.js';
import { normalizeIntervalEfficiencySeries } from '../metrics/intervalEfficiency.js';

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

const computeSchema = z
  .object({
    metricKeys: z.array(z.string()).min(1).optional(),
  })
  .optional();

type ActivityWithMetrics = Prisma.ActivityGetPayload<{
  include: {
    metrics: {
      include: {
        metricDefinition: true;
      };
    };
  };
}>;

function mapActivity(activity: ActivityWithMetrics) {
  return {
    id: activity.id,
    source: activity.source,
    startTime: activity.startTime,
    durationSec: activity.durationSec,
    sampleRateHz: activity.sampleRateHz,
    createdAt: activity.createdAt,
    metrics: (activity.metrics ?? []).map((metric: any) => ({
      key: metric.metricDefinition.key,
      summary: metric.summary,
      computedAt: metric.computedAt,
    })),
  };
}

export const activitiesRouter = express.Router();

activitiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = paginationSchema.parse(req.query);
    const skip = (params.page - 1) * params.pageSize;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        skip,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          metrics: {
            include: { metricDefinition: true },
          },
        },
      }),
      prisma.activity.count(),
    ]);

    res.json({
      data: activities.map(mapActivity),
      page: params.page,
      pageSize: params.pageSize,
      total,
    });
  }),
);

activitiesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const activity = await prisma.activity.findUnique({
      where: { id: req.params.id },
      include: {
        metrics: {
          include: { metricDefinition: true },
          orderBy: { computedAt: 'desc' },
        },
      },
    });

    if (!activity) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }

    res.json(mapActivity(activity));
  }),
);

activitiesRouter.post(
  '/:id/compute',
  asyncHandler(async (req, res) => {
    const body = computeSchema.parse(req.body);
    const metricKeys = body?.metricKeys;

    const results = await runMetrics(req.params.id, metricKeys ?? undefined);
    res.json({ activityId: req.params.id, results });
  }),
);

activitiesRouter.get(
  '/:id/metrics/interval-efficiency',
  asyncHandler(async (req, res) => {
    const metricResult = await prisma.metricResult.findFirst({
      where: {
        activityId: req.params.id,
        metricDefinition: { key: 'interval-efficiency' },
      },
    });

    if (!metricResult) {
      res.status(404).json({ error: 'Metric result not found' });
      return;
    }

    const summary = metricResult.summary as Record<string, unknown>;
    const intervals = normalizeIntervalEfficiencySeries(metricResult.series);

    res.json({
      intervals,
      intervalSeconds:
        typeof summary.interval_seconds === 'number'
          ? summary.interval_seconds
          : 3600,
      computedAt: metricResult.computedAt,
    });
  }),
);

activitiesRouter.get(
  '/:id/metrics/:metricKey',
  asyncHandler(async (req, res) => {
    const metricResult = await prisma.metricResult.findFirst({
      where: {
        activityId: req.params.id,
        metricDefinition: { key: req.params.metricKey },
      },
      include: { metricDefinition: true },
    });

    if (!metricResult) {
      res.status(404).json({ error: 'Metric result not found' });
      return;
    }

    res.json({
      key: metricResult.metricDefinition.key,
      definition: metricResult.metricDefinition,
      summary: metricResult.summary,
      series: metricResult.series,
      computedAt: metricResult.computedAt,
    });
  }),
);

activitiesRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteActivity(req.params.id);
    res.status(204).send();
  }),
);
