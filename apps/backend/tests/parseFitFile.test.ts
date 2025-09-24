import { describe, expect, it, beforeEach, vi } from 'vitest';

import { parseFitFile } from '../src/parsers/fit.js';

let mockRecords: any[] = [];

vi.mock('fit-file-parser', () => {
  return {
    default: class FitParser {
      parse(_buffer: Buffer, callback: (error: unknown, data: any) => void) {
        callback(null, { records: mockRecords });
      }
    },
  };
});

const fixturePath = new URL('./fixtures/mock.fit', import.meta.url).pathname;

describe('parseFitFile', () => {
  beforeEach(() => {
    const base = new Date('2024-01-01T00:00:00Z');
    mockRecords = [
      {
        timestamp: base,
        heart_rate: 100,
        cadence: 80,
        power: 200,
        speed: 8,
        enhanced_altitude: 100,
      },
      {
        timestamp: new Date(base.getTime() + 1000),
        heart_rate: 102,
        cadence: 82,
        power: 210,
        speed: 8.2,
        enhanced_altitude: 101,
      },
      {
        timestamp: new Date(base.getTime() + 4000),
        heart_rate: 108,
        cadence: 90,
        power: 230,
        speed: 8.5,
        enhanced_altitude: 103,
      },
    ];
  });

  it('normalizes samples to a 1Hz grid with forward fill on small gaps', async () => {
    const activity = await parseFitFile(fixturePath);

    expect(activity.source).toBe('garmin-fit');
    expect(activity.samples).toHaveLength(5);
    expect(activity.samples[0].t).toBe(0);
    expect(activity.samples[4].t).toBe(4);
    expect(activity.samples[2].heartRate).toBe(activity.samples[1].heartRate);
    expect(activity.samples[3].heartRate).toBe(activity.samples[1].heartRate);
    expect(activity.durationSec).toBe(4);
  });
});
