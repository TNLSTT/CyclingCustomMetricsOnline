import { computeAveragePower, computeStabilizedPower, extractPowerSamples } from '../utils/power.js';

import type { MetricModule } from './types.js';

const WINDOW_SECONDS = 30;
const COASTING_THRESHOLD_WATTS = 5;

function toFixedNumber(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

export const stabilizedPowerMetric: MetricModule = {
  definition: {
    key: 'stabilized-power',
    name: 'Stabilized Power',
    version: 1,
    description:
      'Computes stabilized power using 30-second rolling averages alongside pacing diagnostics.',
    units: 'W',
    computeConfig: {
      windowSeconds: WINDOW_SECONDS,
      coastingThresholdWatts: COASTING_THRESHOLD_WATTS,
    },
  },
  compute: (samples, context) => {
    const { activity } = context;
    const sampleRate = activity.sampleRateHz && activity.sampleRateHz > 0 ? activity.sampleRateHz : 1;
    const windowSize = Math.max(1, Math.round(WINDOW_SECONDS * sampleRate));

    const powerSamples = extractPowerSamples(samples);
    const validCount = powerSamples.length;
    const totalSamples = samples.length;

    if (validCount === 0) {
      return {
        summary: {
          stabilized_power_w: null,
          average_power_w: null,
          variability_index: null,
          coasting_share: null,
          valid_power_samples: 0,
          total_samples: totalSamples,
          rolling_window_count: 0,
          window_sample_count: windowSize,
          window_seconds: WINDOW_SECONDS,
        },
      };
    }

    const { stabilizedPower, rolling } = computeStabilizedPower(powerSamples, windowSize);
    const averagePower = computeAveragePower(powerSamples) ?? 0;

    const coastingCount = powerSamples.filter((sample) => sample.power <= COASTING_THRESHOLD_WATTS).length;

    const summary = {
      stabilized_power_w:
        stabilizedPower != null ? toFixedNumber(stabilizedPower, 1) : null,
      average_power_w: toFixedNumber(averagePower, 1),
      variability_index:
        stabilizedPower != null && averagePower > 0
          ? toFixedNumber(stabilizedPower / averagePower, 3)
          : null,
      coasting_share: toFixedNumber(coastingCount / validCount, 4),
      valid_power_samples: validCount,
      total_samples: totalSamples,
      rolling_window_count: rolling.length,
      window_sample_count: windowSize,
      window_seconds: WINDOW_SECONDS,
    };

    const series = rolling.map((entry) => ({
      t: entry.t,
      rolling_avg_power_w: toFixedNumber(entry.rollingAvg, 1),
    }));

    return {
      summary,
      series: series.length > 0 ? series : undefined,
    };
  },
};
