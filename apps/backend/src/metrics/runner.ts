import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import { normalizeNullableJson, normalizeSummaryJson } from '../utils/prismaJson.js';
import {
  buildMetricSnapshots,
  mergeProfileAnalytics,
  type ProfileMetricMetadata,
} from '../services/profileAnalyticsService.js';
import { recordMetricEvent, updateMetricComputationJob } from '../services/telemetryService.js';

import type { MetricComputationResult, MetricModule, MetricSample } from './types.js';
import { getMetricModule, metricRegistry } from './registry.js';

function selectMetricModules(metricKeys?: string[]): MetricModule[] {
  const keys = metricKeys ?? Object.keys(metricRegistry);
  return keys.map((key) => {
    const module = getMetricModule(key);
    if (!module) {
      throw new Error(`Unknown metric key: ${key}`);
    }
    return module;
  });
}

async function ensureDefinition(module: MetricModule) {
  const computeConfig = normalizeNullableJson(module.definition.computeConfig);
  const definition = await prisma.metricDefinition.upsert({
    where: { key: module.definition.key },
    update: {
      name: module.definition.name,
      description: module.definition.description,
      version: module.definition.version,
      units: module.definition.units ?? null,
      computeConfig,
    },
    create: {
      key: module.definition.key,
      name: module.definition.name,
      description: module.definition.description,
      version: module.definition.version,
      units: module.definition.units ?? null,
      computeConfig,
    },
  });
  return definition;
}

function mapSamples(samples: {
  t: number;
  heartRate: number | null;
  cadence: number | null;
  power: number | null;
  speed: number | null;
  elevation: number | null;
  temperature: number | null;
}[]): MetricSample[] {
  return samples.map((sample) => ({
    t: sample.t,
    heartRate: sample.heartRate,
    cadence: sample.cadence,
    power: sample.power,
    speed: sample.speed,
    elevation: sample.elevation,
    temperature: sample.temperature,
  }));
}

export async function runMetrics(activityId: string, metricKeys?: string[], userId?: string) {
  const modules = selectMetricModules(metricKeys);

  const activity = await prisma.activity.findFirst({
    where: { id: activityId, ...(userId ? { userId } : {}) },
  });

  if (!activity) {
    throw new Error('Activity not found');
  }

  const samples = await prisma.activitySample.findMany({
    where: { activityId },
    orderBy: { t: 'asc' },
  });

  const metricSamples = mapSamples(samples);
  const results: Record<string, MetricComputationResult> = {};
  const metricMetadata: Record<string, ProfileMetricMetadata> = {};
  const metricKeysResolved = modules.map((module) => module.definition.key);

  const jobId = await updateMetricComputationJob({
    phase: 'enqueue',
    activityId,
    userId: activity.userId,
    metricKeys: metricKeysResolved,
  });

  const start = Date.now();

  let success = true;

  try {
    if (jobId) {
      await updateMetricComputationJob({ phase: 'start', jobId });
    }

    for (const module of modules) {
      const definition = await ensureDefinition(module);
      metricMetadata[module.definition.key] = {
        metricVersion: definition.version,
        metricName: definition.name,
        metricDescription: definition.description,
        metricUnits: definition.units ?? null,
      };
      try {
        const computation = await module.compute(metricSamples, { activity });
        await prisma.metricResult.upsert({
          where: {
            activityId_metricDefinitionId: {
              activityId,
              metricDefinitionId: definition.id,
            },
          },
          update: {
            summary: normalizeSummaryJson(computation.summary),
            series: normalizeNullableJson(computation.series ?? null),
            computedAt: new Date(),
          },
          create: {
            activityId,
            metricDefinitionId: definition.id,
            summary: normalizeSummaryJson(computation.summary),
            series: normalizeNullableJson(computation.series ?? null),
          },
        });
        results[module.definition.key] = computation;
      } catch (error) {
        success = false;
        logger.error({ error, metric: module.definition.key }, 'Metric computation failed');
        results[module.definition.key] = {
          summary: {
            error: (error as Error).message,
          },
        };
      }
    }

    if (activity.userId) {
      const snapshots = buildMetricSnapshots(activity, metricMetadata, results);
      await mergeProfileAnalytics(activity.userId, { metrics: snapshots });
    }
  } catch (error) {
    success = false;
    logger.error({ error }, 'Metric runner failed');
    throw error;
  } finally {
    const duration = Date.now() - start;
    await recordMetricEvent({
      type: 'recompute',
      userId: activity.userId,
      activityId: activity.id,
      durationMs: duration,
      success,
      meta: { metricKeys: metricKeysResolved },
    });

    if (jobId) {
      await updateMetricComputationJob({ phase: 'complete', jobId, success, durationMs: duration });
    }
  }

  return results;
}
