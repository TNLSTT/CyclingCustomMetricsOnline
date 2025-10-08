import { median, quantile } from '../utils/statistics.js';

import type { MetricModule, MetricSample } from './types.js';

const DEFAULT_WINDOW_SECONDS = 300; // 5 minutes
const MIN_WINDOW_SECONDS = 120; // 2 minutes for very short rides
const TARGET_WINDOWS = 12;

function percentileLabel(percentile: number) {
  const rounded = Math.round(percentile * 100);
  return `p${rounded}`;
}

function resolveWindowSeconds(activityDurationSec: number | null | undefined) {
  if (!activityDurationSec || !Number.isFinite(activityDurationSec) || activityDurationSec <= 0) {
    return DEFAULT_WINDOW_SECONDS;
  }
  const candidate = Math.round(activityDurationSec / TARGET_WINDOWS);
  const clamped = Math.min(DEFAULT_WINDOW_SECONDS, Math.max(MIN_WINDOW_SECONDS, candidate));
  return clamped > 0 ? clamped : MIN_WINDOW_SECONDS;
}

interface RatioSample {
  t: number;
  ratio: number;
}

interface WindowAggregation {
  start: number;
  end: number;
  samples: number;
  validSamples: number;
  ratios: number[];
}

function toRatioSamples(samples: MetricSample[]) {
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const totalSamples = sorted.length;
  const ratioSamples: RatioSample[] = [];
  let validSamples = 0;

  for (const sample of sorted) {
    if (
      sample.power == null ||
      sample.heartRate == null ||
      !Number.isFinite(sample.power) ||
      !Number.isFinite(sample.heartRate) ||
      sample.heartRate <= 0
    ) {
      continue;
    }
    const ratio = sample.power / sample.heartRate;
    if (!Number.isFinite(ratio)) {
      continue;
    }
    validSamples += 1;
    ratioSamples.push({ t: sample.t, ratio });
  }

  return { ratioSamples, totalSamples, validSamples };
}

function aggregateWindows(
  samples: MetricSample[],
  ratioSamples: RatioSample[],
  windowSeconds: number,
) {
  if (samples.length === 0) {
    return [] as WindowAggregation[];
  }
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const startTime = sorted[0]!.t;
  const windows = new Map<number, WindowAggregation>();

  for (const sample of sorted) {
    const windowIndex = windowSeconds > 0 ? Math.floor((sample.t - startTime) / windowSeconds) : 0;
    const start = startTime + windowIndex * windowSeconds;
    const end = start + windowSeconds;
    const existing = windows.get(windowIndex);
    if (existing) {
      existing.samples += 1;
    } else {
      windows.set(windowIndex, {
        start,
        end,
        samples: 1,
        validSamples: 0,
        ratios: [],
      });
    }
  }

  for (const ratioSample of ratioSamples) {
    const windowIndex = windowSeconds > 0 ? Math.floor((ratioSample.t - startTime) / windowSeconds) : 0;
    const window = windows.get(windowIndex);
    if (!window) {
      continue;
    }
    window.validSamples += 1;
    window.ratios.push(ratioSample.ratio);
  }

  return [...windows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, value]) => value);
}

function computePercentiles(values: number[], percentiles: number[]) {
  const result: Record<string, number> = {};
  if (values.length === 0) {
    return result;
  }
  for (const percentile of percentiles) {
    if (!Number.isFinite(percentile) || percentile < 0 || percentile > 1) {
      continue;
    }
    const key = percentileLabel(percentile);
    result[key] = quantile(values, percentile);
  }
  return result;
}

