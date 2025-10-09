import type { Prisma } from '@prisma/client';
import Redis from 'ioredis';

import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { logger } from '../logger.js';

type MetricEventInput = {
  type: string;
  userId?: string | null;
  activityId?: string | null;
  durationMs?: number | null;
  success?: boolean | null;
  meta?: Prisma.JsonValue | null;
};

type PageViewInput = {
  userId?: string | null;
  path: string;
};

type ApiRequestMetricInput = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  queryCount: number;
  avgQueryDurationMs: number;
  userId?: string | null;
};

type ExceptionEventInput = {
  name: string;
  message: string;
  stack?: string | null;
  statusCode: number;
  path?: string | null;
  userId?: string | null;
};

type MetricComputationJobState =
  | {
      phase: 'enqueue';
      activityId: string;
      userId?: string | null;
      metricKeys: string[];
    }
  | {
      phase: 'start';
      jobId: string;
    }
  | {
      phase: 'complete';
      jobId: string;
      success: boolean;
      durationMs: number;
    };

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (redisClient || !env.REDIS_URL) {
    return redisClient;
  }
  try {
    redisClient = new Redis(env.REDIS_URL, { enableAutoPipelining: true });
    redisClient.on('error', (error) => {
      logger.warn({ err: error }, 'Redis connection error');
    });
  } catch (error) {
    logger.warn({ err: error }, 'Failed to initialize Redis client');
    redisClient = null;
  }
  return redisClient;
}

export async function cacheWithTtl<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      logger.warn({ err: error, key }, 'Failed to read cached analytics');
    }
  }

  const fresh = await compute();

  if (redis) {
    try {
      await redis.set(key, JSON.stringify(fresh), 'EX', ttlSeconds);
    } catch (error) {
      logger.warn({ err: error, key }, 'Failed to cache analytics');
    }
  }

  return fresh;
}

export async function recordPageView(input: PageViewInput): Promise<void> {
  try {
    await prisma.pageView.create({
      data: {
        userId: input.userId ?? null,
        path: input.path,
      },
    });
  } catch (error) {
    logger.warn({ err: error, path: input.path }, 'Failed to record page view');
  }
}

export async function recordMetricEvent(input: MetricEventInput): Promise<void> {
  try {
    await prisma.metricEvent.create({
      data: {
        type: input.type,
        userId: input.userId ?? null,
        activityId: input.activityId ?? null,
        durationMs: input.durationMs ?? null,
        success: input.success ?? null,
        meta: input.meta ?? null,
      },
    });
  } catch (error) {
    logger.warn({ err: error, type: input.type }, 'Failed to record metric event');
  }
}

export async function recordApiRequestMetric(input: ApiRequestMetricInput): Promise<void> {
  try {
    await prisma.apiRequestMetric.create({
      data: {
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        queryCount: input.queryCount,
        avgQueryDurationMs: input.avgQueryDurationMs,
        userId: input.userId ?? null,
      },
    });
  } catch (error) {
    logger.warn({ err: error, path: input.path }, 'Failed to record request metric');
  }
}

export async function recordExceptionEvent(input: ExceptionEventInput): Promise<void> {
  try {
    await prisma.exceptionEvent.create({
      data: {
        name: input.name,
        message: input.message,
        stack: input.stack ?? null,
        statusCode: input.statusCode,
        path: input.path ?? null,
        userId: input.userId ?? null,
      },
    });
  } catch (error) {
    logger.warn({ err: error, name: input.name }, 'Failed to record exception event');
  }
}

export async function updateMetricComputationJob(state: MetricComputationJobState): Promise<string | void> {
  switch (state.phase) {
    case 'enqueue': {
      const job = await prisma.metricComputationJob.create({
        data: {
          activityId: state.activityId,
          userId: state.userId ?? null,
          metricKeys: state.metricKeys,
          status: 'PENDING',
        },
      });
      return job.id;
    }
    case 'start': {
      await prisma.metricComputationJob.update({
        where: { id: state.jobId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      return;
    }
    case 'complete': {
      await prisma.metricComputationJob.update({
        where: { id: state.jobId },
        data: {
          status: state.success ? 'COMPLETED' : 'FAILED',
          completedAt: new Date(),
          durationMs: state.durationMs,
        },
      });
      return;
    }
    default:
      return;
  }
}

export function flushRedis(): void {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
  }
}
