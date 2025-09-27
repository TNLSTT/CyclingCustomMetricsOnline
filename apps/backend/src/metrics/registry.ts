import { hcsrMetric } from './hcsr.js';
import { intervalEfficiencyMetric } from './intervalEfficiency.js';
import { torqueVariabilityIndexMetric } from './tvi.js';
import { whrEfficiencyMetric } from './whrEfficiency.js';
import { normalizedPowerMetric } from './normalizedPower.js';
import type { MetricModule } from './types.js';

export const metricRegistry: Record<string, MetricModule> = {
  [hcsrMetric.definition.key]: hcsrMetric,
  [intervalEfficiencyMetric.definition.key]: intervalEfficiencyMetric,
  [torqueVariabilityIndexMetric.definition.key]: torqueVariabilityIndexMetric,
  [whrEfficiencyMetric.definition.key]: whrEfficiencyMetric,
  [normalizedPowerMetric.definition.key]: normalizedPowerMetric,
};

export function listMetricDefinitions() {
  return Object.values(metricRegistry).map((module) => module.definition);
}

export function getMetricModule(key: string): MetricModule | undefined {
  return metricRegistry[key];
}
