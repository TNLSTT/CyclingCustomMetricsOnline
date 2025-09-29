import { describe, expect, it } from 'vitest';

import { calculateDurabilityScore } from '../src/services/durabilityAnalysisService.js';

describe('calculateDurabilityScore', () => {
  it('penalizes late-ride power fade and heart-rate drift', () => {
    const score = calculateDurabilityScore(90, 75, 6, 95);
    // Drop of 15 percentage points -> 7.5 penalty, HR drift 6% -> 4.5 penalty
    expect(score).toBeLessThan(90);
    expect(score).toBeGreaterThan(0);
  });

  it('rewards strong late-ride efforts above FTP', () => {
    const score = calculateDurabilityScore(85, 90, -2, 110);
    // Negative drift should not penalize; late power above FTP should add bonus
    expect(score).toBeGreaterThan(100 - 5); // baseline drop bonus > penalty
    expect(score).toBeLessThanOrEqual(100);
  });

  it('clamps the score between 0 and 100', () => {
    const low = calculateDurabilityScore(120, 40, 30, 80);
    const high = calculateDurabilityScore(70, 140, -10, 150);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(low).toBeLessThanOrEqual(100);
    expect(high).toBeGreaterThanOrEqual(0);
    expect(high).toBeLessThanOrEqual(100);
  });
});
