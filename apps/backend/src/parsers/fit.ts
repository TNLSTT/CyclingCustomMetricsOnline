import { createReadStream } from 'node:fs';
import { isMainThread, parentPort, Worker } from 'node:worker_threads';

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
  position_lat?: number;
  position_long?: number;
  enhanced_latitude?: number;
  enhanced_longitude?: number;
};

type FitParserCallbackData = { records?: FitRecord[] };

type FitParserInstance = {
  parse: (
    fileBuffer: Buffer,
    callback: (error: unknown, data: FitParserCallbackData) => void,
  ) => void;
};

type FitParserConstructor = new (options: Record<string, unknown>) => FitParserInstance;

type FitWorkerRequest = {
  fileBuffer: ArrayBuffer;
  byteOffset: number;
  byteLength: number;
};

type FitWorkerResponse =
  | { result: NormalizedActivity; error?: undefined }
  | { result?: undefined; error: { message: string; stack?: string } };

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

function createParser() {
  return new FitParser({
    force: true,
    elapsedRecordField: true,
    speedUnit: 'm/s',
    lengthUnit: 'm',
  });
}

async function readFileToBuffer(filePath: string): Promise<Buffer> {
  const stream = createReadStream(filePath);
  const chunks: Buffer[] = [];
  let totalLength = 0;

  try {
    for await (const chunk of stream) {
      const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      chunks.push(chunkBuffer);
      totalLength += chunkBuffer.length;
    }
  } finally {
    stream.destroy();
  }

  return Buffer.concat(chunks, totalLength);
}

async function parseFitBuffer(fileBuffer: Buffer): Promise<{
  data: FitParserCallbackData;
  warnings: string[];
}> {
  const warnings: string[] = [];

  const parser = createParser();

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

function sanitizeFloat(
  value: unknown,
  min: number,
  max: number,
  fractionDigits = 3,
): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return Number.parseFloat(value.toFixed(fractionDigits));
}

function sanitizeCoordinate(value: unknown, min: number, max: number): number | null {
  return sanitizeFloat(value, min, max, 6);
}

const SEMICIRCLES_TO_DEGREES = 180 / 2 ** 31;
const SEMICIRCLE_THRESHOLD = 3.2e4;

function convertCoordinateValue(value: unknown): number | null {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }

  const needsConversion = Math.abs(value) > SEMICIRCLE_THRESHOLD;
  const degrees = needsConversion ? value * SEMICIRCLES_TO_DEGREES : value;

  return Number.isFinite(degrees) ? degrees : null;
}

function normalizeCoordinatePair(
  latitudeSource: unknown,
  longitudeSource: unknown,
): { latitude: number | null; longitude: number | null } {
  const latitudeDegrees = convertCoordinateValue(latitudeSource);
  const longitudeDegrees = convertCoordinateValue(longitudeSource);

  if (latitudeDegrees == null || longitudeDegrees == null) {
    return { latitude: null, longitude: null };
  }

  const latitude = sanitizeCoordinate(latitudeDegrees, -90, 90);
  const longitude = sanitizeCoordinate(longitudeDegrees, -180, 180);

  if (latitude == null || longitude == null) {
    return { latitude: null, longitude: null };
  }

  return { latitude, longitude };
}

function parseTimestamp(value: FitRecord['timestamp']): number | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
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
    latitude: sample.latitude ?? null,
    longitude: sample.longitude ?? null,
  };
}

async function normalizeFitBuffer(fileBuffer: Buffer): Promise<NormalizedActivity> {
  const { data } = await parseFitBuffer(fileBuffer);

  const timestampedRecords = (data.records ?? [])
    .map((record) => {
      const timestampMs = parseTimestamp(record.timestamp);
      if (timestampMs == null) {
        return null;
      }
      return { record, timestampMs };
    })
    .filter((value): value is { record: FitRecord; timestampMs: number } => value !== null);

  if (timestampedRecords.length === 0) {
    throw new Error('FIT file has no timestamped records.');
  }

  const droppedRecords = (data.records ?? []).length - timestampedRecords.length;
  if (droppedRecords > 0) {
    logger.warn(
      { droppedRecords },
      'Dropped FIT records with invalid timestamps during normalization',
    );
  }

  const sortedRecords = timestampedRecords.sort((a, b) => a.timestampMs - b.timestampMs);

  const startMs = sortedRecords[0]!.timestampMs;
  const startTime = new Date(startMs);

  const samplesBySecond = new Map<number, NormalizedActivitySample>();

  for (const { record, timestampMs } of sortedRecords) {
    const t = Math.max(0, Math.round((timestampMs - startMs) / 1000));
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
    const { latitude, longitude } = normalizeCoordinatePair(
      record.position_lat ?? record.enhanced_latitude,
      record.position_long ?? record.enhanced_longitude,
    );

    samplesBySecond.set(t, {
      t,
      heartRate,
      cadence,
      power,
      speed,
      elevation,
      temperature,
      latitude,
      longitude,
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
          latitude: null,
          longitude: null,
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

async function normalizeFitInWorker(fileBuffer: Buffer): Promise<NormalizedActivity> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./fit.ts', import.meta.url), { type: 'module' });

    let settled = false;

    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
    };

    const onMessage = (message: FitWorkerResponse) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      if (message.error) {
        const error = new Error(message.error.message);
        error.name = 'FitWorkerParseError';
        error.stack = message.error.stack;
        reject(error);
        return;
      }

      resolve(message.result);
    };

    const onError = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    const onExit = (code: number) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();

      if (code === 0) {
        reject(new Error('FIT parser worker exited without sending a result.'));
      } else {
        reject(new Error(`FIT parser worker exited with code ${code}.`));
      }
    };

    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.on('exit', onExit);

    worker.postMessage(
      {
        fileBuffer: fileBuffer.buffer,
        byteOffset: fileBuffer.byteOffset,
        byteLength: fileBuffer.byteLength,
      } as FitWorkerRequest,
      [fileBuffer.buffer],
    );
  });
}

export async function parseFitFile(filePath: string): Promise<NormalizedActivity> {
  const fileBuffer = await readFileToBuffer(filePath);

  if (!isMainThread) {
    return normalizeFitBuffer(fileBuffer);
  }

  try {
    return await normalizeFitInWorker(fileBuffer);
  } catch (error) {
    if (error instanceof Error && error.name === 'FitWorkerParseError') {
      throw error;
    }

    logger.warn(
      { err: error },
      'FIT parser worker failed, falling back to main-thread normalization',
    );

    const retryBuffer = await readFileToBuffer(filePath);
    return normalizeFitBuffer(retryBuffer);
  }
}

function serializeWorkerError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { message: 'Unknown error while parsing FIT file' };
}

if (!isMainThread && parentPort) {
  parentPort.once('message', async (message: FitWorkerRequest) => {
    try {
      const buffer = Buffer.from(message.fileBuffer, message.byteOffset, message.byteLength);
      const result = await normalizeFitBuffer(buffer);
      parentPort.postMessage({ result } satisfies FitWorkerResponse);
    } catch (error) {
      parentPort.postMessage({ error: serializeWorkerError(error) } satisfies FitWorkerResponse);
    }
  });
}
