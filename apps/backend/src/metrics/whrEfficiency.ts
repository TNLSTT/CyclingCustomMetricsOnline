import type { MetricModule } from './types.js';

export const whrEfficiencyMetric: MetricModule = {
  definition: {
    key: 'whr-efficiency',
    name: 'Watts/HR Efficiency Curve',
    version: 1,
    description:
      'Profiles aerobic efficiency over time by comparing power-to-heart-rate ratios. Placeholder implementation.',
    units: 'W/bpm',
    computeConfig: {
      percentiles: [0.25, 0.5, 0.75],
    },
  },
  compute: () => ({
    summary: {
      implemented: false,
      note:
        'W/HR efficiency analysis will chart aerobic decoupling once power streams are available.',
    },
  }),
};