export const whrEfficiencyMetric: MetricModule = {
  definition: {
    key: 'whr-efficiency',
    name: 'Watts/HR Efficiency Curve',
    version: 1,
    description:
      'Profiles aerobic efficiency across the ride by computing watts-per-heart-beat ratios over rolling windows.',
    units: 'W/bpm',
    computeConfig: {
      percentiles: [0.25, 0.5, 0.75],
    },
  },
  compute: (samples, { activity }) => {
    const percentiles = (whrEfficiencyMetric.definition.computeConfig?.percentiles as number[]) ?? [
      0.25,
      0.5,
      0.75,
    ];
    const windowSeconds = resolveWindowSeconds(activity.durationSec ?? null);
    const { ratioSamples, totalSamples, validSamples } = toRatioSamples(samples);

    if (ratioSamples.length === 0) {
      return {
        summary: {
          median_w_per_bpm: null,
          valid_sample_count: 0,
          total_sample_count: totalSamples,
          coverage_ratio: totalSamples > 0 ? 0 : null,
          window_seconds: windowSeconds,
          window_count: 0,
          valid_window_count: 0,
          drift_ratio: null,
          drift_percent: null,
        },
        series: [],
      };
    }

    const windowAggregations = aggregateWindows(samples, ratioSamples, windowSeconds);
    const windowSeries = windowAggregations.map((window, index) => {
      const percentileMap = computePercentiles(window.ratios, percentiles);
      const entry: Record<string, unknown> = {
        window_index: index + 1,
        start_sec: Number.parseFloat(window.start.toFixed(3)),
        end_sec: Number.parseFloat(window.end.toFixed(3)),
        midpoint_sec: Number.parseFloat(((window.start + window.end) / 2).toFixed(3)),
        duration_seconds: Number.parseFloat((window.end - window.start).toFixed(3)),
        sample_count: window.samples,
        valid_sample_count: window.validSamples,
        coverage_ratio:
          window.samples > 0 ? Number.parseFloat((window.validSamples / window.samples).toFixed(4)) : null,
      };
      for (const [key, value] of Object.entries(percentileMap)) {
        entry[`${key}_w_per_bpm`] = Number.parseFloat(value.toFixed(6));
      }
      return entry;
    });

    const ratioValues = ratioSamples.map((sample) => sample.ratio);
    const overallPercentiles = computePercentiles(ratioValues, percentiles);
    const overallMedian = ratioValues.length > 0 ? overallPercentiles.p50 ?? median(ratioValues) : null;
    const overallP25 =
      ratioValues.length > 0 && percentiles.some((value) => value === 0.25)
        ? overallPercentiles.p25 ?? quantile(ratioValues, 0.25)
        : overallPercentiles.p25 ?? null;
    const overallP75 =
      ratioValues.length > 0 && percentiles.some((value) => value === 0.75)
        ? overallPercentiles.p75 ?? quantile(ratioValues, 0.75)
        : overallPercentiles.p75 ?? null;

    const firstTimestamp = ratioSamples[0]!.t;
    const lastTimestamp = ratioSamples[ratioSamples.length - 1]!.t;
    const rideDuration =
      activity.durationSec && activity.durationSec > 0
        ? activity.durationSec
        : Math.max(lastTimestamp - firstTimestamp, windowSeconds);
    const halfSplitBoundary = firstTimestamp + rideDuration / 2;

    const earlyRatios = ratioSamples
      .filter((sample) => sample.t <= halfSplitBoundary)
      .map((sample) => sample.ratio);
    const lateRatios = ratioSamples
      .filter((sample) => sample.t > halfSplitBoundary)
      .map((sample) => sample.ratio);

    const earlyMedian = earlyRatios.length > 0 ? median(earlyRatios) : null;
    const lateMedian = lateRatios.length > 0 ? median(lateRatios) : null;

    const driftRatio =
      earlyMedian != null && lateMedian != null && earlyMedian !== 0 ? lateMedian / earlyMedian : null;
    const driftPercent = driftRatio != null ? (driftRatio - 1) * 100 : null;

    const coverageRatio = totalSamples > 0 ? Number.parseFloat((validSamples / totalSamples).toFixed(4)) : null;
    const validWindowCount = windowAggregations.filter((window) => window.validSamples > 0).length;

    const summary: Record<string, unknown> = {
      median_w_per_bpm: overallMedian != null ? Number.parseFloat(overallMedian.toFixed(6)) : null,
      p25_w_per_bpm: overallP25 != null ? Number.parseFloat(overallP25.toFixed(6)) : null,
      p75_w_per_bpm: overallP75 != null ? Number.parseFloat(overallP75.toFixed(6)) : null,
      early_median_w_per_bpm: earlyMedian != null ? Number.parseFloat(earlyMedian.toFixed(6)) : null,
      late_median_w_per_bpm: lateMedian != null ? Number.parseFloat(lateMedian.toFixed(6)) : null,
      drift_ratio: driftRatio != null ? Number.parseFloat(driftRatio.toFixed(6)) : null,
      drift_percent: driftPercent != null ? Number.parseFloat(driftPercent.toFixed(3)) : null,
      valid_sample_count: validSamples,
      total_sample_count: totalSamples,
      coverage_ratio: coverageRatio,
      window_seconds: windowSeconds,
      window_count: windowAggregations.length,
      valid_window_count: validWindowCount,
      sample_rate_hz: activity.sampleRateHz ?? null,
      early_sample_count: earlyRatios.length,
      late_sample_count: lateRatios.length,
    };

    return {
      summary,
      series: windowSeries,
    };
  },
};
