import type { Activity } from '@prisma/client';

import { prisma } from '../prisma.js';
import type { MetricSample } from '../metrics/types.js';
import { computeRollingAverages, extractPowerSamples } from '../utils/power.js';
import { mergeProfileAnalytics, summarizeTrainingFrontiers } from './profileAnalyticsService.js';

const MAX_WINDOW_DAYS = 180;
const DEFAULT_WINDOW_DAYS = 90;

const POWER_DURATIONS_SECONDS = [
  5,
  15,
  30,
  60,
  120,
  180,
  300,
  480,
  600,
  1200,
  1800,
  2700,
  3600,
  5400,
  7200,
  10800,
  14400,
];

const KJ_FRONTIER_DURATIONS_HOURS = [2, 3, 4, 5];

const FATIGUE_BINS_KJ = [1000, 1500, 2000, 2500, 3000];
const FATIGUE_TARGET_DURATIONS_SECONDS = [300, 600, 1200, 1800];

const EFFICIENCY_DURATIONS_SECONDS = [10800, 14400, 18000];
const EFFICIENCY_MAX_RESULTS = 3;
const CADENCE_VALID_THRESHOLD = 0;
const CADENCE_COVERAGE_MIN = 0.85;
const MOVING_SPEED_THRESHOLD = 0.5;
const MOVING_COVERAGE_MIN = 0.98;
const HEART_RATE_COVERAGE_MIN = 0.9;

const REPEATABILITY_TARGETS = [
  {
    key: 'vo2',
    label: 'VO2 max intervals',
    minPct: 110,
    maxPct: 120,
    minDuration: 180,
    maxDuration: 360,
  },
  {
    key: 'threshold',
    label: 'Threshold intervals',
    minPct: 95,
    maxPct: 105,
    minDuration: 480,
    maxDuration: 1200,
  },
];

const MIN_INTERVAL_COUNT = 3;
const REST_MIN_RATIO = 1;
const REST_MAX_RATIO = 1.5;

const TIME_IN_ZONE_TOLERANCE = 0.05;
const ROLLING_AVG_WINDOW_SECONDS = 30;

interface ActivityWithSamples extends Activity {
  samples: Array<{
    t: number;
    power: number | null;
    heartRate: number | null;
    cadence: number | null;
    speed: number | null;
  }>;
}

interface PowerWindowResult {
  value: number | null;
  pctFtp?: number | null;
  activityId: string | null;
  startTime: string | null;
  windowStartSec: number | null;
}

interface DurationPowerEntry extends PowerWindowResult {
  durationSec: number;
}

interface KjFrontierEntry extends PowerWindowResult {
  durationHours: number;
  averageWatts: number | null;
  totalKj: number | null;
}

interface DurabilityEntry extends PowerWindowResult {
  fatigueKj: number;
  durationSec: number;
  pctFtp: number | null;
  deltaWatts: number | null;
  deltaPct: number | null;
}

interface EfficiencyWindow extends PowerWindowResult {
  durationSec: number;
  averageWatts: number | null;
  averageHeartRate: number | null;
  wattsPerBpm: number | null;
  wattsPerHeartRateReserve: number | null;
  cadenceCoverage: number;
  movingCoverage: number;
}

interface RepeatabilityInterval {
  activityId: string;
  startTime: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  avgWatts: number;
  avgPctFtp: number;
}

interface RepeatabilitySequence {
  targetKey: string;
  activityId: string;
  startTime: string;
  startSec: number;
  reps: number;
  avgWattsByRep: number[];
  avgPctByRep: number[];
  decaySlope: number;
  dropFromFirstToLast: number;
}

interface ZoneDefinition {
  key: string;
  label: string;
  minPct: number;
  maxPct: number | null;
}

interface ZoneStreakSummary extends PowerWindowResult {
  zoneKey: string;
  label: string;
  minPct: number;
  maxPct: number | null;
  durationSec: number;
  averageWatts: number | null;
  averageHeartRate: number | null;
}

export interface DurationPowerFrontier {
  durations: DurationPowerEntry[];
  convexHull: DurationPowerEntry[];
  kjFrontier: KjFrontierEntry[];
  peakKjPerHour: KjFrontierEntry | null;
}

