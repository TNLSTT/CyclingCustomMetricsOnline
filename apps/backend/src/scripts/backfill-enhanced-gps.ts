import path from 'node:path';
import fs from 'node:fs/promises';

import type { Activity } from '@prisma/client';

import { parseFitFile } from '../parsers/fit.js';
import { prisma } from '../prisma.js';
import { env } from '../env.js';
import type { NormalizedActivity, NormalizedActivitySample } from '../types.js';

const UPDATE_CHUNK_SIZE = 200;
const START_TIME_TOLERANCE_MS = 5 * 60 * 1000;
const DURATION_TOLERANCE_SEC = 5;

type FitFileInfo = { name: string; filePath: string };

type NormalizedMatch = { normalized: NormalizedActivity; filePath: string };

type ActivityWithMissingGps = Pick<Activity, 'id' | 'startTime' | 'durationSec'>;

function formatTimestampBase(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}_${month}_${day}_${hour}_${minute}_${second}`;
}

function isMatchingActivity(
  activity: ActivityWithMissingGps,
  normalized: NormalizedActivity,
): boolean {
  const activityStartMs = new Date(activity.startTime).getTime();
  const normalizedStartMs = normalized.startTime.getTime();
  if (!Number.isFinite(activityStartMs) || !Number.isFinite(normalizedStartMs)) {
    return false;
  }

  const startDelta = Math.abs(activityStartMs - normalizedStartMs);
  if (startDelta > START_TIME_TOLERANCE_MS) {
    return false;
  }

  const durationDelta = Math.abs((normalized.durationSec ?? 0) - activity.durationSec);
  if (durationDelta > DURATION_TOLERANCE_SEC) {
    return false;
  }

  return true;
}

async function loadFitFiles(uploadDir: string): Promise<FitFileInfo[]> {
  const entries = await fs.readdir(uploadDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.fit'))
    .map((entry) => ({ name: entry.name, filePath: path.join(uploadDir, entry.name) }));
}

async function loadNormalized(
  filePath: string,
  cache: Map<string, NormalizedActivity>,
): Promise<NormalizedActivity> {
  const cached = cache.get(filePath);
  if (cached) {
    return cached;
  }

  const normalized = await parseFitFile(filePath);
  cache.set(filePath, normalized);
  return normalized;
}

async function findMatch(
  activity: ActivityWithMissingGps,
  fitFiles: FitFileInfo[],
  nameLookup: Map<string, string>,
  normalizedCache: Map<string, NormalizedActivity>,
): Promise<NormalizedMatch | null> {
  const startTime = new Date(activity.startTime);
  if (!Number.isFinite(startTime.getTime())) {
    return null;
  }

  const base = formatTimestampBase(startTime).toLowerCase();
  const candidateNames = [
    `${base}.fit`,
    `${base}.FIT`,
    `${base}.fit`.toLowerCase(),
    `${base}.fit`.toUpperCase(),
  ];

  for (const name of candidateNames) {
    const matchPath = nameLookup.get(name.toLowerCase());
    if (!matchPath) {
      continue;
    }

    const normalized = await loadNormalized(matchPath, normalizedCache);
    if (isMatchingActivity(activity, normalized)) {
      return { normalized, filePath: matchPath };
    }
  }

  const substringMatches = fitFiles.filter((file) => file.name.toLowerCase().includes(base));
  for (const file of substringMatches) {
    const normalized = await loadNormalized(file.filePath, normalizedCache);
    if (isMatchingActivity(activity, normalized)) {
      return { normalized, filePath: file.filePath };
    }
  }

  for (const file of fitFiles) {
    const normalized = await loadNormalized(file.filePath, normalizedCache);
    if (isMatchingActivity(activity, normalized)) {
      return { normalized, filePath: file.filePath };
    }
  }

  return null;
}

function chunkSamples<T>(samples: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < samples.length; index += size) {
    chunks.push(samples.slice(index, index + size));
  }
  return chunks;
}

function isGpsSample(sample: NormalizedActivitySample):
  sample is NormalizedActivitySample & { latitude: number; longitude: number } {
  return (
    typeof sample.latitude === 'number' &&
    Number.isFinite(sample.latitude) &&
    typeof sample.longitude === 'number' &&
    Number.isFinite(sample.longitude)
  );
}

async function applySamples(
  activityId: string,
  normalized: NormalizedActivity,
): Promise<number> {
  const gpsSamples = normalized.samples.filter(isGpsSample);
  if (gpsSamples.length === 0) {
    return 0;
  }

  let updated = 0;
  const chunks = chunkSamples(gpsSamples, UPDATE_CHUNK_SIZE);

  for (const chunk of chunks) {
    await prisma.$transaction(async (tx) => {
      for (const sample of chunk) {
        if (typeof sample.t !== 'number') {
          continue;
        }

        const updateResult = await tx.activitySample.updateMany({
          where: { activityId, t: sample.t },
          data: { latitude: sample.latitude, longitude: sample.longitude },
        });

        if (updateResult.count > 0) {
          updated += updateResult.count;
          continue;
        }

        await tx.activitySample.create({
          data: {
            activityId,
            t: sample.t,
            heartRate: sample.heartRate ?? null,
            cadence: sample.cadence ?? null,
            power: sample.power ?? null,
            speed: sample.speed ?? null,
            elevation: sample.elevation ?? null,
            temperature: sample.temperature ?? null,
            latitude: sample.latitude,
            longitude: sample.longitude,
          },
        });
        updated += 1;
      }
    });
  }

  return updated;
}

async function main() {
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  let fitFiles: FitFileInfo[] = [];
  try {
    fitFiles = await loadFitFiles(uploadDir);
  } catch (error) {
    console.error(`Failed to read upload directory at ${uploadDir}`, error);
    process.exitCode = 1;
    return;
  }

  if (fitFiles.length === 0) {
    console.log('No FIT files available for backfill.');
    return;
  }

  const activities = await prisma.activity.findMany({
    where: {
      samples: {
        none: {
          latitude: { not: null },
          longitude: { not: null },
        },
      },
    },
    orderBy: { startTime: 'asc' },
  });

  if (activities.length === 0) {
    console.log('No activities require GPS backfill.');
    return;
  }

  console.log(`Found ${activities.length} activities missing GPS samples.`);

  const nameLookup = new Map<string, string>();
  for (const file of fitFiles) {
    nameLookup.set(file.name.toLowerCase(), file.filePath);
  }

  const normalizedCache = new Map<string, NormalizedActivity>();

  for (let index = 0; index < activities.length; index += 1) {
    const activity = activities[index]!;
    const position = index + 1;

    try {
      const match = await findMatch(activity, fitFiles, nameLookup, normalizedCache);
      if (!match) {
        console.warn(
          `[${position}/${activities.length}] No matching FIT file found for activity ${activity.id}`,
        );
        continue;
      }

      const updatedCount = await applySamples(activity.id, match.normalized);
      if (updatedCount === 0) {
        console.log(
          `[${position}/${activities.length}] No GPS samples parsed for activity ${activity.id} from ${path.basename(match.filePath)}`,
        );
        continue;
      }

      console.log(
        `[${position}/${activities.length}] Updated ${updatedCount} samples for activity ${activity.id} from ${path.basename(match.filePath)}`,
      );
    } catch (error) {
      console.error(
        `[${position}/${activities.length}] Failed to backfill activity ${activity.id}`,
        error,
      );
    }
  }
}

void main()
  .catch((error) => {
    console.error('Backfill failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
