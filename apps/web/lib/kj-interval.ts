import type { PowerStreamSample } from '../types/activity';

export interface ZoneSettings {
  id: string;
  label: string;
  minWatts: number;
  maxWatts: number;
  minDurationSeconds: number;
  overshootRatio: number;
  overshootTolerance: number;
}

export interface KjIntervalDetail {
  zoneId: string;
  zoneLabel: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  energyKj: number;
  overshootFraction: number;
}

export interface KjZoneSummary {
  zoneId: string;
  zoneLabel: string;
  totalDurationSec: number;
  totalEnergyKj: number;
  intervalCount: number;
  intervals: KjIntervalDetail[];
}

interface ZoneState {
  active: boolean;
  startSec: number;
  endSec: number;
  inZoneDurationSec: number;
  inZoneEnergyJ: number;
  overshootTimeSec: number;
  totalTimeSec: number;
}

function createInitialState(): ZoneState {
  return {
    active: false,
    startSec: 0,
    endSec: 0,
    inZoneDurationSec: 0,
    inZoneEnergyJ: 0,
    overshootTimeSec: 0,
    totalTimeSec: 0,
  };
}

function normalizeDeltaTime(delta: number, fallback: number): number {
  if (!Number.isFinite(delta) || delta <= 0) {
    return fallback > 0 && Number.isFinite(fallback) ? fallback : 1;
  }
  const clamped = Math.min(Math.max(delta, 0.25), 30);
  return clamped;
}

function finalizeZone(
  index: number,
  zones: ZoneSettings[],
  summaries: KjZoneSummary[],
  states: ZoneState[],
) {
  const state = states[index];
  if (!state.active) {
    return;
  }

  const zone = zones[index];
  const summary = summaries[index];
  const meetsDuration = state.inZoneDurationSec >= zone.minDurationSeconds;
  const overshootFraction =
    state.totalTimeSec > 0 ? state.overshootTimeSec / state.totalTimeSec : 0;

  if (meetsDuration && overshootFraction <= zone.overshootTolerance) {
    const energyKj = state.inZoneEnergyJ / 1000;
    summary.totalDurationSec += state.inZoneDurationSec;
    summary.totalEnergyKj += energyKj;
    summary.intervalCount += 1;
    summary.intervals.push({
      zoneId: zone.id,
      zoneLabel: zone.label,
      startSec: state.startSec,
      endSec: state.endSec,
      durationSec: state.inZoneDurationSec,
      energyKj,
      overshootFraction,
    });
  }

  states[index] = createInitialState();
}

