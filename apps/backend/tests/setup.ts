import { randomUUID } from 'node:crypto';

import { beforeEach, vi } from 'vitest';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://localhost:5432/test';
}

if (!process.env.AUTH_ENABLED) {
  process.env.AUTH_ENABLED = 'true';
}

if (!process.env.NEXTAUTH_SECRET) {
  process.env.NEXTAUTH_SECRET = 'test-secret';
}

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = process.env.NEXTAUTH_SECRET;
}

type ActivityRecord = {
  id: string;
  source: string;
  startTime: Date;
  durationSec: number;
  sampleRateHz: number | null;
  createdAt: Date;
  userId?: string | null;
};

type ActivitySampleRecord = {
  activityId: string;
  t: number;
  heartRate: number | null;
  cadence: number | null;
  power: number | null;
  speed: number | null;
  elevation: number | null;
  temperature: number | null;
};

type MetricDefinitionRecord = {
  id: string;
  key: string;
  name: string;
  description: string;
  version: number;
  units: string | null;
  computeConfig: unknown;
  createdAt: Date;
};

type MetricResultRecord = {
  id: string;
  activityId: string;
  metricDefinitionId: string;
  summary: unknown;
  series: unknown;
  computedAt: Date;
};

interface MockDatabase {
  activities: Map<string, ActivityRecord>;
  samples: Map<string, ActivitySampleRecord[]>;
  metricDefinitions: Map<string, MetricDefinitionRecord>;
  metricResults: Map<string, MetricResultRecord>;
}

function createMockDatabase(): MockDatabase {
  return {
    activities: new Map(),
    samples: new Map(),
    metricDefinitions: new Map(),
    metricResults: new Map(),
  };
}

const db = createMockDatabase();

function cloneActivity(activity: ActivityRecord) {
  return { ...activity };
}

function attachMetrics(activity: ActivityRecord) {
  const metrics = Array.from(db.metricResults.values())
    .filter((metric) => metric.activityId === activity.id)
    .map((metric) => ({
      ...metric,
      metricDefinition: db.metricDefinitions.get(metric.metricDefinitionId)!,
    }));

  return {
    ...cloneActivity(activity),
    metrics,
  };
}

type Delegate = Record<string, (...args: any[]) => any>;

interface PrismaMock {
  $transaction<T>(fn: (tx: PrismaMock) => Promise<T>): Promise<T>;
  activity: Delegate;
  activitySample: Delegate;
  metricDefinition: Delegate;
  metricResult: Delegate;
}

function createPrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    $transaction: async <T>(fn: (tx: PrismaMock) => Promise<T>): Promise<T> => {
      return fn(mock);
    },
    activity: {
      create: async ({ data }: any) => {
        const id = data.id ?? randomUUID();
        const record: ActivityRecord = {
          id,
          source: data.source,
          startTime: data.startTime,
          durationSec: data.durationSec,
          sampleRateHz: data.sampleRateHz ?? null,
          createdAt: data.createdAt ?? new Date(),
          userId: data.user?.connect?.id ?? null,
        };
        db.activities.set(id, record);
        return cloneActivity(record);
      },
      findMany: async ({ where, skip = 0, take, orderBy, include }: any) => {
        let activities = Array.from(db.activities.values());
        if (where?.userId) {
          activities = activities.filter((activity) => activity.userId === where.userId);
        }
        if (orderBy?.createdAt === 'desc') {
          activities.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        if (orderBy?.createdAt === 'asc') {
          activities.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        const slice = activities.slice(skip, take ? skip + take : undefined);
        if (include?.metrics) {
          return slice.map((activity) => attachMetrics(activity));
        }
        return slice.map((activity) => cloneActivity(activity));
      },
      count: async ({ where }: any = {}) => {
        let activities = Array.from(db.activities.values());
        if (where?.userId) {
          activities = activities.filter((activity) => activity.userId === where.userId);
        }
        return activities.length;
      },
      findUnique: async ({ where, include }: any) => {
        const activity = db.activities.get(where.id);
        if (!activity) {
          return null;
        }
        if (include?.metrics) {
          return attachMetrics(activity);
        }
        return cloneActivity(activity);
      },
      findFirst: async ({ where, include }: any) => {
        let activities = Array.from(db.activities.values());
        if (where?.id) {
          activities = activities.filter((activity) => activity.id === where.id);
        }
        if (where && 'userId' in where) {
          activities = activities.filter((activity) => activity.userId === where.userId);
        }
        if (where?.startTime) {
          const target = new Date(where.startTime).getTime();
          activities = activities.filter((activity) => activity.startTime.getTime() === target);
        }
        if (typeof where?.durationSec === 'number') {
          activities = activities.filter((activity) => activity.durationSec === where.durationSec);
        }
        const activity = activities[0];
        if (!activity) {
          return null;
        }
        if (include?.metrics) {
          return attachMetrics(activity);
        }
        return cloneActivity(activity);
      },
      delete: async ({ where }: any) => {
        const activity = db.activities.get(where.id);
        if (!activity) {
          throw new Error('Activity not found');
        }
        db.activities.delete(where.id);
        db.samples.delete(where.id);
        for (const [key, metric] of db.metricResults.entries()) {
          if (metric.activityId === where.id) {
            db.metricResults.delete(key);
          }
        }
        return cloneActivity(activity);
      },
    },
    activitySample: {
      createMany: async ({ data }: any) => {
        const entries = Array.isArray(data) ? data : [data];
        for (const entry of entries) {
          const list = db.samples.get(entry.activityId) ?? [];
          list.push({
            ...entry,
            temperature: entry.temperature ?? null,
            latitude: entry.latitude ?? null,
            longitude: entry.longitude ?? null,
          });
          db.samples.set(entry.activityId, list);
        }
        return { count: entries.length };
      },
      findMany: async ({ where, orderBy }: any) => {
        const list = db.samples.get(where.activityId) ?? [];
        if (orderBy?.t === 'asc') {
          return [...list].sort((a, b) => a.t - b.t);
        }
        if (orderBy?.t === 'desc') {
          return [...list].sort((a, b) => b.t - a.t);
        }
        return [...list];
      },
    },
    metricDefinition: {
      upsert: async ({ where, update, create }: any) => {
        const existing = Array.from(db.metricDefinitions.values()).find(
          (definition) => definition.key === where.key,
        );
        if (existing) {
          const updated = {
            ...existing,
            ...update,
          };
          db.metricDefinitions.set(existing.id, updated);
          return { ...updated };
        }
        const id = randomUUID();
        const record: MetricDefinitionRecord = {
          id,
          key: create.key,
          name: create.name,
          description: create.description,
          version: create.version,
          units: create.units ?? null,
          computeConfig: create.computeConfig ?? null,
          createdAt: new Date(),
        };
        db.metricDefinitions.set(id, record);
        return { ...record };
      },
    },
    metricResult: {
      upsert: async ({ where, update, create }: any) => {
        const key = `${where.activityId_metricDefinitionId.activityId}:${where.activityId_metricDefinitionId.metricDefinitionId}`;
        const existing = db.metricResults.get(key);
        if (existing) {
          const updated: MetricResultRecord = {
            ...existing,
            summary: update.summary,
            series: update.series,
            computedAt: update.computedAt,
          };
          db.metricResults.set(key, updated);
          return { ...updated };
        }
        const record: MetricResultRecord = {
          id: randomUUID(),
          activityId: create.activityId,
          metricDefinitionId: create.metricDefinitionId,
          summary: create.summary,
          series: create.series,
          computedAt: create.computedAt ?? new Date(),
        };
        db.metricResults.set(key, record);
        return { ...record };
      },
      findMany: async ({ where, include, orderBy }: any) => {
        const targetKey = where?.metricDefinition?.key;
        const userId = where?.activity?.userId ?? where?.activity?.user?.id;
        let matchingResults = Array.from(db.metricResults.values());

        if (typeof targetKey === 'string') {
          const definition = Array.from(db.metricDefinitions.values()).find(
            (def) => def.key === targetKey,
          );
          if (!definition) {
            return [];
          }
          matchingResults = matchingResults.filter(
            (result) => result.metricDefinitionId === definition.id,
          );
        }

        if (typeof userId === 'string') {
          matchingResults = matchingResults.filter((result) => {
            const activity = db.activities.get(result.activityId);
            return activity?.userId === userId;
          });
        }

        if (orderBy?.activity?.startTime) {
          const direction = orderBy.activity.startTime;
          matchingResults.sort((a, b) => {
            const activityA = db.activities.get(a.activityId);
            const activityB = db.activities.get(b.activityId);
            const timeA = activityA?.startTime?.getTime() ?? 0;
            const timeB = activityB?.startTime?.getTime() ?? 0;
            return direction === 'asc' ? timeA - timeB : timeB - timeA;
          });
        }

        return matchingResults.map((result) => {
          const base: any = { ...result };
          if (include?.metricDefinition) {
            const definition = db.metricDefinitions.get(result.metricDefinitionId);
            base.metricDefinition = definition ? { ...definition } : undefined;
          }
          if (include?.activity) {
            const activity = db.activities.get(result.activityId);
            base.activity = activity ? { ...activity } : undefined;
          }
          return base;
        });
      },
      findFirst: async ({ where, include }: any) => {
        let candidates = Array.from(db.metricResults.values());
        if (typeof where?.activityId === 'string') {
          candidates = candidates.filter((metric) => metric.activityId === where.activityId);
        }

        let definition: MetricDefinitionRecord | undefined;
        if (typeof where?.metricDefinition?.key === 'string') {
          definition = Array.from(db.metricDefinitions.values()).find(
            (def) => def.key === where.metricDefinition.key,
          );
          if (!definition) {
            return null;
          }
          candidates = candidates.filter(
            (metric) => metric.metricDefinitionId === definition!.id,
          );
        }

        const userId = where?.activity?.userId ?? where?.activity?.user?.id;
        if (typeof userId === 'string') {
          candidates = candidates.filter((metric) => {
            const activity = db.activities.get(metric.activityId);
            return activity?.userId === userId;
          });
        }

        const result = candidates[0];
        if (!result) {
          return null;
        }

        const base: any = { ...result };
        if (include?.metricDefinition) {
          const resolvedDefinition = definition
            ? { ...definition }
            : db.metricDefinitions.get(result.metricDefinitionId);
          base.metricDefinition = resolvedDefinition ? { ...resolvedDefinition } : undefined;
        }
        return base;
      },
    },
  };

  return mock;
}

const prismaMock = createPrismaMock();

vi.mock('@prisma/client', () => {
  class PrismaClient {
    activity = prismaMock.activity;
    activitySample = prismaMock.activitySample;
    metricDefinition = prismaMock.metricDefinition;
    metricResult = prismaMock.metricResult;
    profile = {};
    user = {};

    async $transaction<T>(fn: (tx: PrismaMock) => Promise<T>): Promise<T> {
      return fn(prismaMock);
    }

    async $disconnect(): Promise<void> {
      return Promise.resolve();
    }
  }

  return {
    PrismaClient,
    Prisma: {
      JsonNull: null,
    },
  };
});

vi.mock('../src/prisma.js', () => ({ prisma: prismaMock }));

beforeEach(() => {
  db.activities.clear();
  db.samples.clear();
  db.metricDefinitions.clear();
  db.metricResults.clear();
});

export { db, prismaMock };
