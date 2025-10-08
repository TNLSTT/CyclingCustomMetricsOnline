import { Prisma } from '@prisma/client';
import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { env } from '../env.js';
import { prisma } from '../prisma.js';

const BUCKETS = ['day', 'week', 'month'] as const;
const METRICS = ['avg-power', 'avg-hr', 'kilojoules', 'tss', 'durable-tss', 'duration-hours'] as const;

type Bucket = (typeof BUCKETS)[number];
type Metric = (typeof METRICS)[number];

const querySchema = z.object({
  metric: z
    .string()
    .optional()
    .refine((value) => value == null || METRICS.includes(value as Metric), {
      message: `Metric must be one of: ${METRICS.join(', ')}`,
    })
    .transform((value) => (value ?? 'avg-power') as Metric),
  bucket: z
    .string()
    .optional()
    .refine((value) => value == null || BUCKETS.includes(value as Bucket), {
      message: `Bucket must be one of: ${BUCKETS.join(', ')}`,
    })
    .transform((value) => (value ?? 'day') as Bucket),
  tz: z
    .string()
    .optional()
    .transform((value) => value?.trim() || 'UTC'),
});

interface TrendRow {
  bucket: Date;
  value: number | null;
  n: bigint;
}

const POSTGRES_TIMEZONE_ALIASES: Record<string, string> = {
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
};

function resolveTimezone(tz: string): string {
  if (!tz) {
    return 'UTC';
  }

  const normalizedTz = POSTGRES_TIMEZONE_ALIASES[tz] ?? tz;

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: normalizedTz });
    return normalizedTz;
  } catch (_error) {
    return 'UTC';
  }
}

function bucketExpression(bucket: Bucket, tz: string) {
  return Prisma.sql`
    (DATE_TRUNC(${bucket}, timezone(${tz}, a."startTime")) AT TIME ZONE ${tz})
  `;
}

function userFilter(userId: string | null) {
  if (!userId) {
    return Prisma.sql`TRUE`;
  }
  return Prisma.sql`a."userId" = ${userId}`;
}