export interface DurabilityFrontier {
  efforts: DurabilityEntry[];
}

export interface EfficiencyFrontier {
  windows: EfficiencyWindow[];
}

export interface RepeatabilityFrontier {
  sequences: RepeatabilitySequence[];
  bestRepeatability: Array<{
    targetKey: string;
    reps: number;
    activityId: string | null;
    startTime: string | null;
    startSec: number | null;
  }>;
}

export interface TimeInZoneFrontier {
  streaks: ZoneStreakSummary[];
}

export interface TrainingFrontiersResponse {
  windowDays: number;
  ftpWatts: number | null;
  weightKg: number | null;
  hrMaxBpm: number | null;
  hrRestBpm: number | null;
  durationPower: DurationPowerFrontier;
  durability: DurabilityFrontier;
  efficiency: EfficiencyFrontier;
  repeatability: RepeatabilityFrontier;
  timeInZone: TimeInZoneFrontier;
}

function roundNumber(value: number | null, fractionDigits = 1): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** fractionDigits;
  return Math.round(value * factor) / factor;
}

function inferSampleRate(activity: Activity, samples: MetricSample[]): number {
  if (activity.sampleRateHz && activity.sampleRateHz > 0) {
    return activity.sampleRateHz;
  }

  if (samples.length >= 2) {
    const first = samples[0]!;
    const last = samples[samples.length - 1]!;
    const delta = last.t - first.t;
    if (delta > 0) {
      return (samples.length - 1) / delta;
    }
  }

  if (activity.durationSec > 0 && samples.length > 0) {
    return samples.length / activity.durationSec;
  }

  return 1;
}

function toMetricSamples(samples: ActivityWithSamples['samples']): MetricSample[] {
  return samples
    .map((sample) => ({
      t: sample.t,
      power: sample.power,
      heartRate: sample.heartRate,
      cadence: sample.cadence,
      speed: sample.speed,
      elevation: null,
    }))
    .sort((a, b) => a.t - b.t);
}

function computeHeartRateReservePercent(
  heartRate: number | null,
  hrRest: number | null,
  hrMax: number | null,
): number | null {
  if (
    heartRate == null ||
    !Number.isFinite(heartRate) ||
    hrRest == null ||
    hrMax == null ||
    !Number.isFinite(hrRest) ||
    !Number.isFinite(hrMax) ||
    hrMax <= hrRest
  ) {
    return null;
  }
  const reserve = hrMax - hrRest;
  return ((heartRate - hrRest) / reserve) * 100;
}

