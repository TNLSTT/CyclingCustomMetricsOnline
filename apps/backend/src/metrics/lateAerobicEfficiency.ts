import type { MetricModule } from './types.js';

const ANALYSIS_WINDOW_MINUTES = 35;
const FINAL_BUFFER_MINUTES = 5;

const ANALYSIS_WINDOW_SECONDS = ANALYSIS_WINDOW_MINUTES * 60;
const FINAL_BUFFER_SECONDS = FINAL_BUFFER_MINUTES * 60;

function round(value: number, fractionDigits: number) {
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function clampWindow(start: number, end: number) {
  if (end <= 0) {
    return { start: 0, end: 0 };
  }
  const clampedStart = Math.max(0, Math.min(start, end));
  return { start: clampedStart, end };
}

export const lateAerobicEfficiencyMetric: MetricModule = {
  definition: {
    key: 'late-aerobic-efficiency',
    name: 'Late-ride Aerobic Efficiency',
    version: 1,
    description:
      'Evaluates aerobic durability by averaging power-to-heart-rate efficiency over the final 35 minutes (excluding the last 5 minutes).',
    units: 'W/bpm',
    computeConfig: {
      analysisWindowMinutes: ANALYSIS_WINDOW_MINUTES,
      exclusionBufferMinutes: FINAL_BUFFER_MINUTES,
    },
  },
  compute: (samples, context) => {
    const { activity } = context;
    const durationSec =
      typeof activity.durationSec === 'number' && !Number.isNaN(activity.durationSec)
        ? activity.durationSec
        : samples.length > 0
          ? samples[samples.length - 1]?.t ?? 0
          : 0;

    const requestedStart = durationSec - ANALYSIS_WINDOW_SECONDS;
    const requestedEnd = durationSec - FINAL_BUFFER_SECONDS;
    const { start: windowStart, end: windowEnd } = clampWindow(requestedStart, requestedEnd);

    if (windowEnd <= windowStart) {
      return {
        summary: {
          watts_per_bpm: null,
          average_power_w: null,
          average_heart_rate_bpm: null,
          valid_sample_count: 0,
          total_window_sample_count: 0,
          requested_window_seconds: ANALYSIS_WINDOW_SECONDS,
          analyzed_window_seconds: 0,
          window_start_offset_sec: Math.max(0, windowStart),
          window_end_offset_sec: Math.max(0, windowEnd),
        },
      };
    }

    const windowSamples = samples.filter((sample) => sample.t >= windowStart && sample.t < windowEnd);
    const totalWindowSampleCount = windowSamples.length;

    const validSamples = windowSamples.filter((sample) => sample.power != null && sample.heartRate != null);

    const validSampleCount = validSamples.length;

    if (validSampleCount === 0) {
      return {
        summary: {
          watts_per_bpm: null,
          average_power_w: null,
          average_heart_rate_bpm: null,
          valid_sample_count: 0,
          total_window_sample_count: totalWindowSampleCount,
          requested_window_seconds: ANALYSIS_WINDOW_SECONDS,
          analyzed_window_seconds: windowEnd - windowStart,
          window_start_offset_sec: Math.max(0, windowStart),
          window_end_offset_sec: Math.max(0, windowEnd),
        },
      };
    }

    const powerSum = validSamples.reduce((sum, sample) => sum + (sample.power ?? 0), 0);
    const hrSum = validSamples.reduce((sum, sample) => sum + (sample.heartRate ?? 0), 0);

    const averagePower = powerSum / validSampleCount;
    const averageHeartRate = hrSum / validSampleCount;

    const wattsPerBpm = averageHeartRate > 0 ? averagePower / averageHeartRate : null;

    return {
      summary: {
        watts_per_bpm: wattsPerBpm != null ? round(wattsPerBpm, 3) : null,
        average_power_w: round(averagePower, 1),
        average_heart_rate_bpm: round(averageHeartRate, 1),
        valid_sample_count: validSampleCount,
        total_window_sample_count: totalWindowSampleCount,
        requested_window_seconds: ANALYSIS_WINDOW_SECONDS,
        analyzed_window_seconds: windowEnd - windowStart,
        window_start_offset_sec: Math.max(0, windowStart),
        window_end_offset_sec: Math.max(0, windowEnd),
      },
    };
  },
};
