import { Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';
import { logger } from '../logger.js';
import type { MetricComputationResult, MetricModule, MetricSample } from './types.js';
import { getMetricModule, metricRegistry } from './registry.js';

function normalizeSeries(series: unknown) {
  if (series === undefined) {
    return Prisma.JsonNull;
  }
  return series as Prisma.JsonValue;
}

function normalizeSummary(summary: Record<string, unknown>) {
  return summary as Prisma.JsonObject;
}

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
  const computeConfig = module.definition.computeConfig ?? Prisma.JsonNull;
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

function mapSamples(samples: { t: number; heartRate: number | null; cadence: number | null; power: number | null; speed: number | null; elevation: number | null }[]): MetricSample[] {
  return samples.map((sample) => ({
    t: sample.t,
    heartRate: sample.heartRate,
    cadence: sample.cadence,
    power: sample.power,
    speed: sample.speed,
    elevation: sample.elevation,
  }));
}

export async function runMetrics(activityId: string, metricKeys?: string[]) {
  const modules = selectMetricModules(metricKeys);

  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
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

  for (const module of modules) {
    const definition = await ensureDefinition(module);
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
          summary: normalizeSummary(computation.summary),
          series: normalizeSeries(computation.series ?? null),
          computedAt: new Date(),
        },
        create: {
          activityId,
          metricDefinitionId: definition.id,
          summary: normalizeSummary(computation.summary),
          series: normalizeSeries(computation.series ?? null),
        },
      });
      results[module.definition.key] = computation;
    } catch (error) {
      logger.error({ error, metric: module.definition.key }, 'Metric computation failed');
      results[module.definition.key] = {
        summary: {
          error: (error as Error).message,
        },
      };
    }
  }

  return results;
}
