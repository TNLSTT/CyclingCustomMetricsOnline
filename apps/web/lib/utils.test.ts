import { describe, expect, it } from 'vitest';

import { formatDuration } from './utils';

describe('formatDuration', () => {
  it('formats durations under a minute using seconds only', () => {
    expect(formatDuration(0)).toBe('0s');
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minute-level durations with padded seconds', () => {
    expect(formatDuration(60)).toBe('1m 00s');
    expect(formatDuration(61)).toBe('1m 01s');
    expect(formatDuration(125)).toBe('2m 05s');
  });

  it('formats hour-level durations with padded minutes and seconds', () => {
    expect(formatDuration(3600)).toBe('1h 00m 00s');
    expect(formatDuration(3661)).toBe('1h 01m 01s');
    expect(formatDuration(7322)).toBe('2h 02m 02s');
  });

  it('rounds fractional seconds and clamps negative values', () => {
    expect(formatDuration(90.7)).toBe('1m 31s');
    expect(formatDuration(-42)).toBe('0s');
  });
});