function computeConvexHull(entries: DurationPowerEntry[]): DurationPowerEntry[] {
  type ConvexPoint = DurationPowerEntry & { logDuration: number; logPower: number };

  const valid: ConvexPoint[] = entries
    .filter((entry) => entry.value != null && entry.value > 0)
    .map((entry) => ({
      ...entry,
      logDuration: Math.log(entry.durationSec),
      logPower: Math.log(entry.value as number),
    }))
    .sort((a, b) => a.durationSec - b.durationSec);

  const hull: ConvexPoint[] = [];

  for (const entry of valid) {
    while (hull.length >= 2) {
      const last = hull[hull.length - 1]!;
      const prev = hull[hull.length - 2]!;
      const slope1 = (last.logPower - prev.logPower) / (last.logDuration - prev.logDuration);
      const slope2 = (entry.logPower - last.logPower) / (entry.logDuration - last.logDuration);
      if (slope2 > slope1) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(entry);
  }

  return hull.map((entry) => ({
    durationSec: entry.durationSec,
    value: entry.value,
    activityId: entry.activityId,
    startTime: entry.startTime,
    windowStartSec: entry.windowStartSec,
  }));
}

function defaultZones(): ZoneDefinition[] {
  return [
    { key: 'Z1', label: 'Active recovery', minPct: 0, maxPct: 55 },
    { key: 'Z2', label: 'Endurance', minPct: 55, maxPct: 75 },
    { key: 'Z3', label: 'Tempo', minPct: 75, maxPct: 90 },
    { key: 'Z4', label: 'Threshold', minPct: 90, maxPct: 105 },
    { key: 'Z5', label: 'VO2 max', minPct: 105, maxPct: 120 },
    { key: 'Z6', label: 'Anaerobic', minPct: 120, maxPct: null },
  ];
}

function computePowerPrefixSums(values: number[]): number[] {
  const prefix = new Array(values.length + 1).fill(0);
  for (let index = 0; index < values.length; index += 1) {
    prefix[index + 1] = prefix[index] + values[index]!;
  }
  return prefix;
}

function sumWindow(prefix: number[], start: number, end: number): number {
  return prefix[end] - prefix[start];
}

function computeDurationPowerFrontier(
  activities: ActivityWithSamples[],
  ftpWatts: number | null,
): DurationPowerFrontier {
  const durationEntries: DurationPowerEntry[] = POWER_DURATIONS_SECONDS.map((duration) => ({
    durationSec: duration,
    value: null,
    activityId: null,
    startTime: null,
    windowStartSec: null,
  }));

  const kjEntries: KjFrontierEntry[] = KJ_FRONTIER_DURATIONS_HOURS.map((hours) => ({
    durationHours: hours,
    value: null,
    activityId: null,
    startTime: null,
    windowStartSec: null,
    averageWatts: null,
    totalKj: null,
  }));

  let peakKj: KjFrontierEntry | null = null;

  for (const activity of activities) {
    if (activity.samples.length === 0) {
      continue;
    }

    const metricSamples = toMetricSamples(activity.samples);
    const powerSamples = extractPowerSamples(metricSamples);
    if (powerSamples.length === 0) {
      continue;
    }

    const sampleRate = Math.max(1, Math.round(inferSampleRate(activity, metricSamples)));
    const powerValues = powerSamples.map((sample) => sample.power);
    const prefix = computePowerPrefixSums(powerValues);

    for (const entry of durationEntries) {
      const windowSize = Math.max(1, Math.round(entry.durationSec * sampleRate));
      if (windowSize > powerValues.length) {
        continue;
      }

      let best: number | null = null;
      let bestIndex = -1;
      for (let start = 0; start + windowSize <= powerValues.length; start += 1) {
        const sum = sumWindow(prefix, start, start + windowSize);
        const avg = sum / windowSize;
        if (best == null || avg > best) {
          best = avg;
          bestIndex = start;
        }
      }

      if (best != null && best > (entry.value ?? -Infinity)) {
        entry.value = roundNumber(best, 1);
        entry.pctFtp = ftpWatts && ftpWatts > 0 ? roundNumber((best / ftpWatts) * 100, 1) : null;
        entry.activityId = activity.id;
        entry.startTime = activity.startTime.toISOString();
        entry.windowStartSec = Math.round(powerSamples[bestIndex]?.t ?? 0);
      }
    }

    for (const entry of kjEntries) {
      const windowSize = Math.max(1, Math.round(entry.durationHours * 3600 * sampleRate));
      if (windowSize > powerSamples.length) {
        continue;
      }

      const prefix = computePowerPrefixSums(powerSamples.map((sample) => sample.power));
      let bestValue: number | null = null;
      let bestIndex = -1;
      for (let start = 0; start + windowSize <= powerSamples.length; start += 1) {
        const sum = sumWindow(prefix, start, start + windowSize);
        const avgPower = sum / windowSize;
        if (bestValue == null || avgPower > bestValue) {
          bestValue = avgPower;
          bestIndex = start;
        }
      }

      if (bestValue != null && bestIndex >= 0 && bestValue > (entry.averageWatts ?? -Infinity)) {
        const kjPerHour = bestValue * 3.6;
        entry.value = roundNumber(kjPerHour, 1);
        entry.averageWatts = roundNumber(bestValue, 1);
        entry.totalKj = roundNumber(bestValue * entry.durationHours * 3.6, 1);
        entry.pctFtp = ftpWatts && ftpWatts > 0 ? roundNumber((bestValue / ftpWatts) * 100, 1) : null;
        entry.activityId = activity.id;
        entry.startTime = activity.startTime.toISOString();
        entry.windowStartSec = Math.round(powerSamples[bestIndex]?.t ?? 0);
      }

      if (entry.value != null) {
        if (!peakKj || (entry.value ?? 0) > (peakKj.value ?? 0)) {
          peakKj = { ...entry };
        }
      }
    }
  }

  const convexHull = computeConvexHull(durationEntries);

  return {
    durations: durationEntries,
    convexHull,
    kjFrontier: kjEntries,
    peakKjPerHour: peakKj,
  };
}

function computeDurabilityFrontier(
  activities: ActivityWithSamples[],
  ftpWatts: number | null,
  freshDurations: DurationPowerEntry[],
): DurabilityFrontier {
  const efforts: DurabilityEntry[] = [];

  for (const fatigue of FATIGUE_BINS_KJ) {
    for (const durationSec of FATIGUE_TARGET_DURATIONS_SECONDS) {
      efforts.push({
        fatigueKj: fatigue,
        durationSec,
        value: null,
        activityId: null,
        startTime: null,
        windowStartSec: null,
        pctFtp: null,
        deltaWatts: null,
        deltaPct: null,
      });
    }
  }

  const freshLookup = new Map<number, number>();
  for (const entry of freshDurations) {
    if (entry.value != null) {
      freshLookup.set(entry.durationSec, entry.value);
    }
  }

  for (const activity of activities) {
    if (activity.samples.length === 0) {
      continue;
    }

    const metricSamples = toMetricSamples(activity.samples);
    const powerSamples = extractPowerSamples(metricSamples);
    if (powerSamples.length === 0) {
      continue;
    }

    const sampleRate = Math.max(1e-6, inferSampleRate(activity, metricSamples));
    const intervalSeconds = 1 / sampleRate;

    const powerValues = powerSamples.map((sample) => sample.power);
    const prefix = computePowerPrefixSums(powerValues);

    const cumulativeEnergyBefore: number[] = new Array(powerValues.length).fill(0);
    let cumulative = 0;
    for (let index = 0; index < powerValues.length; index += 1) {
      cumulativeEnergyBefore[index] = cumulative;
      const power = powerValues[index] ?? 0;
      cumulative += power * intervalSeconds;
    }

    for (const effort of efforts) {
      const windowSize = Math.max(1, Math.round(effort.durationSec * sampleRate));
      if (windowSize > powerValues.length) {
        continue;
      }

      const fatigueJoules = effort.fatigueKj * 1000;
      let best: number | null = effort.value;
      let bestIndex = -1;

      for (let start = 0; start + windowSize <= powerValues.length; start += 1) {
        if (cumulativeEnergyBefore[start] < fatigueJoules) {
          continue;
        }
        const sum = sumWindow(prefix, start, start + windowSize);
        const avg = sum / windowSize;
        if (best == null || avg > best) {
          best = avg;
          bestIndex = start;
        }
      }

      if (best != null && bestIndex >= 0 && best > (effort.value ?? -Infinity)) {
        effort.value = roundNumber(best, 1);
        effort.activityId = activity.id;
        effort.startTime = activity.startTime.toISOString();
        effort.windowStartSec = Math.round(powerSamples[bestIndex]?.t ?? 0);
        if (ftpWatts && ftpWatts > 0) {
          const pct = (best / ftpWatts) * 100;
          effort.pctFtp = roundNumber(pct, 1);
        } else {
          effort.pctFtp = null;
        }

        const fresh = freshLookup.get(effort.durationSec);
        if (fresh != null) {
          effort.deltaWatts = roundNumber(best - fresh, 1);
          if (fresh > 0) {
            effort.deltaPct = roundNumber(((best - fresh) / fresh) * 100, 1);
          } else {
            effort.deltaPct = null;
          }
        }
      }
    }
  }

  return { efforts };
}

function computeEfficiencyFrontier(
  activities: ActivityWithSamples[],
  ftpWatts: number | null,
  hrRest: number | null,
  hrMax: number | null,
): EfficiencyFrontier {
  const windows: EfficiencyWindow[] = [];

  for (const activity of activities) {
    if (activity.samples.length === 0) {
      continue;
    }
    const metricSamples = toMetricSamples(activity.samples);
    const sampleRate = Math.max(1e-6, inferSampleRate(activity, metricSamples));

    const powerValues = metricSamples.map((sample) =>
      typeof sample.power === 'number' && Number.isFinite(sample.power) ? sample.power : 0,
    );
    const heartRateValues = metricSamples.map((sample) =>
      typeof sample.heartRate === 'number' && Number.isFinite(sample.heartRate) ? sample.heartRate : null,
    );
    const cadenceValues = metricSamples.map((sample) =>
      typeof sample.cadence === 'number' && Number.isFinite(sample.cadence) ? sample.cadence : null,
    );
    const speedValues = metricSamples.map((sample) =>
      typeof sample.speed === 'number' && Number.isFinite(sample.speed) ? sample.speed : null,
    );

    const prefixPower = computePowerPrefixSums(powerValues);

    for (const durationSec of EFFICIENCY_DURATIONS_SECONDS) {
      const windowSize = Math.max(1, Math.round(durationSec * sampleRate));
      if (windowSize > powerValues.length) {
        continue;
      }

      const results: EfficiencyWindow[] = [];

      for (let start = 0; start + windowSize <= powerValues.length; start += 1) {
        const end = start + windowSize;
        const cadenceSamples = cadenceValues.slice(start, end);
        const cadenceValidCount = cadenceSamples.filter((value) => (value ?? 0) > CADENCE_VALID_THRESHOLD).length;
        const cadenceCoverage = cadenceValidCount / windowSize;
        if (cadenceCoverage < CADENCE_COVERAGE_MIN) {
          continue;
        }

        const speedSamples = speedValues.slice(start, end);
        const movingSamples = speedSamples.filter((value) => (value ?? 0) > MOVING_SPEED_THRESHOLD).length;
        const movingCoverage = movingSamples / windowSize;
        if (movingCoverage < MOVING_COVERAGE_MIN) {
          continue;
        }

        const hrSamples = heartRateValues.slice(start, end);
        const hrValidSamples = hrSamples.filter((value): value is number => value != null);
        const hrCoverage = hrValidSamples.length / windowSize;
        if (hrCoverage < HEART_RATE_COVERAGE_MIN) {
          continue;
        }

        const powerSum = sumWindow(prefixPower, start, end);
        const avgPower = powerSum / windowSize;
        const avgHr = hrValidSamples.reduce((sum, value) => sum + value, 0) / hrValidSamples.length;
        const wattsPerBpm = avgHr > 0 ? avgPower / avgHr : null;
        const hrReservePct = computeHeartRateReservePercent(avgHr, hrRest, hrMax);
        const wattsPerHrr = hrReservePct != null && hrReservePct > 0 ? avgPower / hrReservePct : null;

        results.push({
          durationSec,
          value: avgPower != null ? roundNumber(avgPower, 1) : null,
          pctFtp: ftpWatts && ftpWatts > 0 ? roundNumber((avgPower / ftpWatts) * 100, 1) : null,
          activityId: activity.id,
          startTime: activity.startTime.toISOString(),
          windowStartSec: Math.round(metricSamples[start]?.t ?? 0),
          averageWatts: avgPower != null ? roundNumber(avgPower, 1) : null,
          averageHeartRate: roundNumber(avgHr, 0),
          wattsPerBpm: wattsPerBpm != null ? roundNumber(wattsPerBpm, 2) : null,
          wattsPerHeartRateReserve: wattsPerHrr != null ? roundNumber(wattsPerHrr, 2) : null,
          cadenceCoverage: roundNumber(cadenceCoverage * 100, 1) ?? 0,
          movingCoverage: roundNumber(movingCoverage * 100, 1) ?? 0,
        });
      }

      results
        .sort((a, b) => (b.wattsPerBpm ?? 0) - (a.wattsPerBpm ?? 0))
        .slice(0, EFFICIENCY_MAX_RESULTS)
        .forEach((result) => windows.push(result));
    }
  }

  windows.sort((a, b) => {
    if (a.durationSec !== b.durationSec) {
      return a.durationSec - b.durationSec;
    }
    return (b.wattsPerBpm ?? 0) - (a.wattsPerBpm ?? 0);
  });

  return { windows };
}

function linearRegressionSlope(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length === 0) {
    return 0;
  }
  const n = xs.length;
  const sumX = xs.reduce((sum, x) => sum + x, 0);
  const sumY = ys.reduce((sum, y) => sum + y, 0);
  const sumXY = xs.reduce((sum, x, index) => sum + x * ys[index]!, 0);
  const sumX2 = xs.reduce((sum, x) => sum + x * x, 0);
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return 0;
  }
  return (n * sumXY - sumX * sumY) / denominator;
}

