import type { MetricSample } from '../metrics/types.js';

export type PowerSample = {
  t: number;
  power: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function extractPowerSamples(samples: MetricSample[]): PowerSample[] {
  return samples
    .filter((sample) => isFiniteNumber(sample.power))
    .map((sample) => ({ t: sample.t, power: sample.power as number }))
    .sort((a, b) => a.t - b.t);
}

export function computeAveragePower(samples: PowerSample[]): number | null {
  if (samples.length === 0) {
    return null;
  }

  const total = samples.reduce((sum, sample) => sum + sample.power, 0);
  return total / samples.length;
}

export function computeRollingAverages(
  samples: PowerSample[],
  windowSize: number,
): Array<{ t: number; rollingAvg: number }> {
  if (windowSize <= 1) {
    return samples.map((sample) => ({ t: sample.t, rollingAvg: sample.power }));
  }

  const rolling: Array<{ t: number; rollingAvg: number }> = [];
  const window = new Array<number>(windowSize);
  let filled = 0;
  let startIndex = 0;
  let sum = 0;

  for (const sample of samples) {
    const value = sample.power;

    if (filled < windowSize) {
      const insertIndex = (startIndex + filled) % windowSize;
      window[insertIndex] = value;
      filled += 1;
      sum += value;
    } else {
      const oldest = window[startIndex]!;
      sum -= oldest;
      window[startIndex] = value;
      sum += value;
      startIndex = (startIndex + 1) % windowSize;
    }

    if (filled === windowSize) {
      rolling.push({ t: sample.t, rollingAvg: sum / windowSize });
    }
  }

  return rolling;
}

export function computeNormalizedPower(
  samples: PowerSample[],
  windowSize: number,
): { normalizedPower: number | null; rolling: Array<{ t: number; rollingAvg: number }> } {
  const rolling = computeRollingAverages(samples, windowSize);

  if (rolling.length === 0) {
    return { normalizedPower: null, rolling };
  }

  const meanFourth = rolling.reduce((sum, entry) => sum + entry.rollingAvg ** 4, 0) / rolling.length;
  const normalizedPower = meanFourth > 0 ? meanFourth ** 0.25 : 0;

  return { normalizedPower, rolling };
}

export function computeBestRollingAverage(
  samples: PowerSample[],
  windowSize: number,
): number | null {
  if (windowSize <= 0 || samples.length < windowSize) {
    return null;
  }

  const rolling = computeRollingAverages(samples, windowSize);
  if (rolling.length === 0) {
    return null;
  }

  return rolling.reduce((max, entry) => (entry.rollingAvg > max ? entry.rollingAvg : max), -Infinity);
}

export function sumPower(samples: MetricSample[]): number {
  return samples.reduce((total, sample) => {
    if (isFiniteNumber(sample.power)) {
      return total + (sample.power as number);
    }
    return total;
  }, 0);
}
