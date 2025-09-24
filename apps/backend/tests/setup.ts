import { randomUUID } from 'node:crypto';

import { beforeEach, vi } from 'vitest';

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

const prismaMock = {
  $transaction: async <T>(fn: (tx: typeof prismaMock) => Promise<T>): Promise<T> => {
    return fn(prismaMock);
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
    findMany: async ({ skip = 0, take, orderBy, include }: any) => {
      let activities = Array.from(db.activities.values());
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
    count: async () => db.activities.size,
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
        list.push({ ...entry });
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
      const id = randomUUID();
      const record: MetricResultRecord = {
        id,
        activityId: create.activityId,
        metricDefinitionId: create.metricDefinitionId,
        summary: create.summary,
        series: create.series,
        computedAt: create.computedAt ?? new Date(),
      };
      db.metricResults.set(key, record);
      return { ...record };
    },
    findFirst: async ({ where, include }: any) => {
      const definition = Array.from(db.metricDefinitions.values()).find(
        (def) => def.key === where.metricDefinition.key,
      );
      if (!definition) {
        return null;
      }
      const result = Array.from(db.metricResults.values()).find(
        (metric) =>
          metric.activityId === where.activityId &&
          metric.metricDefinitionId === definition.id,
      );
      if (!result) {
        return null;
      }
      if (include?.metricDefinition) {
        return { ...result, metricDefinition: { ...definition } };
      }
      return { ...result };
    },
  },
};

vi.mock('../src/prisma.js', () => ({ prisma: prismaMock }));

beforeEach(() => {
  db.activities.clear();
  db.samples.clear();
  db.metricDefinitions.clear();
  db.metricResults.clear();
});

export { db, prismaMock };