export function computeKjIntervalSummaries(
  samples: PowerStreamSample[],
  zoneSettings: ZoneSettings[],
): KjZoneSummary[] {
  if (zoneSettings.length === 0) {
    return [];
  }

  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const summaries: KjZoneSummary[] = zoneSettings.map((zone) => ({
    zoneId: zone.id,
    zoneLabel: zone.label,
    totalDurationSec: 0,
    totalEnergyKj: 0,
    intervalCount: 0,
    intervals: [],
  }));
  const states = zoneSettings.map(() => createInitialState());

  let previousDelta = 1;

  for (let index = 0; index < sorted.length; index += 1) {
    const sample = sorted[index];
    const next = sorted[index + 1];
    const delta = next ? next.t - sample.t : previousDelta;
    const dt = normalizeDeltaTime(delta, previousDelta);
    previousDelta = dt;

    const power =
      typeof sample.power === 'number' && Number.isFinite(sample.power)
        ? sample.power
        : null;

    for (let zoneIndex = 0; zoneIndex < zoneSettings.length; zoneIndex += 1) {
      const zone = zoneSettings[zoneIndex];
      const summary = summaries[zoneIndex];
      const state = states[zoneIndex];

      const min = Math.max(0, Math.min(zone.minWatts, zone.maxWatts));
      const max = Math.max(zone.minWatts, zone.maxWatts);

      if (max <= 0) {
        if (state.active) {
          finalizeZone(zoneIndex, zoneSettings, summaries, states);
        }
        continue;
      }

      if (!state.active) {
        if (power == null) {
          continue;
        }
        if (power >= min && power <= max) {
          state.active = true;
          state.startSec = sample.t;
          state.endSec = sample.t + dt;
          state.inZoneDurationSec = dt;
          state.inZoneEnergyJ = power * dt;
          state.overshootTimeSec = 0;
          state.totalTimeSec = dt;
        }
        continue;
      }

      if (power == null) {
        finalizeZone(zoneIndex, zoneSettings, summaries, states);
        continue;
      }

      const overshootRatio = Math.max(1, zone.overshootRatio);
      const overshootLimit = max * overshootRatio;
      const inZone = power >= min && power <= max;
      const withinOvershoot = power > max && power <= overshootLimit;
      const beyondOvershoot = power > overshootLimit;
      const belowZone = power < min;

      if (belowZone || beyondOvershoot) {
        finalizeZone(zoneIndex, zoneSettings, summaries, states);
        continue;
      }

      state.totalTimeSec += dt;
      state.endSec = sample.t + dt;

      if (inZone) {
        state.inZoneDurationSec += dt;
        state.inZoneEnergyJ += power * dt;
      } else if (withinOvershoot) {
        state.overshootTimeSec += dt;
      }
    }
  }

  for (let zoneIndex = 0; zoneIndex < zoneSettings.length; zoneIndex += 1) {
    finalizeZone(zoneIndex, zoneSettings, summaries, states);
  }

  return summaries;
}

const DEFAULT_ZONE_TEMPLATES = [
  {
    id: 'z2',
    label: 'Zone 2',
    lowerPct: 0.56,
    upperPct: 0.75,
    minDurationSeconds: 20 * 60,
    overshootRatio: 1.5,
    overshootTolerancePercent: 10,
  },
  {
    id: 'tempo',
    label: 'Tempo',
    lowerPct: 0.76,
    upperPct: 0.9,
    minDurationSeconds: 15 * 60,
    overshootRatio: 1.5,
    overshootTolerancePercent: 0,
  },
  {
    id: 'threshold',
    label: 'Threshold',
    lowerPct: 0.91,
    upperPct: 1.05,
    minDurationSeconds: 10 * 60,
    overshootRatio: 1.5,
    overshootTolerancePercent: 0,
  },
  {
    id: 'vo2',
    label: 'VO2',
    lowerPct: 1.06,
    upperPct: 1.2,
    minDurationSeconds: 3 * 60,
    overshootRatio: 1.5,
    overshootTolerancePercent: 0,
  },
  {
    id: 'anaerobic',
    label: 'Anaerobic',
    lowerPct: 1.21,
    upperPct: 1.5,
    minDurationSeconds: 60,
    overshootRatio: 1.5,
    overshootTolerancePercent: 0,
  },
  {
    id: 'sprint',
    label: 'Sprint',
    lowerPct: 1.51,
    upperPct: 2,
    minDurationSeconds: 15,
    overshootRatio: 1.5,
    overshootTolerancePercent: 0,
  },
] as const;

export interface ZoneRecommendation {
  id: string;
  label: string;
  minWatts: number;
  maxWatts: number;
  minDurationSeconds: number;
  overshootRatio: number;
  overshootTolerancePercent: number;
}

const FTP_FALLBACK_WATTS = 250;

export function buildRecommendedZones(ftpEstimate: number | null): ZoneRecommendation[] {
  const ftp = ftpEstimate && ftpEstimate > 0 ? ftpEstimate : FTP_FALLBACK_WATTS;

  return DEFAULT_ZONE_TEMPLATES.map((template) => {
    const minWatts = Math.round(ftp * template.lowerPct);
    const maxWatts = Math.round(ftp * template.upperPct);
    return {
      id: template.id,
      label: template.label,
      minWatts,
      maxWatts,
      minDurationSeconds: template.minDurationSeconds,
      overshootRatio: template.overshootRatio,
      overshootTolerancePercent: template.overshootTolerancePercent,
    };
  });
}
