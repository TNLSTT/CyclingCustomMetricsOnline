import type { MetricModule, MetricSample } from './types.js';

const WINDOW_SECONDS = 30;
const COASTING_THRESHOLD_WATTS = 5;

function toFixedNumber(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function computeRollingAverages(
  samples: MetricSample[],
  windowSize: number,
): Array<{ t: number; rollingAvg: number }> {
  if (windowSize <= 1) {
    return samples
      .filter((sample) => sample.power != null)
      .map((sample) => ({ t: sample.t, rollingAvg: sample.power as number }));
  }

  const rolling: Array<{ t: number; rollingAvg: number }> = [];
  const window: number[] = [];
  let sum = 0;

  for (const sample of samples) {
    if (sample.power == null) {
      continue;
    }
    const power = sample.power;
    window.push(power);
    sum += power;
    if (window.length > windowSize) {
      const removed = window.shift();
      if (removed != null) {
        sum -= removed;
      }
    }
    if (window.length === windowSize) {
      rolling.push({ t: sample.t, rollingAvg: sum / windowSize });
    }
  }

  return rolling;
}

export const normalizedPowerMetric: MetricModule = {
  definition: {
    key: 'normalized-power',
    name: 'Normalized Power',
    version: 1,
    description:
      'Computes normalized power using 30-second rolling averages alongside pacing diagnostics.',
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

    const powerSamples = samples
      .filter((sample) => sample.power != null)
      .sort((a, b) => a.t - b.t);

    const validCount = powerSamples.length;
    const totalSamples = samples.length;

    if (validCount === 0) {
      return {
        summary: {
          normalized_power_w: null,
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

    const rolling = computeRollingAverages(powerSamples, windowSize);

    const powerSum = powerSamples.reduce((sum, sample) => sum + (sample.power ?? 0), 0);
    const averagePower = powerSum / validCount;

    let normalizedPower: number | null = null;
    if (rolling.length > 0) {
      const meanFourth =
        rolling.reduce((sum, entry) => sum + entry.rollingAvg ** 4, 0) / rolling.length;
      normalizedPower = meanFourth > 0 ? meanFourth ** 0.25 : 0;
    }

    const coastingCount = powerSamples.filter((sample) => (sample.power ?? 0) <= COASTING_THRESHOLD_WATTS)
      .length;

    const summary = {
      normalized_power_w:
        normalizedPower != null ? toFixedNumber(normalizedPower, 1) : null,
      average_power_w: toFixedNumber(averagePower, 1),
      variability_index:
        normalizedPower != null && averagePower > 0
          ? toFixedNumber(normalizedPower / averagePower, 3)
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
