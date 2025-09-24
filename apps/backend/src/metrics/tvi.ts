import type { MetricModule } from './types.js';

export const torqueVariabilityIndexMetric: MetricModule = {
  definition: {
    key: 'tvi',
    name: 'Torque Variability Index',
    version: 1,
    description:
      'Estimates on-bike torque smoothness and variability from cadence and power. Placeholder implementation.',
    units: 'dimensionless',
    computeConfig: {
      windowSeconds: 30,
    },
  },
  compute: () => ({
    summary: {
      implemented: false,
      note:
        'TVI requires high-resolution torque reconstruction and is planned for a future release.',
    },
  }),
};