function computeRepeatabilityFrontier(
  activities: ActivityWithSamples[],
  ftpWatts: number | null,
): RepeatabilityFrontier {
  const sequences: RepeatabilitySequence[] = [];
  const bestRepeatability: Array<{
    targetKey: string;
    reps: number;
    activityId: string | null;
    startTime: string | null;
    startSec: number | null;
  }> = REPEATABILITY_TARGETS.map((target) => ({
    targetKey: target.key,
    reps: 0,
    activityId: null,
    startTime: null,
    startSec: null,
  }));

  if (!ftpWatts || ftpWatts <= 0) {
    return { sequences, bestRepeatability };
  }

  for (const activity of activities) {
    if (activity.samples.length === 0) {
      continue;
    }
    const metricSamples = toMetricSamples(activity.samples);
    const sampleRate = Math.max(1e-6, inferSampleRate(activity, metricSamples));
    const powerValues = metricSamples.map((sample) =>
      typeof sample.power === 'number' && Number.isFinite(sample.power) ? sample.power : 0,
    );

    for (const target of REPEATABILITY_TARGETS) {
      const intervals: RepeatabilityInterval[] = [];
      let inInterval = false;
      let startIndex = 0;
      let sumPower = 0;

      for (let index = 0; index < powerValues.length; index += 1) {
        const pct = (powerValues[index]! / ftpWatts) * 100;
        const within = pct >= target.minPct && pct <= target.maxPct;
        if (within && !inInterval) {
          inInterval = true;
          startIndex = index;
          sumPower = 0;
        }

        if (inInterval) {
          sumPower += powerValues[index]!;
        }

        if (!within && inInterval) {
          const endIndex = index;
          const durationSamples = endIndex - startIndex;
          const durationSec = durationSamples / sampleRate;
          if (durationSec >= target.minDuration && durationSec <= target.maxDuration) {
            const avg = sumPower / durationSamples;
            intervals.push({
              activityId: activity.id,
              startTime: activity.startTime.toISOString(),
              startSec: Math.round(metricSamples[startIndex]?.t ?? 0),
              endSec: Math.round(metricSamples[endIndex - 1]?.t ?? 0),
              durationSec,
              avgWatts: avg,
              avgPctFtp: (avg / ftpWatts) * 100,
            });
          }
          inInterval = false;
        }
      }

      if (inInterval) {
        const endIndex = powerValues.length;
        const durationSamples = endIndex - startIndex;
        const durationSec = durationSamples / sampleRate;
        if (durationSec >= target.minDuration && durationSec <= target.maxDuration) {
          const avg = sumPower / durationSamples;
          intervals.push({
            activityId: activity.id,
            startTime: activity.startTime.toISOString(),
            startSec: Math.round(metricSamples[startIndex]?.t ?? 0),
            endSec: Math.round(metricSamples[endIndex - 1]?.t ?? 0),
            durationSec,
            avgWatts: avg,
            avgPctFtp: (avg / ftpWatts) * 100,
          });
        }
      }

      if (intervals.length < MIN_INTERVAL_COUNT) {
        continue;
      }

      intervals.sort((a, b) => a.startSec - b.startSec);

      let cursor = 0;
      while (cursor < intervals.length) {
        const sequence: RepeatabilitySequence = {
          targetKey: target.key,
          activityId: intervals[cursor]!.activityId,
          startTime: intervals[cursor]!.startTime,
          startSec: intervals[cursor]!.startSec,
          reps: 0,
          avgWattsByRep: [],
          avgPctByRep: [],
          decaySlope: 0,
          dropFromFirstToLast: 0,
        };

        let index = cursor;
        while (index < intervals.length) {
          const current = intervals[index]!;
          if (sequence.reps === 0) {
            sequence.avgWattsByRep.push(roundNumber(current.avgWatts, 1) ?? 0);
            sequence.avgPctByRep.push(roundNumber(current.avgPctFtp, 1) ?? 0);
            sequence.reps += 1;
            index += 1;
            continue;
          }

          const previous = intervals[index - 1]!;
          const rest = current.startSec - previous.endSec;
          const previousDuration = previous.durationSec;
          if (rest < previousDuration * REST_MIN_RATIO || rest > previousDuration * REST_MAX_RATIO) {
            break;
          }

          sequence.avgWattsByRep.push(roundNumber(current.avgWatts, 1) ?? 0);
          sequence.avgPctByRep.push(roundNumber(current.avgPctFtp, 1) ?? 0);
          sequence.reps += 1;
          index += 1;
        }

        if (sequence.reps >= MIN_INTERVAL_COUNT) {
          const xs = sequence.avgPctByRep.map((_, idx) => idx + 1);
          const slope = linearRegressionSlope(xs, sequence.avgPctByRep);
          const first = sequence.avgPctByRep[0]!;
          const last = sequence.avgPctByRep[sequence.avgPctByRep.length - 1]!;
          sequence.decaySlope = roundNumber(slope, 3) ?? 0;
          sequence.dropFromFirstToLast = roundNumber(last - first, 1) ?? 0;
          sequences.push(sequence);

          const repeatabilityRecord = bestRepeatability.find((entry) => entry.targetKey === target.key)!;
          let repsBeforeDrop = 0;
          for (const pct of sequence.avgPctByRep) {
            if (pct >= first - 10) {
              repsBeforeDrop += 1;
            } else {
              break;
            }
          }
          if (repsBeforeDrop > repeatabilityRecord.reps) {
            repeatabilityRecord.reps = repsBeforeDrop;
            repeatabilityRecord.activityId = sequence.activityId;
            repeatabilityRecord.startTime = sequence.startTime;
            repeatabilityRecord.startSec = sequence.startSec;
          }
        }

        cursor = Math.max(cursor + 1, index);
      }
    }
  }

  sequences.sort((a, b) => {
    if (a.targetKey !== b.targetKey) {
      return a.targetKey.localeCompare(b.targetKey);
    }
    if (a.decaySlope !== b.decaySlope) {
      return a.decaySlope - b.decaySlope;
    }
    return b.reps - a.reps;
  });

  return { sequences, bestRepeatability };
}

