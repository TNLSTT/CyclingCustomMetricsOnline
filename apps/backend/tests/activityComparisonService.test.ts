import { describe, expect, it } from 'vitest';

import {
  computeAverages,
  computeProfiles,
  computeWPrimeBalance,
  downsample,
  percentile,
} from '../src/services/activityComparisonService.js';

describe('activityComparisonService helpers', () => {
  it('downsamples arrays while keeping last element', () => {
    const values = Array.from({ length: 10 }, (_, index) => index);
    const result = downsample(values, 3);
    expect(result.length).toBeLessThan(values.length);
    expect(result.at(-1)).toBe(values.at(-1));
  });

  it('computes percentile correctly', () => {
    const values = [100, 200, 300, 400, 500];
    expect(percentile(values, 0)).toBe(100);
    expect(percentile(values, 1)).toBe(500);
    expect(percentile(values, 0.5)).toBe(300);
  });

  it('computes averages from samples', () => {
    const samples = [
      { t: 0, power: 200, heartRate: 140, elevation: null, speed: null },
      { t: 1, power: 220, heartRate: 142, elevation: null, speed: null },
      { t: 2, power: null, heartRate: 144, elevation: null, speed: null },
    ];
    const { averagePower, averageHeartRate } = computeAverages(samples);
    expect(averagePower).toBeCloseTo(210);
    expect(averageHeartRate).toBeCloseTo(142);
  });

  it('builds climb and heart rate profiles with distance estimates', () => {
    const samples = [
      { t: 0, power: 200, heartRate: 140, elevation: 100, speed: 5 },
      { t: 10, power: 210, heartRate: 142, elevation: 102, speed: 5 },
      { t: 20, power: 220, heartRate: 144, elevation: 104, speed: 5 },
    ];
    const { heartPower, climb } = computeProfiles(samples);
    expect(heartPower.length).toBe(samples.length);
    expect(climb.length).toBe(samples.length);
    expect(climb.at(-1)?.distanceKm).toBeCloseTo(0.1, 2);
    expect(climb.at(-1)?.elevationM).toBeCloseTo(104);
  });

  it("models W' balance depletion and recovery", () => {
    const samples = [
      { t: 0, power: 250, heartRate: null, elevation: null, speed: null },
      { t: 60, power: 350, heartRate: null, elevation: null, speed: null },
      { t: 120, power: 150, heartRate: null, elevation: null, speed: null },
      { t: 180, power: 150, heartRate: null, elevation: null, speed: null },
    ];
    const cp = 250;
    const wPrimeCapacity = 15000;
    const series = computeWPrimeBalance(samples, cp, wPrimeCapacity);
    expect(series.length).toBe(samples.length);
    const depleted = series[1];
    const recovered = series.at(-1);
    expect(depleted?.balanceJ).toBeLessThan(wPrimeCapacity);
    expect(recovered?.balanceJ ?? 0).toBeGreaterThan(depleted?.balanceJ ?? 0);
  });
});
