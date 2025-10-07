import express from 'express';
import asyncHandler from 'express-async-handler';

import { listMetricDefinitions } from '../metrics/registry.js';
import { prisma } from '../prisma.js';
import { normalizeIntervalEfficiencySeries } from '../metrics/intervalEfficiency.js';
import { logger } from '../logger.js';
import { computeAdaptationEdges } from '../services/adaptationEdgesService.js';
import { computeMovingAverageInputs } from '../services/movingAveragesService.js';
import { computeDepthAnalysis } from '../services/depthAnalysisService.js';

type IntervalEfficiencyHistoryRow = {
  activityId: string;
  computedAt: Date;
  summary: Record<string, unknown>;
  series: unknown;
  activity: {
    startTime: Date;
    durationSec: number;
  } | null;
  metricDefinition: {
    key: string;
    name: string;
    description: string;
    units: string | null;
  } | null;
};

export const metricsRouter = express.Router();

metricsRouter.get('/', (_req, res) => {
  res.status(200).json({ definitions: listMetricDefinitions() });
});

function formatEfficiency(value: number | null): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  return Number.parseFloat(value.toFixed(2));
}

metricsRouter.get(
  '/:metricKey/history',
  asyncHandler(async (req, res) => {
    try {
      const { metricKey } = req.params;
      const userId = req.user?.id;

      if (metricKey !== 'interval-efficiency') {
        res.status(404).json({ error: 'Metric history not available.' });
        return;
      }

      const metricResults = (await prisma.metricResult.findMany({
        where: {
          metricDefinition: { key: metricKey },
          ...(userId ? { activity: { userId } } : {}),
        },
        include: { activity: true, metricDefinition: true },
        orderBy: { activity: { startTime: 'asc' } },
      })) as IntervalEfficiencyHistoryRow[];

      if (metricResults.length === 0) {
        res.status(200).json({
          metric: {
            key: 'interval-efficiency',
            name: 'Interval Efficiency',
            description: 'Tracks watts-per-heart-rate efficiency across 1-hour ride intervals.',
            units: 'W/bpm',
          },
          intervalSeconds: 3600,
          points: [],
        });
        return;
      }

      const fallbackDefinition = {
        key: 'interval-efficiency',
        name: 'Interval Efficiency',
        description: 'Tracks watts-per-heart-rate efficiency across 1-hour ride intervals.',
        units: 'W/bpm',
      } as const;

      const definition = metricResults[0]?.metricDefinition ?? fallbackDefinition;
      const intervalSeconds = metricResults.reduce<number>((seconds, result) => {
        const summary = result.summary as Record<string, unknown>;
        const candidate = summary.interval_seconds;
        if (typeof candidate === 'number' && !Number.isNaN(candidate)) {
          return candidate;
        }
        return seconds;
      }, 3600);

      const points = metricResults.flatMap((result) => {
        const activity = result.activity;
        if (!activity) {
          return [];
        }

        const summary = result.summary as Record<string, unknown>;
        const intervals = normalizeIntervalEfficiencySeries(result.series).map((interval) => ({
          ...interval,
          w_per_hr: formatEfficiency(interval.w_per_hr),
        }));
        const efficiencies = intervals
          .map((interval) => interval.w_per_hr)
          .filter((value): value is number => typeof value === 'number');
        const average =
          efficiencies.length > 0
            ? formatEfficiency(
                efficiencies.reduce((total, value) => total + value, 0) / efficiencies.length,
              )
            : null;
        const first = intervals.find((interval) => typeof interval.w_per_hr === 'number')?.w_per_hr ?? null;
        const last =
          [...intervals]
            .reverse()
            .find((interval) => typeof interval.w_per_hr === 'number')?.w_per_hr ?? null;

        return [{
          activityId: result.activityId,
          activityStartTime: activity.startTime,
          activityDurationSec: activity.durationSec,
          computedAt: result.computedAt,
          intervalCount:
            typeof summary.interval_count === 'number' ? summary.interval_count : intervals.length,
          averageWPerHr: average,
          firstIntervalWPerHr: first,
          lastIntervalWPerHr: last,
          intervals,
        }];
      });

      res.status(200).json({
        metric: {
          key: definition.key,
          name: definition.name,
          description: definition.description,
          units: definition.units,
        },
        intervalSeconds,
        points,
      });
    } catch (error) {
      logger.error({ err: error }, 'Failed to load metric history');
      res.status(500).json({ error: 'Failed to load metric history.' });
      return;
    }
  }),
);

metricsRouter.get(
  '/adaptation-edges/deepest-blocks',
  asyncHandler(async (req, res) => {
    try {
      const userId = req.user?.id;
      const analysis = await computeAdaptationEdges(userId);
      res.status(200).json(analysis);
    } catch (error) {
      logger.error({ err: error }, 'Failed to compute adaptation edges');
      res.status(500).json({ error: 'Failed to compute adaptation edges.' });
      return;
    }
  }),
);

metricsRouter.get(
  '/moving-averages',
  asyncHandler(async (req, res) => {
    try {
      const userId = req.user?.id;
      const days = await computeMovingAverageInputs(userId);
      res.status(200).json({ days });
    } catch (error) {
      logger.error({ err: error }, 'Failed to compute moving averages');
      res.status(500).json({ error: 'Failed to compute moving averages.' });
      return;
    }
  }),
);

metricsRouter.get(
  '/depth-analysis',
  asyncHandler(async (req, res) => {
    try {
      const userId = req.user?.id;
      const thresholdKj = Number.parseFloat((req.query.thresholdKj as string | undefined) ?? '2000');
      const minPower = Number.parseFloat((req.query.minPower as string | undefined) ?? '180');

      const safeThreshold = Number.isFinite(thresholdKj) && thresholdKj >= 0 ? thresholdKj : 0;
      const safeMinPower = Number.isFinite(minPower) && minPower >= 0 ? minPower : 0;

      const analysis = await computeDepthAnalysis(userId, {
        thresholdKj: safeThreshold,
        minPowerWatts: safeMinPower,
      });

      res.status(200).json(analysis);
    } catch (error) {
      logger.error({ err: error }, 'Failed to compute depth analysis');
      res.status(500).json({ error: 'Failed to compute depth analysis.' });
      return;
    }
  }),
);