function computeTimeInZoneFrontier(
  activities: ActivityWithSamples[],
  ftpWatts: number | null,
  zones: ZoneDefinition[],
): TimeInZoneFrontier {
  const streaks: ZoneStreakSummary[] = zones.map((zone) => ({
    zoneKey: zone.key,
    label: zone.label,
    minPct: zone.minPct,
    maxPct: zone.maxPct,
    durationSec: 0,
    activityId: null,
    startTime: null,
    windowStartSec: null,
    value: null,
    averageWatts: null,
    averageHeartRate: null,
  }));

  if (!ftpWatts || ftpWatts <= 0) {
    return { streaks };
  }

  for (const activity of activities) {
    if (activity.samples.length === 0) {
      continue;
    }
    const metricSamples = toMetricSamples(activity.samples);
    const powerSamples = extractPowerSamples(metricSamples);
    if (powerSamples.length === 0) {
      continue;
    }

    const sampleRate = Math.max(1, Math.round(inferSampleRate(activity, metricSamples)));
    const windowSize = Math.max(1, Math.round(ROLLING_AVG_WINDOW_SECONDS * sampleRate));
    const rolling = computeRollingAverages(powerSamples, windowSize);
    if (rolling.length === 0) {
      continue;
    }

    const aligned: Array<{
      index: number;
      t: number;
      rollingPower: number;
      heartRate: number | null;
    }> = [];
    const offset = powerSamples.length - rolling.length;
    for (let index = 0; index < rolling.length; index += 1) {
      const sampleIndex = index + offset;
      const sample = metricSamples[sampleIndex];
      if (!sample) {
        continue;
      }
      aligned.push({
        index: sampleIndex,
        t: sample.t,
        rollingPower: rolling[index]!.rollingAvg,
        heartRate: sample.heartRate,
      });
    }

    for (const zone of zones) {
      const zoneIndex = streaks.findIndex((entry) => entry.zoneKey === zone.key);
      if (zoneIndex < 0) {
        continue;
      }

      const minWatts = (zone.minPct / 100) * ftpWatts;
      const maxWatts = zone.maxPct != null ? (zone.maxPct / 100) * ftpWatts : Infinity;

      let start = 0;
      while (start < aligned.length) {
        let total = 0;
        let outOfZone = 0;
        let end = start;
        let powerSum = 0;
        const heartRates: number[] = [];

        while (end < aligned.length) {
          const current = aligned[end]!;
          total += 1;
          powerSum += current.rollingPower;
          if (current.heartRate != null) {
            heartRates.push(current.heartRate);
          }
          if (current.rollingPower < minWatts || current.rollingPower > maxWatts) {
            outOfZone += 1;
          }
          if (outOfZone / total > TIME_IN_ZONE_TOLERANCE) {
            outOfZone -= 1;
            powerSum -= current.rollingPower;
            if (current.heartRate != null) {
              heartRates.pop();
            }
            break;
          }
          end += 1;
        }

        const durationSamples = end - start;
        if (durationSamples > 0) {
          const durationSec = durationSamples / sampleRate;
          const existing = streaks[zoneIndex]!;
          if (durationSec > existing.durationSec) {
            const avgWatts = powerSum / durationSamples;
            const avgHr = heartRates.length > 0
              ? heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length
              : null;

            existing.durationSec = durationSec;
            existing.activityId = activity.id;
            existing.startTime = activity.startTime.toISOString();
            existing.windowStartSec = Math.round(aligned[start]!.t);
            existing.averageWatts = roundNumber(avgWatts, 1);
            existing.averageHeartRate = roundNumber(avgHr, 0);
            existing.value = roundNumber(durationSec / 60, 1);
          }
        }

        start = Math.max(start + 1, end || start + 1);
      }
    }
  }

  return { streaks };
}

