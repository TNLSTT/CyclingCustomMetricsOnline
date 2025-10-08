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
    name: activity.name,
    distanceMeters: activity.distanceMeters,
    totalElevationGain: activity.totalElevationGain,
    averagePower: activity.averagePower,
    averageHeartRate: activity.averageHeartRate,
    averageCadence: activity.averageCadence,
    metrics: (activity.metrics ?? []).map((metric: any) => ({
      key: metric.metricDefinition.key,
      summary: metric.summary,
      computedAt: metric.computedAt,
    })),
  };
}

type TrackPoint = { latitude: number; longitude: number; t: number | null };

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

    res.status(200).json({
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

    const baseWhere = userId ? { userId } : {};

    const [previousActivity, nextActivity] = await Promise.all([
      prisma.activity.findFirst({
        where: {
          ...baseWhere,
          OR: [
            { startTime: { lt: activity.startTime } },
            {
              startTime: activity.startTime,
              createdAt: { lt: activity.createdAt },
            },
          ],
        },
        orderBy: [
          { startTime: 'desc' },
          { createdAt: 'desc' },
        ],
        select: { id: true },
      }),
      prisma.activity.findFirst({
        where: {
          ...baseWhere,
          OR: [
            { startTime: { gt: activity.startTime } },
            {
              startTime: activity.startTime,
              createdAt: { gt: activity.createdAt },
            },
          ],
        },
        orderBy: [
          { startTime: 'asc' },
          { createdAt: 'asc' },
        ],
        select: { id: true },
      }),
    ]);

    res.status(200).json({
      ...mapActivity(activity),
      previousActivityId: previousActivity?.id ?? null,
      nextActivityId: nextActivity?.id ?? null,
    });
  }),
);

activitiesRouter.get(
  '/:id/track',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const samples = (await prisma.activitySample.findMany({
      where: {
        activityId: req.params.id,
        latitude: { not: null },
        longitude: { not: null },
        ...(req.user?.id ? { activity: { userId: req.user.id } } : {}),
      },
      orderBy: { t: 'asc' },
      select: { latitude: true, longitude: true, t: true },
    })) as Array<{ latitude: number | null; longitude: number | null; t: number | null }>;

    const trackPoints: TrackPoint[] = samples
      .map((sample) => {
        const { latitude, longitude } = sample;
        const lat =
          typeof latitude === 'number'
            ? latitude
            : latitude != null
              ? Number(latitude)
              : null;
        const lon =
          typeof longitude === 'number'
            ? longitude
            : longitude != null
              ? Number(longitude)
              : null;
        const t =
          typeof sample.t === 'number'
            ? sample.t
            : sample.t != null
              ? Number(sample.t)
              : null;

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return null;
        }

        return { latitude: lat, longitude: lon, t } satisfies TrackPoint;
      })
      .filter((point): point is TrackPoint => point !== null);

    if (trackPoints.length === 0) {
      res.status(404).json({ error: 'Track data not available' });
      return;
    }

    const simplified = simplifyTrack(trackPoints, 1000);
    const latitudes = simplified.map((point) => point.latitude);
    const longitudes = simplified.map((point) => point.longitude);

    res.status(200).json({
      points: simplified.map((point) => {
        const base = { lat: point.latitude, lon: point.longitude } as {
          lat: number;
          lon: number;
          t?: number;
        };

        if (point.t != null && Number.isFinite(point.t)) {
          base.t = Number(point.t);
        }

        return base;
      }),
      bounds: {
        minLatitude: Math.min(...latitudes),
        maxLatitude: Math.max(...latitudes),
        minLongitude: Math.min(...longitudes),
        maxLongitude: Math.max(...longitudes),
      },
    });
  }),
);

activitiesRouter.get(
  '/:id/streams/power',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const samples = (await prisma.activitySample.findMany({
      where: {
        activityId: req.params.id,
        ...(req.user?.id ? { activity: { userId: req.user.id } } : {}),
      },
      orderBy: { t: 'asc' },
      select: { t: true, power: true },
    })) as Array<{ t: number; power: number | null }>;

    if (samples.length === 0) {
      res.status(404).json({ error: 'Power stream not available' });
      return;
    }

    const formatted = samples.map((sample) => ({
      t: sample.t,
      power: typeof sample.power === 'number' && Number.isFinite(sample.power) ? sample.power : null,
    }));

    res.status(200).json({ samples: formatted });
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
    res.status(200).json({ activityId: req.params.id, results });
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

    res.status(200).json({
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

    res.status(200).json({
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
