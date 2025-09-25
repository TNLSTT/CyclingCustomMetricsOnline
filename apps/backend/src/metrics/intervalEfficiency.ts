import type { MetricModule, MetricSample } from './types.js';

const INTERVAL_SECONDS = 3600;

type IntervalAccumulator = {
  samples: number;
  powerSum: number;
  powerCount: number;
  heartRateSum: number;
  heartRateCount: number;
  cadenceSum: number;
  cadenceCount: number;
  temperatureSum: number;
  temperatureCount: number;
};

function createAccumulator(): IntervalAccumulator {
  return {
    samples: 0,
    powerSum: 0,
    powerCount: 0,
    heartRateSum: 0,
    heartRateCount: 0,
    cadenceSum: 0,
    cadenceCount: 0,
    temperatureSum: 0,
    temperatureCount: 0,
  };
}

function addSample(acc: IntervalAccumulator, sample: MetricSample) {
  acc.samples += 1;
  if (typeof sample.power === 'number') {
    acc.powerSum += sample.power;
    acc.powerCount += 1;
  }
  if (typeof sample.heartRate === 'number') {
    acc.heartRateSum += sample.heartRate;
    acc.heartRateCount += 1;
  }
  if (typeof sample.cadence === 'number') {
    acc.cadenceSum += sample.cadence;
    acc.cadenceCount += 1;
  }
  if (typeof sample.temperature === 'number') {
    acc.temperatureSum += sample.temperature;
    acc.temperatureCount += 1;
  }
}

function average(sum: number, count: number): number | null {
  if (count === 0) {
    return null;
  }
  return sum / count;
}

type IntervalSummary = {
  interval: number;
  avg_power: number | null;
  avg_hr: number | null;
  avg_cadence: number | null;
  avg_temp: number | null;
  w_per_hr: number | null;
};

function finalizeInterval(index: number, acc: IntervalAccumulator): IntervalSummary {
  const avgPowerRaw = average(acc.powerSum, acc.powerCount);
  const avgHrRaw = average(acc.heartRateSum, acc.heartRateCount);
  const avgCadenceRaw = average(acc.cadenceSum, acc.cadenceCount);
  const avgTempRaw = average(acc.temperatureSum, acc.temperatureCount);

  const avgPower = avgPowerRaw != null ? Math.round(avgPowerRaw) : null;
  const avgHr = avgHrRaw != null ? Math.round(avgHrRaw) : null;
  const avgCadence = avgCadenceRaw != null ? Math.round(avgCadenceRaw) : null;
  const avgTemp =
    avgTempRaw != null ? Number.parseFloat(avgTempRaw.toFixed(1)) : null;

  const wPerHr =
    avgPowerRaw != null && avgHrRaw != null && avgHrRaw > 0
      ? Number.parseFloat((avgPowerRaw / avgHrRaw).toFixed(2))
      : null;

  return {
    interval: index + 1,
    avg_power: avgPower,
    avg_hr: avgHr,
    avg_cadence: avgCadence,
    avg_temp: avgTemp,
    w_per_hr: wPerHr,
  };
}

function buildIntervals(samples: MetricSample[]): IntervalSummary[] {
  const buckets = new Map<number, IntervalAccumulator>();

  for (const sample of samples) {
    const intervalIndex = Math.floor(sample.t / INTERVAL_SECONDS);
    const bucket = buckets.get(intervalIndex) ?? createAccumulator();
    addSample(bucket, sample);
    buckets.set(intervalIndex, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, acc]) => acc.samples > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([index, acc]) => finalizeInterval(index, acc));
}

export const intervalEfficiencyMetric: MetricModule = {
  definition: {
    key: 'interval-efficiency',
    name: 'Interval Efficiency',
    version: 1,
    description:
      'Tracks watts-per-heart-rate efficiency across 1-hour ride intervals.',
    units: 'W/bpm',
    computeConfig: {
      intervalSeconds: INTERVAL_SECONDS,
    },
  },
  compute: (samples, context) => {
    const intervals = buildIntervals(samples);

    return {
      summary: {
        interval_seconds: INTERVAL_SECONDS,
        interval_count: intervals.length,
        activity_duration_sec: context.activity.durationSec,
      },
      series: intervals,
    };
  },
};
