import { describe, expect, it } from 'vitest';

import { normalizeDateBoundary } from '../src/routes/durableTss.js';

describe('normalizeDateBoundary', () => {
  it('normalizes date-only start values to the beginning of the day in UTC', () => {
    const result = normalizeDateBoundary('2023-10-05', 'start');
    expect(result?.toISOString()).toBe('2023-10-05T00:00:00.000Z');
  });

  it('normalizes date-only end values to the end of the day in UTC', () => {
    const result = normalizeDateBoundary('2023-10-05', 'end');
    expect(result?.toISOString()).toBe('2023-10-05T23:59:59.999Z');
  });

  it('preserves explicit timestamps without modification', () => {
    const result = normalizeDateBoundary('2023-10-05T12:34:56.000Z', 'start');
    expect(result?.toISOString()).toBe('2023-10-05T12:34:56.000Z');
  });
});
