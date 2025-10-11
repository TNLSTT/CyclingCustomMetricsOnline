import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { runMetrics } from '../metrics/runner.js';
import { parseFitFile } from '../parsers/fit.js';
import { saveActivity } from '../services/activityService.js';

const SALT_ROUNDS = 10;

const stringOrNull = z.union([z.string(), z.null()]);
const numberOrNull = z.union([z.number(), z.null()]);

const criticalEffortSchema = z
  .object({
    durationMinutes: numberOrNull.optional(),
    powerWatts: numberOrNull.optional(),
  })
  .partial();

const eventSchema = z
  .object({
    id: stringOrNull.optional(),
    name: stringOrNull.optional(),
    date: stringOrNull.optional(),
    durationHours: numberOrNull.optional(),
    distanceKm: numberOrNull.optional(),
    criticalEffort: criticalEffortSchema.optional(),
    targetAveragePowerWatts: numberOrNull.optional(),
    notes: stringOrNull.optional(),
  })
  .partial();

const activitySchema = z.object({
  file: z.string().min(1, 'Activity file path is required'),
  label: z.string().optional(),
  computeMetrics: z.boolean().optional(),
  uploadCopy: z.boolean().optional(),
});

const profileSchema = z
  .object({
    displayName: stringOrNull.optional(),
    avatarUrl: stringOrNull.optional(),
    bio: stringOrNull.optional(),
    location: stringOrNull.optional(),
    primaryDiscipline: stringOrNull.optional(),
    trainingFocus: stringOrNull.optional(),
    weeklyGoalHours: numberOrNull.optional(),
    ftpWatts: numberOrNull.optional(),
    weightKg: numberOrNull.optional(),
    hrMaxBpm: numberOrNull.optional(),
    hrRestBpm: numberOrNull.optional(),
    websiteUrl: stringOrNull.optional(),
    instagramHandle: stringOrNull.optional(),
    achievements: stringOrNull.optional(),
    events: z.array(eventSchema).optional(),
    goals: z.array(eventSchema).optional(),
    strengths: stringOrNull.optional(),
    weaknesses: stringOrNull.optional(),
  })
  .partial();

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'USER']).optional(),
  provider: z.string().optional(),
  utmSource: z.string().optional(),
  profile: profileSchema.optional(),
  activities: z.array(activitySchema).optional(),
});

const configSchema = z.object({
  users: z.array(userSchema).min(1, 'At least one user is required'),
  defaults: z
    .object({
      computeMetrics: z.boolean().optional(),
      uploadCopy: z.boolean().optional(),
    })
    .optional(),
});

type DemoConfig = z.infer<typeof configSchema>;
type DemoUser = z.infer<typeof userSchema>;
type DemoActivity = z.infer<typeof activitySchema>;
type ProfileConfig = NonNullable<DemoUser['profile']>;

type ProfileData = {
  displayName?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  primaryDiscipline?: string | null;
  trainingFocus?: string | null;
  weeklyGoalHours?: number | null;
  ftpWatts?: number | null;
  weightKg?: number | null;
  hrMaxBpm?: number | null;
  hrRestBpm?: number | null;
  websiteUrl?: string | null;
  instagramHandle?: string | null;
  achievements?: string | null;
  events?: ProfileEventData[];
  goals?: ProfileEventData[];
  strengths?: string | null;
  weaknesses?: string | null;
};

type ProfileEventConfig = z.infer<typeof eventSchema>;

type ProfileEventData = {
  id: string;
  name: string;
  date: string | null;
  durationHours: number | null;
  distanceKm: number | null;
  criticalEffort:
    | {
        durationMinutes: number | null;
        powerWatts: number | null;
      }
    | null;
  targetAveragePowerWatts: number | null;
  notes: string | null;
};

function resolveConfigPath(): { configPath: string; baseDir: string } {
  const rawPath = process.argv[2] ?? 'demo/demo-data.json';
  const configPath = path.resolve(process.cwd(), rawPath);
  const baseDir = path.dirname(configPath);
  return { configPath, baseDir };
}

