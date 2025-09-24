import type { Activity, Prisma } from '@prisma/client';

export interface MetricSample {
  t: number;
  heartRate: number | null;
  cadence: number | null;
  power: number | null;
  speed: number | null;
  elevation: number | null;
}

export interface MetricDefinitionShape {
  key: string;
  name: string;
  version: number;
  description: string;
  units?: string;
  computeConfig?: Prisma.JsonValue;
}

export interface MetricComputationContext {
  activity: Activity;
}

export interface MetricComputationResult {
  summary: Record<string, unknown>;
  series?: unknown;
}

export interface MetricModule {
  definition: MetricDefinitionShape;
  compute: (
    samples: MetricSample[],
    context: MetricComputationContext,
  ) => Promise<MetricComputationResult> | MetricComputationResult;
}
