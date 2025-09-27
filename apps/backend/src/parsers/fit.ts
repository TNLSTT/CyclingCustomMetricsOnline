import fs from 'node:fs/promises';

import FitParserPkg from 'fit-file-parser';

import type { NormalizedActivity, NormalizedActivitySample } from '../types.js';
import { logger } from '../logger.js';

type FitRecord = {
  timestamp?: Date | string;
  heart_rate?: number;
  cadence?: number;
  power?: number;
  speed?: number;
  enhanced_altitude?: number;
  altitude?: number;
  temperature?: number;
};

type FitParserCallbackData = { records?: FitRecord[] };

type FitParserInstance = {
  parse: (
    fileBuffer: Buffer,
    callback: (error: unknown, data: FitParserCallbackData) => void,
  ) => void;
};

type FitParserConstructor = new (options: Record<string, unknown>) => FitParserInstance;

function resolveFitParserConstructor(module: unknown): FitParserConstructor {
  if (typeof module === 'function') {
    return module as FitParserConstructor;
  }

  if (
    module &&
    typeof module === 'object' &&
    'default' in module &&
    typeof (module as { default: unknown }).default === 'function'
  ) {
    return (module as { default: FitParserConstructor }).default;
  }

  throw new TypeError('Invalid fit-file-parser export shape.');
}

const FitParser = resolveFitParserConstructor(FitParserPkg);

const parser = new FitParser({
  force: true,
  elapsedRecordField: true,
  speedUnit: 'm/s',
  lengthUnit: 'm',
});

async function parseFitBuffer(fileBuffer: Buffer): Promise<{
  data: FitParserCallbackData;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const data = await new Promise<FitParserCallbackData>((resolve, reject) => {
    parser.parse(fileBuffer, (error: unknown, parsed: FitParserCallbackData) => {
      if (error) {
        if (typeof error === 'string') {
          // fit-file-parser sometimes returns string errors that are effectively warnings
          warnings.push(error);
          return;
        }
        reject(error);
        return;
      }

      if (!parsed || typeof parsed !== 'object') {
        resolve({});
        return;
      }

      resolve(parsed);
    });
  });

  if (warnings.length > 0) {
    logger.debug({ warnings }, 'FIT parser reported warnings while ingesting file');
  }

  return { data, warnings };
}

function sanitizeInt(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return Math.round(value);
}

function sanitizeFloat(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return Number.parseFloat(value.toFixed(3));
}

function cloneSample(sample: NormalizedActivitySample, t: number): NormalizedActivitySample {
  return {
    t,
    heartRate: sample.heartRate ?? null,
    cadence: sample.cadence ?? null,
    power: sample.power ?? null,
    speed: sample.speed ?? null,
    elevation: sample.elevation ?? null,
    temperature: sample.temperature ?? null,
  };
}

export async function parseFitFile(filePath: string): Promise<NormalizedActivity> {
  const fileBuffer = await fs.readFile(filePath);

  const { data } = await parseFitBuffer(fileBuffer);

  const records = (data.records ?? []).filter((record) => record.timestamp);

  if (records.length === 0) {
    throw new Error('FIT file has no timestamped records.');
  }

  const sortedRecords = records.sort((a, b) => {
    const aTime = new Date(a.timestamp as Date | string).getTime();
    const bTime = new Date(b.timestamp as Date | string).getTime();
    return aTime - bTime;
  });

  const startTime = new Date(sortedRecords[0].timestamp as Date | string);
  const startMs = startTime.getTime();

  const samplesBySecond = new Map<number, NormalizedActivitySample>();

  for (const record of sortedRecords) {
    const timestamp = new Date(record.timestamp as Date | string).getTime();
    const t = Math.max(0, Math.round((timestamp - startMs) / 1000));
    const heartRate = sanitizeInt(record.heart_rate, 30, 240);
    const cadence = sanitizeInt(record.cadence, 0, 220);
    const power = sanitizeInt(record.power, 0, 2500);
    const speed = sanitizeFloat(record.speed, 0, 30);
    const elevation = sanitizeFloat(
      record.enhanced_altitude ?? record.altitude,
      -500,
      9000,
    );
    const temperature = sanitizeFloat(record.temperature, -60, 90);

    samplesBySecond.set(t, {
      t,
      heartRate,
      cadence,
      power,
      speed,
      elevation,
      temperature,
    });
  }

  const sortedTimes = Array.from(samplesBySecond.keys()).sort((a, b) => a - b);
  const lastTime = sortedTimes[sortedTimes.length - 1] ?? 0;

  const samples: NormalizedActivitySample[] = [];
  let pointer = 0;
  let previousSample: NormalizedActivitySample | null = null;

  for (let t = 0; t <= lastTime; t += 1) {
    if (sortedTimes[pointer] === t) {
      const sample = samplesBySecond.get(t)!;
      samples.push(sample);
      previousSample = sample;
      pointer += 1;
    } else {
      const nextKnown = sortedTimes[pointer] ?? Number.POSITIVE_INFINITY;
      if (previousSample && nextKnown - t <= 3) {
        samples.push(cloneSample(previousSample, t));
      } else {
        samples.push({
          t,
          heartRate: null,
          cadence: null,
          power: null,
          speed: null,
          elevation: null,
          temperature: null,
        });
      }
    }
  }

  const durationSec = lastTime;
  const sampleRateHz = samples.length > 0 && durationSec > 0 ? 1 : null;

  return {
    source: 'garmin-fit',
    startTime,
    durationSec,
    sampleRateHz,
    samples,
  };
}
