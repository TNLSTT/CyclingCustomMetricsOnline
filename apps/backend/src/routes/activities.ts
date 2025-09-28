import type { Prisma } from '@prisma/client';
import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { deleteActivity } from '../services/activityService.js';
import { runMetrics } from '../metrics/runner.js';
import { normalizeIntervalEfficiencySeries } from '../metrics/intervalEfficiency.js';

const paginationSchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(500).default(10),
  })
  .transform(({ page, pageSize }) => ({
    page,
    pageSize: Math.min(pageSize, 500),
  }));

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

type TrackPoint = { latitude: number; longitude: number };

function simplifyTrack(points: TrackPoint[], maxPoints = 1000): TrackPoint[] {
  if (points.length <= maxPoints) {
    return points;
  }

  const step = Math.ceil(points.length / maxPoints);
  const simplified: TrackPoint[] = [];

  for (let index = 0; index < points.length; index += step) {
    simplified.push(points[index]!);
  }

  const lastPoint = points[points.length - 1]!;
  const lastSimplified = simplified[simplified.length - 1];
  if (
    !lastSimplified ||
    lastSimplified.latitude !== lastPoint.latitude ||
    lastSimplified.longitude !== lastPoint.longitude
  ) {
    simplified.push(lastPoint);
  }

  return simplified;
}

export const activitiesRouter = express.Router();

activitiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user?.id;
    const params = paginationSchema.parse(req.query);
    const skip = (params.page - 1) * params.pageSize;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where: userId ? { userId } : undefined,
        skip,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          metrics: {
            include: { metricDefinition: true },
          },
        },
      }),
      prisma.activity.count({ where: userId ? { userId } : undefined }),
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
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const userId = req.user?.id;
    const activity = await prisma.activity.findFirst({
      where: { id: req.params.id, ...(userId ? { userId } : {}) },
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

activitiesRouter.get(
  '/:id/track',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const samples = await prisma.activitySample.findMany({
      where: {
        activityId: req.params.id,
        latitude: { not: null },
        longitude: { not: null },
        ...(req.user?.id ? { activity: { userId: req.user.id } } : {}),
      },
      orderBy: { t: 'asc' },
      select: { latitude: true, longitude: true },
    });

    const trackPoints = samples
      .map((sample) => {
        const { latitude, longitude } = sample;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return null;
        }
        return { latitude, longitude } as TrackPoint;
      })
      .filter((point): point is TrackPoint => point !== null);

    if (trackPoints.length === 0) {
      res.status(404).json({ error: 'Track data not available' });
      return;
    }

    const simplified = simplifyTrack(trackPoints, 1000);
    const latitudes = simplified.map((point) => point.latitude);
    const longitudes = simplified.map((point) => point.longitude);

    res.json({
      points: simplified,
      bounds: {
        minLatitude: Math.min(...latitudes),
        maxLatitude: Math.max(...latitudes),
        minLongitude: Math.min(...longitudes),
        maxLongitude: Math.max(...longitudes),
      },
    });
  }),
);

activitiesRouter.post(
  '/:id/compute',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = computeSchema.parse(req.body);
    const metricKeys = body?.metricKeys;

    const results = await runMetrics(req.params.id, metricKeys ?? undefined, req.user?.id);
    res.json({ activityId: req.params.id, results });
  }),
);

activitiesRouter.get(
  '/:id/metrics/interval-efficiency',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const metricResult = await prisma.metricResult.findFirst({
      where: {
        activityId: req.params.id,
        metricDefinition: { key: 'interval-efficiency' },
        ...(req.user?.id ? { activity: { userId: req.user.id } } : {}),
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
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const metricResult = await prisma.metricResult.findFirst({
      where: {
        activityId: req.params.id,
        metricDefinition: { key: req.params.metricKey },
        ...(req.user?.id ? { activity: { userId: req.user.id } } : {}),
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
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await deleteActivity(req.params.id, req.user?.id);
    res.status(204).send();
  }),
);
