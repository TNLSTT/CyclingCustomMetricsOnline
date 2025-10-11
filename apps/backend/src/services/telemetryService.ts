import { Prisma } from '@prisma/client';
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
const missingUserIds = new Set<string>();

function normalizeUserId(userId?: string | null): string | null {
  if (!userId || missingUserIds.has(userId)) {
    return null;
  }
  return userId;
}

function isUserForeignKeyViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== 'P2003') {
    return false;
  }
  const meta = (error as { meta?: { field_name?: string | null } }).meta;
  const fieldName = meta?.field_name;
  return typeof fieldName === 'string' && fieldName.toLowerCase().includes('userid');
}

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
  const userId = normalizeUserId(input.userId ?? null);
  try {
    await prisma.pageView.create({
      data: {
        userId,
        path: input.path,
      },
    });
  } catch (error) {
    if (input.userId && userId !== null && isUserForeignKeyViolation(error)) {
      missingUserIds.add(input.userId);
      logger.warn(
        { err: error, path: input.path, userId: input.userId },
        'User not found while recording page view; storing anonymously',
      );
      try {
        await prisma.pageView.create({
          data: {
            userId: null,
            path: input.path,
          },
        });
      } catch (fallbackError) {
        logger.warn(
          { err: fallbackError, path: input.path },
          'Failed to record page view after removing user reference',
        );
      }
      return;
    }
    logger.warn({ err: error, path: input.path }, 'Failed to record page view');
  }
}

export async function recordMetricEvent(input: MetricEventInput): Promise<void> {
  const userId = normalizeUserId(input.userId ?? null);
  try {
    await prisma.metricEvent.create({
      data: {
        type: input.type,
        userId,
        activityId: input.activityId ?? null,
        durationMs: input.durationMs ?? null,
        success: input.success ?? null,
        meta: input.meta ?? null,
      },
    });
  } catch (error) {
    if (input.userId && userId !== null && isUserForeignKeyViolation(error)) {
      missingUserIds.add(input.userId);
      logger.warn(
        { err: error, type: input.type, userId: input.userId },
        'User not found while recording metric event; storing anonymously',
      );
      try {
        await prisma.metricEvent.create({
          data: {
            type: input.type,
            userId: null,
            activityId: input.activityId ?? null,
            durationMs: input.durationMs ?? null,
            success: input.success ?? null,
            meta: input.meta ?? null,
          },
        });
      } catch (fallbackError) {
        logger.warn(
          { err: fallbackError, type: input.type },
          'Failed to record metric event after removing user reference',
        );
      }
      return;
    }
    logger.warn({ err: error, type: input.type }, 'Failed to record metric event');
  }
}

export async function recordApiRequestMetric(input: ApiRequestMetricInput): Promise<void> {
  const userId = normalizeUserId(input.userId ?? null);
  try {
    await prisma.apiRequestMetric.create({
      data: {
        method: input.method,
        path: input.path,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        queryCount: input.queryCount,
        avgQueryDurationMs: input.avgQueryDurationMs,
        userId,
      },
    });
  } catch (error) {
    if (input.userId && userId !== null && isUserForeignKeyViolation(error)) {
      missingUserIds.add(input.userId);
      logger.warn(
        { err: error, path: input.path, userId: input.userId },
        'User not found while recording request metric; storing anonymously',
      );
      try {
        await prisma.apiRequestMetric.create({
          data: {
            method: input.method,
            path: input.path,
            statusCode: input.statusCode,
            durationMs: input.durationMs,
            queryCount: input.queryCount,
            avgQueryDurationMs: input.avgQueryDurationMs,
            userId: null,
          },
        });
      } catch (fallbackError) {
        logger.warn(
          { err: fallbackError, path: input.path },
          'Failed to record request metric after removing user reference',
        );
      }
      return;
    }
    logger.warn({ err: error, path: input.path }, 'Failed to record request metric');
  }
}

export async function recordExceptionEvent(input: ExceptionEventInput): Promise<void> {
  const userId = normalizeUserId(input.userId ?? null);
  try {
    await prisma.exceptionEvent.create({
      data: {
        name: input.name,
        message: input.message,
        stack: input.stack ?? null,
        statusCode: input.statusCode,
        path: input.path ?? null,
        userId,
      },
    });
  } catch (error) {
    if (input.userId && userId !== null && isUserForeignKeyViolation(error)) {
      missingUserIds.add(input.userId);
      logger.warn(
        { err: error, name: input.name, userId: input.userId },
        'User not found while recording exception event; storing anonymously',
      );
      try {
        await prisma.exceptionEvent.create({
          data: {
            name: input.name,
            message: input.message,
            stack: input.stack ?? null,
            statusCode: input.statusCode,
            path: input.path ?? null,
            userId: null,
          },
        });
      } catch (fallbackError) {
        logger.warn(
          { err: fallbackError, name: input.name },
          'Failed to record exception event after removing user reference',
        );
      }
      return;
    }
    logger.warn({ err: error, name: input.name }, 'Failed to record exception event');
  }
}

export async function updateMetricComputationJob(state: MetricComputationJobState): Promise<string | void> {
  const metricComputationJob = (prisma as unknown as {
    metricComputationJob?: {
      create?: typeof prisma.metricComputationJob.create;
      update?: typeof prisma.metricComputationJob.update;
    };
  }).metricComputationJob;

  if (!metricComputationJob?.create || !metricComputationJob?.update) {
    return;
  }

  switch (state.phase) {
    case 'enqueue': {
      const userId = normalizeUserId(state.userId ?? null);
      try {
        const job = await metricComputationJob.create({
          data: {
            activityId: state.activityId,
            userId,
            metricKeys: state.metricKeys,
            status: 'PENDING',
          },
        });
        return job.id;
      } catch (error) {
        if (state.userId && userId !== null && isUserForeignKeyViolation(error)) {
          missingUserIds.add(state.userId);
          logger.warn(
            { err: error, activityId: state.activityId, userId: state.userId },
            'User not found while enqueueing metric computation job; storing anonymously',
          );
          const job = await metricComputationJob.create({
            data: {
              activityId: state.activityId,
              userId: null,
              metricKeys: state.metricKeys,
              status: 'PENDING',
            },
          });
          return job.id;
        }
        throw error;
      }
    }
    case 'start': {
      await metricComputationJob.update({
        where: { id: state.jobId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });
      return;
    }
    case 'complete': {
      await metricComputationJob.update({
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