function clampWindowDays(windowDays?: number): number {
  if (!windowDays || !Number.isFinite(windowDays)) {
    return DEFAULT_WINDOW_DAYS;
  }
  const clamped = Math.max(1, Math.min(MAX_WINDOW_DAYS, Math.round(windowDays)));
  return clamped;
}

function computeWindowStart(windowDays: number): Date {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - windowDays);
  return start;
}

async function loadActivities(userId: string, windowDays: number): Promise<ActivityWithSamples[]> {
  const windowStart = computeWindowStart(windowDays);
  const activities = await prisma.activity.findMany({
    where: {
      userId,
      startTime: {
        gte: windowStart,
      },
    },
    orderBy: { startTime: 'desc' },
    include: {
      samples: {
        orderBy: { t: 'asc' },
        select: {
          t: true,
          power: true,
          heartRate: true,
          cadence: true,
          speed: true,
        },
      },
    },
  });

  return activities as ActivityWithSamples[];
}

async function loadProfile(userId: string) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    return {
      ftpWatts: null,
      weightKg: null,
      hrMaxBpm: null,
      hrRestBpm: null,
    };
  }

  return {
    ftpWatts: profile.ftpWatts ?? null,
    weightKg: profile.weightKg ?? null,
    hrMaxBpm: profile.hrMaxBpm ?? null,
    hrRestBpm: profile.hrRestBpm ?? null,
  };
}