const metricQueries: Record<Metric, (bucket: Bucket, tz: string, userId: string | null) => Prisma.Sql> = {
  'avg-power': (bucket, tz, userId) => {
    const bucketExpr = bucketExpression(bucket, tz);
    return Prisma.sql`
      WITH activity_power AS (
        SELECT
          s."activityId" AS activity_id,
          AVG(s.power) AS avg_power
        FROM "ActivitySample" s
        WHERE s.power IS NOT NULL
        GROUP BY s."activityId"
      )
      SELECT
        ${bucketExpr} AS bucket,
        AVG(activity_power.avg_power) AS value,
        COUNT(*) AS n
      FROM activity_power
      JOIN "Activity" a ON a.id = activity_power.activity_id
      WHERE ${userFilter(userId)}
      GROUP BY bucket
      ORDER BY bucket
    `;
  },
  'avg-hr': (bucket, tz, userId) => {
    const bucketExpr = bucketExpression(bucket, tz);
    return Prisma.sql`
      WITH activity_hr AS (
        SELECT
          s."activityId" AS activity_id,
          AVG(s."heartRate") AS avg_hr
        FROM "ActivitySample" s
        WHERE s."heartRate" IS NOT NULL
        GROUP BY s."activityId"
      )
      SELECT
        ${bucketExpr} AS bucket,
        AVG(activity_hr.avg_hr) AS value,
        COUNT(*) AS n
      FROM activity_hr
      JOIN "Activity" a ON a.id = activity_hr.activity_id
      WHERE ${userFilter(userId)}
      GROUP BY bucket
      ORDER BY bucket
    `;
  },
  kilojoules: (bucket, tz, userId) => {
    const bucketExpr = bucketExpression(bucket, tz);
    return Prisma.sql`
      WITH activity_power AS (
        SELECT
          s."activityId" AS activity_id,
          AVG(s.power) AS avg_power
        FROM "ActivitySample" s
        WHERE s.power IS NOT NULL
        GROUP BY s."activityId"
      )
      SELECT
        ${bucketExpr} AS bucket,
        SUM(activity_power.avg_power * a."durationSec" / 1000.0) AS value,
        COUNT(*) AS n
      FROM activity_power
      JOIN "Activity" a ON a.id = activity_power.activity_id
      WHERE ${userFilter(userId)}
      GROUP BY bucket
      ORDER BY bucket
    `;
  },
  tss: (bucket, tz, userId) => {
    const bucketExpr = bucketExpression(bucket, tz);
    return Prisma.sql`
      WITH profile AS (
        SELECT
          p."userId" AS user_id,
          p."ftpWatts" AS ftp_watts
        FROM "Profile" p
      ),
      activity_power AS (
        SELECT
          s."activityId" AS activity_id,
          AVG(s.power) AS avg_power
        FROM "ActivitySample" s
        WHERE s.power IS NOT NULL
        GROUP BY s."activityId"
      )
      SELECT
        ${bucketExpr} AS bucket,
        AVG(
          CASE
            WHEN COALESCE(profile.ftp_watts, 0) <= 0 THEN NULL
            ELSE (
              POWER(activity_power.avg_power / profile.ftp_watts, 2) * (a."durationSec" / 3600.0) * 100
            )
          END
        ) AS value,
        COUNT(*) FILTER (
          WHERE COALESCE(profile.ftp_watts, 0) > 0 AND activity_power.avg_power IS NOT NULL
        ) AS n
      FROM activity_power
      JOIN "Activity" a ON a.id = activity_power.activity_id
      LEFT JOIN profile ON profile.user_id = a."userId"
      WHERE ${userFilter(userId)}
      GROUP BY bucket
      ORDER BY bucket
    `;
  },
  'durable-tss': (bucket, tz, userId) => {
    const bucketExpr = bucketExpression(bucket, tz);
    return Prisma.sql`
      WITH profile AS (
        SELECT
          p."userId" AS user_id,
          p."ftpWatts" AS ftp_watts
        FROM "Profile" p
      ),
      power_samples AS (
        SELECT
          s."activityId" AS activity_id,
          s.power,
          ROW_NUMBER() OVER (PARTITION BY s."activityId" ORDER BY s.t) AS rn,
          COUNT(*) OVER (PARTITION BY s."activityId") AS total_samples,
          SUM(s.power) OVER (PARTITION BY s."activityId" ORDER BY s.t) AS cumulative_power
        FROM "ActivitySample" s
        WHERE s.power IS NOT NULL
      ),
      threshold_index AS (
        SELECT
          ps.activity_id,
          MIN(ps.rn) FILTER (WHERE ps.cumulative_power >= 1000 * 1000) AS threshold_rn,
          MAX(ps.total_samples) AS total_samples
        FROM power_samples ps
        GROUP BY ps.activity_id
      ),
      post_threshold AS (
        SELECT
          ps.activity_id,
          AVG(ps.power) FILTER (WHERE ti.threshold_rn IS NOT NULL AND ps.rn >= ti.threshold_rn) AS avg_power,
          ti.total_samples,
          ti.threshold_rn
        FROM power_samples ps
        JOIN threshold_index ti ON ti.activity_id = ps.activity_id
        GROUP BY ps.activity_id, ti.total_samples, ti.threshold_rn
      )
      SELECT
        ${bucketExpr} AS bucket,
        AVG(
          CASE
            WHEN pt.threshold_rn IS NULL THEN NULL
            WHEN COALESCE(profile.ftp_watts, 0) <= 0 THEN NULL
            ELSE (
              POWER(
                (pt.avg_power) / profile.ftp_watts,
                2
              ) * (
                (a."durationSec" * GREATEST(pt.total_samples - pt.threshold_rn + 1, 0)::numeric / NULLIF(pt.total_samples, 0)) /
                3600.0 * 100
              )
            )
          END
        ) AS value,
        COUNT(*) FILTER (
          WHERE pt.threshold_rn IS NOT NULL AND COALESCE(profile.ftp_watts, 0) > 0
        ) AS n
      FROM post_threshold pt
      JOIN "Activity" a ON a.id = pt.activity_id
      LEFT JOIN profile ON profile.user_id = a."userId"
      WHERE ${userFilter(userId)}
      GROUP BY bucket
      ORDER BY bucket
    `;
  },
  'duration-hours': (bucket, tz, userId) => {
    const bucketExpr = bucketExpression(bucket, tz);
    return Prisma.sql`
      SELECT
        ${bucketExpr} AS bucket,
        SUM(a."durationSec") / 3600.0 AS value,
        COUNT(*) AS n
      FROM "Activity" a
      WHERE ${userFilter(userId)}
      GROUP BY bucket
      ORDER BY bucket
    `;
  },
};

async function runTrendQuery(metric: Metric, bucket: Bucket, tz: string, userId: string | null) {
  const sql = metricQueries[metric](bucket, tz, userId);
  return prisma.$queryRaw<TrendRow[]>(sql);
}

export const trendsRouter = express.Router();

trendsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      const message = parsed.error.errors.at(0)?.message ?? 'Invalid query parameters provided.';
      res.status(400).json({ error: message });
      return;
    }

    const { metric, bucket, tz: tzRaw } = parsed.data;
    const tz = resolveTimezone(tzRaw);
    const userId = req.user?.id ?? null;

    const rows = await runTrendQuery(metric, bucket, tz, userId);

    res.status(200).json({
      metric,
      bucket,
      timezone: tz,
      points: rows.map((row) => ({
        bucket: row.bucket.toISOString(),
        value: row.value != null ? Number.parseFloat(row.value.toFixed(3)) : null,
        n: Number(row.n ?? 0),
      })),
    });
  }),
);
