import { beforeEach, describe, expect, it, vi } from 'vitest';

import { parseFitFile } from '../src/parsers/fit.js';

let mockRecords: any[] = [];
let parserBehavior: ((callback: (error: unknown, data: any) => void) => void) | null = null;

vi.mock('fit-file-parser', () => {
  return {
    default: class FitParser {
      parse(_buffer: Buffer, callback: (error: unknown, data: any) => void) {
        if (parserBehavior) {
          parserBehavior(callback);
          return;
        }

        callback('File to small to be a FIT file', {});
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
        temperature: 25,
      },
      {
        timestamp: new Date(base.getTime() + 1000),
        heart_rate: 102,
        cadence: 82,
        power: 210,
        speed: 8.2,
        enhanced_altitude: 101,
        temperature: 25.5,
      },
      {
        timestamp: new Date(base.getTime() + 4000),
        heart_rate: 108,
        cadence: 90,
        power: 230,
        speed: 8.5,
        enhanced_altitude: 103,
        temperature: 26,
      },
    ];
    parserBehavior = null;
  });

  it('normalizes samples to a 1Hz grid with forward fill on small gaps', async () => {
    const activity = await parseFitFile(fixturePath);

    expect(activity.source).toBe('garmin-fit');
    expect(activity.samples).toHaveLength(5);
    expect(activity.samples[0].t).toBe(0);
    expect(activity.samples[4].t).toBe(4);
    expect(activity.samples[2].heartRate).toBe(activity.samples[1].heartRate);
    expect(activity.samples[3].heartRate).toBe(activity.samples[1].heartRate);
    expect(activity.samples[0].temperature).toBeCloseTo(25);
    expect(activity.samples[2].temperature).toBe(activity.samples[1].temperature);
    expect(activity.durationSec).toBe(4);
  });

  it('throws a friendly error when the parser returns no data object', async () => {
    parserBehavior = (callback) => {
      callback(null, undefined);
    };

    await expect(parseFitFile(fixturePath)).rejects.toThrow(
      'FIT file has no timestamped records.',
    );
  });

  it('skips records that have invalid timestamps instead of crashing', async () => {
    const base = new Date('2024-01-01T00:00:05Z');
    mockRecords = [
      {
        timestamp: base,
        heart_rate: 110,
      },
      {
        timestamp: 'not-a-real-date',
        heart_rate: 120,
      },
      {
        timestamp: new Date(base.getTime() + 2000).toISOString(),
        heart_rate: 130,
      },
    ];

    const activity = await parseFitFile(fixturePath);

    expect(activity.samples[0].heartRate).toBe(110);
    expect(activity.samples[2].heartRate).toBe(130);
    expect(activity.durationSec).toBe(2);
  });

  it('converts position fields expressed in semicircles', async () => {
    const base = new Date('2024-05-01T12:00:00Z');
    const targetLat = 47.6097;
    const targetLon = -122.3331;
    const semicircleFactor = 180 / 2 ** 31;
    const toSemicircles = (degrees: number) => Math.round(degrees / semicircleFactor);

    mockRecords = [
      {
        timestamp: base,
        position_lat: toSemicircles(targetLat),
        position_long: toSemicircles(targetLon),
      },
    ];

    const activity = await parseFitFile(fixturePath);

    expect(activity.samples[0].latitude).toBeCloseTo(targetLat, 6);
    expect(activity.samples[0].longitude).toBeCloseTo(targetLon, 6);
  });

  it('falls back to enhanced latitude/longitude expressed in degrees', async () => {
    const base = new Date('2024-05-01T12:05:00Z');
    const targetLat = 37.7749;
    const targetLon = -122.4194;

    mockRecords = [
      {
        timestamp: base,
        enhanced_latitude: targetLat,
        enhanced_longitude: targetLon,
      },
    ];

    const activity = await parseFitFile(fixturePath);

    expect(activity.samples[0].latitude).toBeCloseTo(targetLat, 6);
    expect(activity.samples[0].longitude).toBeCloseTo(targetLon, 6);
  });

  it('omits coordinates when either latitude or longitude is missing', async () => {
    const base = new Date('2024-05-01T12:10:00Z');

    mockRecords = [
      {
        timestamp: base,
        position_lat: 100,
        enhanced_longitude: -45.123456,
      },
    ];

    const activity = await parseFitFile(fixturePath);

    expect(activity.samples[0].latitude).toBeNull();
    expect(activity.samples[0].longitude).toBeNull();
  });
});
