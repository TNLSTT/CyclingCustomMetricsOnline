import type { Prisma } from '@prisma/client';

export type ActivityWithMetrics = Prisma.ActivityGetPayload<{
  include: {
    metrics: {
      include: {
        metricDefinition: true;
      };
    };
  };
}>;

export function mapActivity(activity: ActivityWithMetrics) {
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