export async function getTrainingFrontiers(
  userId: string,
  windowDays?: number,
): Promise<TrainingFrontiersResponse> {
  const clampedWindow = clampWindowDays(windowDays);
  const activities = await loadActivities(userId, clampedWindow);
  const profile = await loadProfile(userId);

  const durationPower = computeDurationPowerFrontier(activities, profile.ftpWatts);

  const durability = computeDurabilityFrontier(activities, profile.ftpWatts, durationPower.durations);
  const efficiency = computeEfficiencyFrontier(
    activities,
    profile.ftpWatts,
    profile.hrRestBpm,
    profile.hrMaxBpm,
  );
  const repeatability = computeRepeatabilityFrontier(activities, profile.ftpWatts);
  const zones = defaultZones();
  const timeInZone = computeTimeInZoneFrontier(activities, profile.ftpWatts, zones);

  const response = {
    windowDays: clampedWindow,
    ftpWatts: profile.ftpWatts,
    weightKg: profile.weightKg ?? null,
    hrMaxBpm: profile.hrMaxBpm ?? null,
    hrRestBpm: profile.hrRestBpm ?? null,
    durationPower,
    durability,
    efficiency,
    repeatability,
    timeInZone,
  };

  await mergeProfileAnalytics(userId, { trainingFrontiers: summarizeTrainingFrontiers(response) });

  return response;
}
