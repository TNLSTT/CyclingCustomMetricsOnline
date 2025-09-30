import { hcsrMetric } from './hcsr.js';
import { intervalEfficiencyMetric } from './intervalEfficiency.js';
import { torqueVariabilityIndexMetric } from './tvi.js';
import { whrEfficiencyMetric } from './whrEfficiency.js';
import { stabilizedPowerMetric } from './stabilizedPower.js';
import { lateAerobicEfficiencyMetric } from './lateAerobicEfficiency.js';
import type { MetricModule } from './types.js';

export const metricRegistry: Record<string, MetricModule> = {
  [hcsrMetric.definition.key]: hcsrMetric,
  [intervalEfficiencyMetric.definition.key]: intervalEfficiencyMetric,
  [torqueVariabilityIndexMetric.definition.key]: torqueVariabilityIndexMetric,
  [whrEfficiencyMetric.definition.key]: whrEfficiencyMetric,
  [stabilizedPowerMetric.definition.key]: stabilizedPowerMetric,
  [lateAerobicEfficiencyMetric.definition.key]: lateAerobicEfficiencyMetric,
};

export function listMetricDefinitions() {
  return Object.values(metricRegistry).map((module) => module.definition);
}

export function getMetricModule(key: string): MetricModule | undefined {
  return metricRegistry[key];
}