async function loadConfig(configPath: string): Promise<DemoConfig> {
  const fileContents = await fs.readFile(configPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContents);
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${configPath}: ${(error as Error).message}`);
  }
  return configSchema.parse(parsed);
}

function normalizeString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function normalizeCriticalEffort(
  effort: ProfileEventConfig['criticalEffort'],
): ProfileEventData['criticalEffort'] {
  if (!effort) {
    return null;
  }

  const duration = normalizeNumber(effort.durationMinutes);
  const power = normalizeNumber(effort.powerWatts);

  if (duration == null && power == null) {
    return null;
  }

  return {
    durationMinutes: duration,
    powerWatts: power,
  };
}

function normalizeEvent(event: ProfileEventConfig): ProfileEventData | null {
  const name = normalizeString(event.name);
  if (!name) {
    return null;
  }

  const id = normalizeString(event.id) ?? randomUUID();
  const date = normalizeString(event.date);
  const durationHours = normalizeNumber(event.durationHours);
  const distanceKm = normalizeNumber(event.distanceKm);
  const targetAveragePowerWatts = normalizeNumber(event.targetAveragePowerWatts);
  const notes = normalizeString(event.notes);

  return {
    id,
    name,
    date,
    durationHours,
    distanceKm,
    criticalEffort: normalizeCriticalEffort(event.criticalEffort),
    targetAveragePowerWatts,
    notes,
  } satisfies ProfileEventData;
}

function normalizeEventList(
  events: ProfileEventConfig[] | undefined,
): ProfileEventData[] | undefined {
  if (!events || events.length === 0) {
    return undefined;
  }

  const normalized = events
    .map((event) => normalizeEvent(event))
    .filter((event): event is ProfileEventData => event != null);

  return normalized.length > 0 ? normalized : undefined;
}

function mapProfileConfig(profile: ProfileConfig): ProfileData {
  return {
    displayName: normalizeString(profile.displayName),
    avatarUrl: normalizeString(profile.avatarUrl),
    bio: normalizeString(profile.bio),
    location: normalizeString(profile.location),
    primaryDiscipline: normalizeString(profile.primaryDiscipline),
    trainingFocus: normalizeString(profile.trainingFocus),
    weeklyGoalHours: normalizeNumber(profile.weeklyGoalHours),
    ftpWatts: normalizeNumber(profile.ftpWatts),
    weightKg: normalizeNumber(profile.weightKg),
    hrMaxBpm: normalizeNumber(profile.hrMaxBpm),
    hrRestBpm: normalizeNumber(profile.hrRestBpm),
    websiteUrl: normalizeString(profile.websiteUrl),
    instagramHandle: normalizeString(profile.instagramHandle),
    achievements: normalizeString(profile.achievements),
    events: normalizeEventList(profile.events),
    goals: normalizeEventList(profile.goals),
    strengths: normalizeString(profile.strengths),
    weaknesses: normalizeString(profile.weaknesses),
  } satisfies ProfileData;
}

async function upsertUser(userConfig: DemoUser) {
  const email = userConfig.email.toLowerCase();
  const passwordHash = await bcrypt.hash(userConfig.password, SALT_ROUNDS);
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash,
        provider: userConfig.provider ?? 'credentials',
        role: userConfig.role ?? 'USER',
        utmSource: userConfig.utmSource ?? 'demo-import',
        lastLoginAt: new Date(),
      },
      select: { id: true, email: true, role: true },
    });
    console.log(`Updated user ${updated.email} (${updated.role})`);
    return updated;
  }

  const created = await prisma.user.create({
    data: {
      email,
      passwordHash,
      provider: userConfig.provider ?? 'credentials',
      utmSource: userConfig.utmSource ?? 'demo-import',
      role: userConfig.role ?? 'USER',
      lastLoginAt: new Date(),
    },
    select: { id: true, email: true, role: true },
  });
  console.log(`Created user ${created.email} (${created.role})`);
  return created;
}

async function upsertProfile(userId: string, profile: ProfileConfig | undefined) {
  if (!profile) {
    return;
  }

  const profileData = mapProfileConfig(profile);
  const hasValues = Object.values(profileData).some((value) => value != null);
  if (!hasValues) {
    return;
  }

  await prisma.profile.upsert({
    where: { userId },
    update: profileData,
    create: {
      ...profileData,
      user: { connect: { id: userId } },
    },
  });
  console.log(`  • Synced profile for user ${userId}`);
}

function sanitizeUploadName(fileName: string) {
  const base = path.basename(fileName).toLowerCase();
  const safeBase = base.replace(/[^a-z0-9_.-]+/g, '-');
  return `${Date.now()}-${safeBase}`;
}

async function copyFitFileIfRequested(sourcePath: string, shouldCopy: boolean) {
  if (!shouldCopy) {
    return null;
  }
  const uploadDir = path.resolve(env.UPLOAD_DIR);
  await fs.mkdir(uploadDir, { recursive: true });
  const destinationName = sanitizeUploadName(sourcePath);
  const destinationPath = path.join(uploadDir, destinationName);
  await fs.copyFile(sourcePath, destinationPath);
  return destinationPath;
}

async function importActivity(
  userId: string,
  activity: DemoActivity,
  baseDir: string,
  defaults: Required<NonNullable<DemoConfig['defaults']>>,
) {
  const resolvedPath = path.resolve(baseDir, activity.file);
  try {
    await fs.access(resolvedPath);
  } catch {
    throw new Error(`Activity file not found: ${resolvedPath}`);
  }

  const normalized = await parseFitFile(resolvedPath);

  const duplicate = await prisma.activity.findFirst({
    where: {
      userId,
      startTime: normalized.startTime,
      durationSec: normalized.durationSec,
    },
    select: { id: true },
  });

  if (duplicate) {
    console.log(
      `  • Skipped ${activity.label ?? path.basename(activity.file)} (duplicate activity ${duplicate.id})`,
    );
    return;
  }

  const saved = await saveActivity(normalized, userId);
  console.log(`  • Imported activity ${saved.id} from ${activity.label ?? activity.file}`);

  const shouldCopy = activity.uploadCopy ?? defaults.uploadCopy;
  const copiedPath = await copyFitFileIfRequested(resolvedPath, shouldCopy);
  if (copiedPath) {
    console.log(`    ↳ Copied FIT to ${copiedPath}`);
  }

  const shouldComputeMetrics = activity.computeMetrics ?? defaults.computeMetrics;
  if (shouldComputeMetrics) {
    await runMetrics(saved.id);
    console.log(`    ↳ Computed metrics for ${saved.id}`);
  }
}

async function main() {
  const { configPath, baseDir } = resolveConfigPath();
  console.log(`Loading demo data from ${configPath}`);

  const config = await loadConfig(configPath);
  const defaults = {
    computeMetrics: config.defaults?.computeMetrics ?? true,
    uploadCopy: config.defaults?.uploadCopy ?? true,
  } satisfies Required<NonNullable<DemoConfig['defaults']>>;

  let failureCount = 0;

  for (const userConfig of config.users) {
    try {
      const user = await upsertUser(userConfig);
      await upsertProfile(user.id, userConfig.profile);

      const activities = userConfig.activities ?? [];
      for (const activity of activities) {
        try {
          await importActivity(user.id, activity, baseDir, defaults);
        } catch (error) {
          failureCount += 1;
          console.error(
            `  • Failed to import activity ${activity.label ?? activity.file} for ${user.email}:`,
            error,
          );
        }
      }
    } catch (error) {
      failureCount += 1;
      console.error(`Failed to provision user ${userConfig.email}:`, error);
    }
  }

  if (failureCount > 0) {
    console.error(`Import completed with ${failureCount} failure(s).`);
    process.exitCode = 1;
  } else {
    console.log('Import completed successfully.');
  }
}

void main()
  .catch((error) => {
    console.error('Unexpected error while importing demo data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
