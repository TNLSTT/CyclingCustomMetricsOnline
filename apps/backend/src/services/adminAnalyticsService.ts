import fs from 'node:fs/promises';
import path from 'node:path';

import type { Prisma } from '@prisma/client';

import { prisma } from '../prisma.js';
import { env } from '../env.js';

type DailyCount = {
  date: string;
  count: number;
};

type SignupSparkline = {
  daily: DailyCount[];
  average7d: number;
  average30d: number;
};

type SignupFunnelStep = {
  label: 'D0' | 'D1' | 'D7';
  count: number;
  conversion: number;
};

type SignupFunnel = {
  totalSignups: number;
  usersWithUpload: number;
  reachedWithin24h: number;
  reachedWithin7d: number;
  conversion24h: number;
  conversion7d: number;
  steps: SignupFunnelStep[];
};

type HistogramBucket = {
  label: string;
  count: number;
};

type SignupSource = {
  source: string;
  count: number;
  percentage: number;
};

type SignupAcquisition = {
  newSignups: SignupSparkline;
  signupToFirstUpload: SignupFunnel;
  timeToFirstValue: HistogramBucket[];
  signupsBySource: SignupSource[];
};

type ActiveUserPoint = {
  date: string;
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
};

type ActiveUserSummary = {
  current: {
    dau: number;
    wau: number;
    mau: number;
    stickiness: number;
  };
  series: ActiveUserPoint[];
};

type RetentionCohort = {
  cohort: string;
  size: number;
  retention: Array<{ label: string; value: number }>;
};

type ReturningUser = {
  userId: string;
  email: string;
  activeDays: number;
  activityCount: number;
};

type SessionSummary = {
  averageSessionsPerUser: number;
  medianSessionMinutes: number;
  totalSessions: number;
  windowDays: number;
};

type EngagementSummary = {
  activeUsers: ActiveUserSummary;
  retentionCohorts: RetentionCohort[];
  returningUsers: ReturningUser[];
  sessions: SessionSummary;
};

type UploadsPerDay = {
  date: string;
  success: number;
  failed: number;
};

type UploadsPerUser = {
  userId: string;
  email: string;
  success: number;
  failed: number;
};

type RecomputeUsage = {
  daily: Array<{ date: string; count: number; uniqueUsers: number }>;
  topUsers: Array<{ userId: string; email: string; count: number; lastRunAt: string | null }>;
};

type ActivityViewSummary = {
  activityId: string;
  title: string | null;
  owner: string;
  views: number;
  window: '7d' | '30d';
};

type MetricCoverageRow = {
  metricKey: string;
  metricName: string;
  coverage: number;
  totalActivities: number;
};

type UsageSummary = {
  uploadsPerDay: UploadsPerDay[];
  uploadsPerUser: UploadsPerUser[];
  recompute: RecomputeUsage;
  topActivities: ActivityViewSummary[];
  metricCoverage: MetricCoverageRow[];
};

type ParseFailureBreakdown = {
  errorCode: string;
  count: number;
  percentage: number;
};

type LatencySnapshot = {
  p50: number;
  p95: number;
  p99: number;
  series: Array<{ date: string; p95: number }>;
};

type RetrySummary = {
  retryRate: number;
  meanRetries: number;
  sampleSize: number;
};

type BadDataUser = {
  userId: string;
  email: string;
  failureRate: number;
  totalUploads: number;
};

type QualitySummary = {
  parseFailures: ParseFailureBreakdown[];
  latency: {
    upload: LatencySnapshot;
    recompute: LatencySnapshot;
  };
  retry: RetrySummary;
  badData: BadDataUser[];
};

type EndpointMetric = {
  path: string;
  method: string;
  avgDurationMs: number;
  avgQueryCount: number;
  avgQueryDurationMs: number;
  requestCount: number;
};

type StorageSummary = {
  uploadsDirBytes: number;
  postgresBytes: number | null;
  sevenDaySlopeBytesPerDay: number;
  dailyTotals: Array<{ date: string; bytes: number }>;
};

type RecomputeCostSummary = {
  totalMinutes: number;
  estimatedUsd: number;
  dailyMinutes: Array<{ date: string; minutes: number }>;
};

type PerformanceSummary = {
  db: EndpointMetric[];
  storage: StorageSummary;
  recomputeCost: RecomputeCostSummary;
};

type DeviceShare = {
  device: string;
  count: number;
  percentage: number;
  window: '7d' | '30d';
};

type UserSegment = {
  label: string;
  count: number;
  centroid: { uploads: number; views: number; recomputes: number };
  sample: Array<{ userId: string; email: string }>;
};

type GeoSummary = {
  country: string;
  count: number;
  percentage: number;
};

type CohortSegmentationSummary = {
  devices: DeviceShare[];
  userSegments: UserSegment[];
  geo: GeoSummary[];
};

type ActivationCohort = {
  cohort: string;
  activationRate: number;
  cohortSize: number;
};

type FunnelStep = {
  step: string;
  currentCount: number;
  previousWeekCount: number;
};

type ConversionSummary = {
  funnel: FunnelStep[];
  activation: ActivationCohort[];
};

type AvailabilityPoint = {
  timestamp: string;
  availability: number;
  total: number;
  errors: number;
};

type ReliabilitySummary = {
  availability: {
    current: number;
    errorRatio: number;
    burnRate: number;
    series: AvailabilityPoint[];
  };
  queue: { depth: number; oldestMinutes: number | null };
  exceptions: Array<{ name: string; count: number; sampleStack: string | null }>;
};

type SuspiciousUser = {
  userId: string;
  email: string;
  uploads: number;
  windowStart: string;
};

type OrphanedFileSummary = {
  orphanCount: number;
  dbActivityCount: number;
  scannedAt: string;
};

type SafetySummary = {
  suspicious: SuspiciousUser[];
  storage: OrphanedFileSummary;
};

type FeatureClickSummary = {
  feature: string;
  count: number;
  percentage: number;
};

type EmptyStateSummary = {
  rate: number;
  totalSessions: number;
  emptySessions: number;
};

type UxSummary = {
  featureClicks: FeatureClickSummary[];
  emptyStates: EmptyStateSummary;
};

type AlertBanner = {
  type: 'latency' | 'quality';
  message: string;
};

type AlertSummary = {
  banners: AlertBanner[];
};

export type AdminAnalyticsOverview = {
  generatedAt: string;
  acquisition: SignupAcquisition;
  engagement: EngagementSummary;
  usage: UsageSummary;
  quality: QualitySummary;
  performance: PerformanceSummary;
  cohorts: CohortSegmentationSummary;
  conversion: ConversionSummary;
  reliability: ReliabilitySummary;
  safety: SafetySummary;
  ux: UxSummary;
  alerts: AlertSummary;
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = DAY_MS * 7;
const RECOMPUTE_COST_PER_MINUTE = 0.12;
const SLO_TARGET = 0.995;

function startOfDayUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDay(date: Date): string {
  return startOfDayUtc(date).toISOString().slice(0, 10);
}

function startOfWeekUtc(date: Date): Date {
  const day = startOfDayUtc(date);
  const weekday = day.getUTCDay();
  const diff = (weekday + 6) % 7; // Monday as start of week
  day.setUTCDate(day.getUTCDate() - diff);
  return day;
}

function calculateAverages(counts: DailyCount[], window: number): number {
  const slice = counts.slice(-window);
  if (slice.length === 0) {
    return 0;
  }
  const total = slice.reduce((sum, entry) => sum + entry.count, 0);
  return total / slice.length;
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower] ?? 0;
  }
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

async function computeDirectorySize(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let total = 0;
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await computeDirectorySize(fullPath);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.stat(fullPath);
          total += stats.size;
        } catch (error) {
          // Ignore files that disappear between readdir/stat
          if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
            throw error;
          }
        }
      }
    }
    return total;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

function normalizeDeviceName(source: string | null | undefined): string {
  if (!source) {
    return 'unknown';
  }
  const normalized = source.toLowerCase();
  if (normalized.includes('garmin')) {
    return 'garmin';
  }
  if (normalized.includes('wahoo')) {
    return 'wahoo';
  }
  if (normalized.includes('coros')) {
    return 'coros';
  }
  if (normalized.includes('hammerhead')) {
    return 'hammerhead';
  }
  return normalized;
}

function parseCountryFromLocation(location: string | null | undefined): string {
  if (!location) {
    return 'Unknown';
  }
  const segments = location.split(',').map((segment) => segment.trim());
  if (segments.length === 0) {
    return 'Unknown';
  }
  return segments[segments.length - 1] || 'Unknown';
}

function computeLinearRegressionSlope(points: Array<{ x: number; y: number }>): number {
  if (points.length === 0) {
    return 0;
  }
  const n = points.length;
  const sumX = points.reduce((acc, point) => acc + point.x, 0);
  const sumY = points.reduce((acc, point) => acc + point.y, 0);
  const sumXY = points.reduce((acc, point) => acc + point.x * point.y, 0);
  const sumX2 = points.reduce((acc, point) => acc + point.x * point.x, 0);
  const numerator = n * sumXY - sumX * sumY;
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return 0;
  }
  return numerator / denominator;
}

function computeSessionSummary(pageViews: { userId: string | null; createdAt: Date }[]): SessionSummary {
  const byUser = new Map<string, Date[]>();
  for (const view of pageViews) {
    const key = view.userId ?? 'anonymous';
    if (!byUser.has(key)) {
      byUser.set(key, []);
    }
    byUser.get(key)!.push(view.createdAt);
  }

  let totalSessions = 0;
  const durations: number[] = [];

  for (const timestamps of byUser.values()) {
    const sorted = timestamps.sort((a, b) => a.getTime() - b.getTime());
    let sessionStart = sorted[0];
    let lastEvent = sorted[0];

    if (!sessionStart) {
      continue;
    }

    for (let i = 1; i < sorted.length; i += 1) {
      const current = sorted[i]!;
      if (current.getTime() - (lastEvent?.getTime() ?? 0) > 30 * MINUTE_MS) {
        const durationMinutes = Math.max(1, Math.round((lastEvent!.getTime() - sessionStart.getTime()) / MINUTE_MS));
        durations.push(durationMinutes);
        totalSessions += 1;
        sessionStart = current;
      }
      lastEvent = current;
    }

    if (lastEvent) {
      const durationMinutes = Math.max(1, Math.round((lastEvent.getTime() - sessionStart.getTime()) / MINUTE_MS));
      durations.push(durationMinutes);
      totalSessions += 1;
    }
  }

  const uniqueUsers = byUser.size || 1;

  return {
    averageSessionsPerUser: totalSessions / uniqueUsers,
    medianSessionMinutes: durations.length > 0 ? median(durations) : 0,
    totalSessions,
    windowDays: 30,
  };
}

type UserUsageVector = {
  userId: string;
  uploads: number;
  views: number;
  recomputes: number;
};

function computeUserSegments(data: UserUsageVector[], emailLookup: Map<string, string>): UserSegment[] {
  if (data.length === 0) {
    return [];
  }

  if (data.length === 1) {
    const item = data[0]!;
    return [
      {
        label: 'Power users',
        count: 1,
        centroid: { uploads: item.uploads, views: item.views, recomputes: item.recomputes },
        sample: [
          {
            userId: item.userId,
            email: emailLookup.get(item.userId) ?? 'unknown',
          },
        ],
      },
    ];
  }

  let centroidA = { ...data[0]! };
  let centroidB = { ...data[data.length - 1]! };

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const clusterA: UserUsageVector[] = [];
    const clusterB: UserUsageVector[] = [];

    for (const point of data) {
      const distanceA =
        (point.uploads - centroidA.uploads) ** 2 +
        (point.views - centroidA.views) ** 2 +
        (point.recomputes - centroidA.recomputes) ** 2;
      const distanceB =
        (point.uploads - centroidB.uploads) ** 2 +
        (point.views - centroidB.views) ** 2 +
        (point.recomputes - centroidB.recomputes) ** 2;
      if (distanceA <= distanceB) {
        clusterA.push(point);
      } else {
        clusterB.push(point);
      }
    }

    const recalc = (cluster: UserUsageVector[], fallback: UserUsageVector) => {
      if (cluster.length === 0) {
        return { ...fallback };
      }
      const uploads = cluster.reduce((sum, item) => sum + item.uploads, 0) / cluster.length;
      const views = cluster.reduce((sum, item) => sum + item.views, 0) / cluster.length;
      const recomputes = cluster.reduce((sum, item) => sum + item.recomputes, 0) / cluster.length;
      return { userId: '', uploads, views, recomputes };
    };

    centroidA = recalc(clusterA, centroidA);
    centroidB = recalc(clusterB, centroidB);
  }

  const clusters: Array<{ label: string; points: UserUsageVector[]; centroid: { uploads: number; views: number; recomputes: number } }> = [
    {
      label: 'Cluster A',
      points: [],
      centroid: { uploads: centroidA.uploads, views: centroidA.views, recomputes: centroidA.recomputes },
    },
    {
      label: 'Cluster B',
      points: [],
      centroid: { uploads: centroidB.uploads, views: centroidB.views, recomputes: centroidB.recomputes },
    },
  ];

  for (const point of data) {
    const distanceToA =
      (point.uploads - centroidA.uploads) ** 2 +
      (point.views - centroidA.views) ** 2 +
      (point.recomputes - centroidA.recomputes) ** 2;
    const distanceToB =
      (point.uploads - centroidB.uploads) ** 2 +
      (point.views - centroidB.views) ** 2 +
      (point.recomputes - centroidB.recomputes) ** 2;
    const target = distanceToA <= distanceToB ? clusters[0]! : clusters[1]!;
    target.points.push(point);
  }

  const sortedClusters = clusters.sort((a, b) => b.centroid.uploads - a.centroid.uploads);
  const labels: ['Power users', 'Casual users'] = ['Power users', 'Casual users'];

  return sortedClusters.map((cluster, index) => {
    const label = labels[index] ?? `Segment ${index + 1}`;
    const sample = cluster.points
      .sort((a, b) => b.uploads - a.uploads)
      .slice(0, 5)
      .map((point) => ({
        userId: point.userId,
        email: emailLookup.get(point.userId) ?? 'unknown',
      }));
    return {
      label,
      count: cluster.points.length,
      centroid: cluster.centroid,
      sample,
    } satisfies UserSegment;
  });
}

function buildSignupSparkline(records: { createdAt: Date }[], today: Date): SignupSparkline {
  const days: DailyCount[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * DAY_MS);
    const key = formatDay(day);
    days.push({ date: key, count: 0 });
  }

  const map = new Map<string, DailyCount>();
  days.forEach((day) => map.set(day.date, day));

  for (const record of records) {
    const key = formatDay(record.createdAt);
    const entry = map.get(key);
    if (entry) {
      entry.count += 1;
    }
  }

  return {
    daily: days,
    average7d: calculateAverages(days, 7),
    average30d: calculateAverages(days, 30),
  };
}

type FirstActivityRecord = {
  userId: string;
  firstActivityAt: Date | null;
};

function buildSignupFunnel(
  users: { id: string; createdAt: Date }[],
  firstActivities: Map<string, FirstActivityRecord>,
): SignupFunnel {
  const totalSignups = users.length;

  let usersWithUpload = 0;
  let within24h = 0;
  let within48h = 0;
  let within7d = 0;

  for (const user of users) {
    const record = firstActivities.get(user.id);
    if (!record?.firstActivityAt) {
      continue;
    }

    usersWithUpload += 1;
    const delta = record.firstActivityAt.getTime() - user.createdAt.getTime();
    if (delta <= DAY_MS) {
      within24h += 1;
    }
    if (delta <= DAY_MS * 2) {
      within48h += 1;
    }
    if (delta <= DAY_MS * 7) {
      within7d += 1;
    }
  }

  const steps: SignupFunnelStep[] = [
    {
      label: 'D0',
      count: within24h,
      conversion: totalSignups > 0 ? within24h / totalSignups : 0,
    },
    {
      label: 'D1',
      count: within48h,
      conversion: totalSignups > 0 ? within48h / totalSignups : 0,
    },
    {
      label: 'D7',
      count: within7d,
      conversion: totalSignups > 0 ? within7d / totalSignups : 0,
    },
  ];

  return {
    totalSignups,
    usersWithUpload,
    reachedWithin24h: within24h,
    reachedWithin7d: within7d,
    conversion24h: totalSignups > 0 ? within24h / totalSignups : 0,
    conversion7d: totalSignups > 0 ? within7d / totalSignups : 0,
    steps,
  };
}

function buildTimeToFirstValueHistogram(
  users: { id: string; createdAt: Date }[],
  firstActivities: Map<string, FirstActivityRecord>,
): HistogramBucket[] {
  const buckets: { upperBoundMinutes: number | null; label: string; count: number }[] = [
    { upperBoundMinutes: 10, label: '<10m', count: 0 },
    { upperBoundMinutes: 60, label: '10-60m', count: 0 },
    { upperBoundMinutes: 180, label: '1-3h', count: 0 },
    { upperBoundMinutes: 1440, label: '3h-1d', count: 0 },
    { upperBoundMinutes: 10080, label: '1-7d', count: 0 },
    { upperBoundMinutes: null, label: '>7d', count: 0 },
  ];

  for (const user of users) {
    const record = firstActivities.get(user.id);
    if (!record?.firstActivityAt) {
      continue;
    }

    const minutes = (record.firstActivityAt.getTime() - user.createdAt.getTime()) / (60 * 1000);
    if (minutes < 0) {
      continue;
    }

    const bucket = buckets.find((item) => item.upperBoundMinutes === null || minutes <= item.upperBoundMinutes);
    if (bucket) {
      bucket.count += 1;
    }
  }

  return buckets.map(({ label, count }) => ({ label, count }));
}

function buildSignupSources(users: { provider: string | null; utmSource: string | null }[]): SignupSource[] {
  const totals = new Map<string, number>();
  for (const user of users) {
    const utm = user.utmSource?.trim().toLowerCase();
    const provider = user.provider?.trim().toLowerCase();
    const source = utm && utm.length > 0 ? utm : provider && provider.length > 0 ? provider : 'direct';
    totals.set(source, (totals.get(source) ?? 0) + 1);
  }

  const totalUsers = users.length || 1;

  return Array.from(totals.entries())
    .map(([source, count]) => ({
      source,
      count,
      percentage: count / totalUsers,
    }))
    .sort((a, b) => b.count - a.count);
}

type ActivityRecord = {
  userId: string;
  startTime: Date;
};

function buildActiveUserSummary(records: ActivityRecord[], today: Date): ActiveUserSummary {
  const start = new Date(today.getTime() - 89 * DAY_MS);
  const daySets = new Map<string, Set<string>>();

  for (const record of records) {
    const key = formatDay(record.startTime);
    if (!daySets.has(key)) {
      daySets.set(key, new Set());
    }
    if (record.userId) {
      daySets.get(key)?.add(record.userId);
    }
  }

  const sevenDayQueue: string[][] = [];
  const thirtyDayQueue: string[][] = [];
  const sevenDayCounts = new Map<string, number>();
  const thirtyDayCounts = new Map<string, number>();
  const series: ActiveUserPoint[] = [];

  for (let i = 0; i < 90; i += 1) {
    const day = new Date(start.getTime() + i * DAY_MS);
    const key = formatDay(day);
    const dauSet = daySets.get(key) ?? new Set<string>();
    const dauUsers = Array.from(dauSet);

    sevenDayQueue.push(dauUsers);
    thirtyDayQueue.push(dauUsers);

    for (const userId of dauUsers) {
      sevenDayCounts.set(userId, (sevenDayCounts.get(userId) ?? 0) + 1);
      thirtyDayCounts.set(userId, (thirtyDayCounts.get(userId) ?? 0) + 1);
    }

    if (sevenDayQueue.length > 7) {
      const removed = sevenDayQueue.shift() ?? [];
      for (const userId of removed) {
        const next = (sevenDayCounts.get(userId) ?? 0) - 1;
        if (next <= 0) {
          sevenDayCounts.delete(userId);
        } else {
          sevenDayCounts.set(userId, next);
        }
      }
    }

    if (thirtyDayQueue.length > 30) {
      const removed = thirtyDayQueue.shift() ?? [];
      for (const userId of removed) {
        const next = (thirtyDayCounts.get(userId) ?? 0) - 1;
        if (next <= 0) {
          thirtyDayCounts.delete(userId);
        } else {
          thirtyDayCounts.set(userId, next);
        }
      }
    }

    const wau = sevenDayCounts.size;
    const mau = thirtyDayCounts.size;
    const stickiness = mau > 0 ? dauUsers.length / mau : 0;

    series.push({
      date: key,
      dau: dauUsers.length,
      wau,
      mau,
      stickiness,
    });
  }

  const latest = series[series.length - 1] ?? {
    dau: 0,
    wau: 0,
    mau: 0,
    stickiness: 0,
  };

  return {
    current: {
      dau: latest.dau,
      wau: latest.wau,
      mau: latest.mau,
      stickiness: latest.stickiness,
    },
    series,
  };
}

type CohortUser = {
  id: string;
  createdAt: Date;
};

type ActivityWithUser = {
  userId: string | null;
  startTime: Date;
};

function buildRetentionCohorts(
  users: CohortUser[],
  activities: ActivityWithUser[],
): RetentionCohort[] {
  const milestones = [
    { label: 'D0', thresholdDays: 0 },
    { label: 'D1', thresholdDays: 1 },
    { label: 'D7', thresholdDays: 7 },
    { label: 'D30', thresholdDays: 30 },
  ];

  const cohorts = new Map<
    string,
    {
      cohortStart: Date;
      users: CohortUser[];
      earliestActivityDays: Map<string, number>;
    }
  >();

  const userSignup = new Map<string, Date>();

  for (const user of users) {
    const cohortStart = startOfWeekUtc(user.createdAt);
    const key = cohortStart.toISOString().slice(0, 10);
    if (!cohorts.has(key)) {
      cohorts.set(key, {
        cohortStart,
        users: [],
        earliestActivityDays: new Map(),
      });
    }
    cohorts.get(key)?.users.push(user);
    userSignup.set(user.id, user.createdAt);
  }

  for (const activity of activities) {
    if (!activity.userId) {
      continue;
    }
    const signupDate = userSignup.get(activity.userId);
    if (!signupDate) {
      continue;
    }
    const cohortStart = startOfWeekUtc(signupDate);
    const cohortKey = cohortStart.toISOString().slice(0, 10);
    const cohort = cohorts.get(cohortKey);
    if (!cohort) {
      continue;
    }
    const diffDays = Math.floor(
      (startOfDayUtc(activity.startTime).getTime() - startOfDayUtc(signupDate).getTime()) /
        DAY_MS,
    );
    if (diffDays < 0) {
      continue;
    }
    const current = cohort.earliestActivityDays.get(activity.userId) ?? Number.POSITIVE_INFINITY;
    if (diffDays < current) {
      cohort.earliestActivityDays.set(activity.userId, diffDays);
    }
  }

  return Array.from(cohorts.values())
    .sort((a, b) => a.cohortStart.getTime() - b.cohortStart.getTime())
    .map((cohort) => {
      const size = cohort.users.length;
      const retention = milestones.map(({ label, thresholdDays }) => {
        if (size === 0) {
          return { label, value: 0 };
        }
        let activeCount = 0;
        for (const user of cohort.users) {
          const earliest = cohort.earliestActivityDays.get(user.id);
          if (earliest != null && earliest <= thresholdDays) {
            activeCount += 1;
          }
        }
        return { label, value: activeCount / size };
      });

      return {
        cohort: cohort.cohortStart.toISOString(),
        size,
        retention,
      };
    });
}

type ActivityWithUserEmail = {
  userId: string | null;
  startTime: Date;
  user: {
    email: string;
  } | null;
};

function buildReturningUsersLeaderboard(activities: ActivityWithUserEmail[]): ReturningUser[] {
  const perUser = new Map<
    string,
    {
      email: string;
      days: Set<string>;
      activities: number;
    }
  >();

  for (const activity of activities) {
    if (!activity.userId || !activity.user) {
      continue;
    }
    const dayKey = formatDay(activity.startTime);
    let record = perUser.get(activity.userId);
    if (!record) {
      record = {
        email: activity.user.email,
        days: new Set(),
        activities: 0,
      };
      perUser.set(activity.userId, record);
    }
    record.days.add(dayKey);
    record.activities += 1;
  }

  return Array.from(perUser.entries())
    .map(([userId, record]) => ({
      userId,
      email: record.email,
      activeDays: record.days.size,
      activityCount: record.activities,
    }))
    .filter((entry) => entry.activeDays >= 3)
    .sort((a, b) => {
      if (b.activeDays === a.activeDays) {
        return b.activityCount - a.activityCount;
      }
      return b.activeDays - a.activeDays;
    })
    .slice(0, 10);
}

export async function getAdminAnalyticsOverview(): Promise<AdminAnalyticsOverview> {
  const now = new Date();
  const today = startOfDayUtc(now);
  const signupWindowStart = new Date(today.getTime() - 29 * DAY_MS);
  const cohortWindowStart = new Date(today.getTime() - 90 * DAY_MS);
  const thirtyDayWindowStart = new Date(today.getTime() - 29 * DAY_MS);
  const sevenDayWindowStart = new Date(today.getTime() - 6 * DAY_MS);
  const fourteenDayWindowStart = new Date(today.getTime() - 13 * DAY_MS);
  const tenMinutesAgo = new Date(now.getTime() - 10 * MINUTE_MS);
  const [recentUsers, firstActivitiesRaw, activityRecords, cohortUsers, cohortActivities, leaderboardActivities] =
    await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: signupWindowStart } },
        select: { id: true, createdAt: true, provider: true, utmSource: true },
      }),
      prisma.activity.groupBy({
        by: ['userId'],
        where: { userId: { not: null } },
        _min: { startTime: true },
      }),
      prisma.activity.findMany({
        where: { userId: { not: null }, startTime: { gte: new Date(today.getTime() - 89 * DAY_MS) } },
        select: { userId: true, startTime: true },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: cohortWindowStart } },
        select: { id: true, createdAt: true },
      }),
      prisma.activity.findMany({
        where: { userId: { not: null }, startTime: { gte: cohortWindowStart } },
        select: { userId: true, startTime: true },
      }),
      prisma.activity.findMany({
        where: { userId: { not: null }, startTime: { gte: startOfWeekUtc(today) } },
        select: { userId: true, startTime: true, user: { select: { email: true } } },
      }),
    ]);

  const [
    metricEvents,
    pageViews,
    requestMetrics,
    exceptionEvents,
    pendingJobs,
    deviceCounts7d,
    deviceCounts30d,
    totalActivities30d,
    metricDefinitions,
    profileLocations,
  ] = await Promise.all([
    prisma.metricEvent.findMany({
      where: { createdAt: { gte: thirtyDayWindowStart } },
      select: {
        id: true,
        type: true,
        userId: true,
        activityId: true,
        durationMs: true,
        success: true,
        meta: true,
        createdAt: true,
      },
    }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: thirtyDayWindowStart } },
      select: { userId: true, path: true, createdAt: true },
    }),
    prisma.apiRequestMetric.findMany({
      where: { timestamp: { gte: new Date(now.getTime() - 7 * DAY_MS) } },
      select: {
        method: true,
        path: true,
        statusCode: true,
        durationMs: true,
        queryCount: true,
        avgQueryDurationMs: true,
        timestamp: true,
      },
    }),
    prisma.exceptionEvent.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - DAY_MS) } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { name: true, message: true, stack: true, createdAt: true },
    }),
    prisma.metricComputationJob.findMany({
      where: { status: { in: ['PENDING', 'RUNNING'] } },
      orderBy: { enqueuedAt: 'asc' },
      select: { status: true, enqueuedAt: true },
    }),
    prisma.activity.groupBy({
      by: ['source'],
      _count: true,
      where: { startTime: { gte: sevenDayWindowStart } },
    }),
    prisma.activity.groupBy({
      by: ['source'],
      _count: true,
      where: { startTime: { gte: thirtyDayWindowStart } },
    }),
    prisma.activity.count({ where: { startTime: { gte: thirtyDayWindowStart } } }),
    prisma.metricDefinition.findMany({
      where: { key: { in: ['hcsr', 'normalized-power', 'intensity-factor', 'tss'] } },
      select: { id: true, key: true, name: true },
    }),
    prisma.profile.findMany({
      where: { location: { not: null } },
      select: { location: true },
    }),
  ]);

  const firstActivities = new Map<string, FirstActivityRecord>();
  for (const record of firstActivitiesRaw) {
    if (!record.userId) {
      continue;
    }
    firstActivities.set(record.userId, {
      userId: record.userId,
      firstActivityAt: record._min.startTime ?? null,
    });
  }

  const readMeta = (meta: Prisma.JsonValue | null): Record<string, unknown> => {
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      return meta as Record<string, unknown>;
    }
    return {};
  };

  const toNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const uploadsPerDayMap = new Map<string, { success: number; failed: number }>();
  const uploadsPerUserMap = new Map<string, { success: number; failed: number }>();
  const uploadSizeByDay = new Map<string, number>();
  const uploadDurations: number[] = [];
  const uploadDurationsByDay = new Map<string, number[]>();
  const failureCountsByCode = new Map<string, number>();
  const retryGroups = new Map<string, number>();
  const badDataWindow = new Map<string, { success: number; failed: number }>();
  const suspiciousUploadWindows = new Map<string, Date[]>();

  const recomputeDurations: number[] = [];
  const recomputeDurationsByDay = new Map<string, number[]>();
  const recomputeDailyMap = new Map<string, { count: number; users: Set<string> }>();
  const recomputeByUser = new Map<string, { count: number; lastRunAt: Date | null }>();

  const featureClickCounts = new Map<string, number>();
  const activityViews7d = new Map<string, number>();
  const activityViews30d = new Map<string, number>();
  const activityIdsForLookup = new Set<string>();

  const emptyStateCounters = { total: 0, empty: 0 };

  const userUsageVectors = new Map<string, UserUsageVector>();
  const activationEvents = new Map<string, { signupAt: Date | null; uploads: Date[]; recomputes: Date[] }>();

  const funnelCurrentWeek = {
    signupUsers: new Set<string>(),
    uploadUsers: new Set<string>(),
    metricViewUsers: new Set<string>(),
    exportUsers: new Set<string>(),
  };
  const funnelPreviousWeek = {
    signupUsers: new Set<string>(),
    uploadUsers: new Set<string>(),
    metricViewUsers: new Set<string>(),
    exportUsers: new Set<string>(),
  };

  const userIdsForLookup = new Set<string>();
  const userEmails = new Map<string, string>();

  const currentWeekStart = startOfWeekUtc(today);
  const previousWeekStart = new Date(currentWeekStart.getTime() - 7 * DAY_MS);

  for (const user of recentUsers) {
    if (user.createdAt >= currentWeekStart) {
      funnelCurrentWeek.signupUsers.add(user.id);
    } else if (user.createdAt >= previousWeekStart) {
      funnelPreviousWeek.signupUsers.add(user.id);
    }
  }

  for (const event of metricEvents) {
    const meta = readMeta(event.meta);
    const dateKey = formatDay(event.createdAt);
    if (event.userId) {
      userIdsForLookup.add(event.userId);
    }

    if (!uploadsPerDayMap.has(dateKey)) {
      uploadsPerDayMap.set(dateKey, { success: 0, failed: 0 });
    }

    switch (event.type) {
      case 'upload': {
        const perDay = uploadsPerDayMap.get(dateKey)!;
        const perUserKey = event.userId ?? 'anonymous';
        if (!uploadsPerUserMap.has(perUserKey)) {
          uploadsPerUserMap.set(perUserKey, { success: 0, failed: 0 });
        }
        const perUser = uploadsPerUserMap.get(perUserKey)!;

        const size = toNumber(meta.size);
        if (event.success) {
          perDay.success += 1;
          perUser.success += 1;
          if (size != null) {
            uploadSizeByDay.set(dateKey, (uploadSizeByDay.get(dateKey) ?? 0) + size);
          }
          uploadDurations.push(event.durationMs ?? 0);
          if (!uploadDurationsByDay.has(dateKey)) {
            uploadDurationsByDay.set(dateKey, []);
          }
          uploadDurationsByDay.get(dateKey)!.push(event.durationMs ?? 0);

          if (event.userId) {
            if (!suspiciousUploadWindows.has(event.userId)) {
              suspiciousUploadWindows.set(event.userId, []);
            }
            suspiciousUploadWindows.get(event.userId)!.push(event.createdAt);
          }

          if (event.createdAt >= sevenDayWindowStart && event.userId) {
            const window = badDataWindow.get(event.userId) ?? { success: 0, failed: 0 };
            window.success += 1;
            badDataWindow.set(event.userId, window);
          }

          if (event.userId) {
            const usage = userUsageVectors.get(event.userId) ?? {
              userId: event.userId,
              uploads: 0,
              views: 0,
              recomputes: 0,
            };
            usage.uploads += 1;
            userUsageVectors.set(event.userId, usage);

          const activation =
            activationEvents.get(event.userId) ?? {
              signupAt: null,
              uploads: [],
              recomputes: [],
            };
          activation.uploads.push(event.createdAt);
          activationEvents.set(event.userId, activation);
          }

          const targetFunnel = event.createdAt >= currentWeekStart ? funnelCurrentWeek : event.createdAt >= previousWeekStart ? funnelPreviousWeek : null;
          if (targetFunnel && event.userId) {
            targetFunnel.uploadUsers.add(event.userId);
          }
        } else {
          perDay.failed += 1;
          perUser.failed += 1;
          const errorCode = typeof meta.errorCode === 'string' ? meta.errorCode : 'unknown';
          failureCountsByCode.set(errorCode, (failureCountsByCode.get(errorCode) ?? 0) + 1);
          const retryKey = `${event.userId ?? 'anonymous'}:${typeof meta.fileName === 'string' ? meta.fileName : 'unknown'}`;
          retryGroups.set(retryKey, (retryGroups.get(retryKey) ?? 0) + 1);
          if (event.createdAt >= sevenDayWindowStart && event.userId) {
            const window = badDataWindow.get(event.userId) ?? { success: 0, failed: 0 };
            window.failed += 1;
            badDataWindow.set(event.userId, window);
          }
        }
        break;
      }
      case 'recompute': {
        const duration = event.durationMs ?? 0;
        recomputeDurations.push(duration);
        if (!recomputeDurationsByDay.has(dateKey)) {
          recomputeDurationsByDay.set(dateKey, []);
        }
        recomputeDurationsByDay.get(dateKey)!.push(duration);
        const daily = recomputeDailyMap.get(dateKey) ?? { count: 0, users: new Set<string>() };
        daily.count += 1;
        if (event.userId) {
          daily.users.add(event.userId);
        }
        recomputeDailyMap.set(dateKey, daily);
        if (event.userId) {
          const usage = userUsageVectors.get(event.userId) ?? {
            userId: event.userId,
            uploads: 0,
            views: 0,
            recomputes: 0,
          };
          usage.recomputes += 1;
          userUsageVectors.set(event.userId, usage);

          const history = recomputeByUser.get(event.userId) ?? { count: 0, lastRunAt: null };
          history.count += 1;
          history.lastRunAt = history.lastRunAt && history.lastRunAt > event.createdAt ? history.lastRunAt : event.createdAt;
          recomputeByUser.set(event.userId, history);

          const activation =
            activationEvents.get(event.userId) ?? {
              signupAt: null,
              uploads: [],
              recomputes: [],
            };
          activation.recomputes.push(event.createdAt);
          activationEvents.set(event.userId, activation);
        }
        break;
      }
      case 'activity_view':
      case 'metric_view': {
        if (event.activityId) {
          activityIdsForLookup.add(event.activityId);
          if (!activityViews30d.has(event.activityId)) {
            activityViews30d.set(event.activityId, 0);
          }
          activityViews30d.set(event.activityId, (activityViews30d.get(event.activityId) ?? 0) + 1);
          if (event.createdAt >= sevenDayWindowStart) {
            activityViews7d.set(event.activityId, (activityViews7d.get(event.activityId) ?? 0) + 1);
          }
        }

        if (event.userId) {
          const usage = userUsageVectors.get(event.userId) ?? {
            userId: event.userId,
            uploads: 0,
            views: 0,
            recomputes: 0,
          };
          usage.views += 1;
          userUsageVectors.set(event.userId, usage);
        }

        const targetFunnel = event.createdAt >= currentWeekStart ? funnelCurrentWeek : event.createdAt >= previousWeekStart ? funnelPreviousWeek : null;
        if (targetFunnel && event.userId) {
          targetFunnel.metricViewUsers.add(event.userId);
        }
        break;
      }
      case 'export': {
        const targetFunnel = event.createdAt >= currentWeekStart ? funnelCurrentWeek : event.createdAt >= previousWeekStart ? funnelPreviousWeek : null;
        if (targetFunnel && event.userId) {
          targetFunnel.exportUsers.add(event.userId);
        }
        break;
      }
      case 'feature_click': {
        const feature = typeof meta.feature === 'string' ? meta.feature : 'unknown';
        featureClickCounts.set(feature, (featureClickCounts.get(feature) ?? 0) + 1);
        break;
      }
      case 'activities_list': {
        emptyStateCounters.total += 1;
        const total = toNumber(meta.total);
        if (total === 0) {
          emptyStateCounters.empty += 1;
        }
        break;
      }
      default:
        break;
    }
  }

  const acquisition: SignupAcquisition = {
    newSignups: buildSignupSparkline(recentUsers, today),
    signupToFirstUpload: buildSignupFunnel(
      recentUsers.map(({ id, createdAt }) => ({ id, createdAt })),
      firstActivities,
    ),
    timeToFirstValue: buildTimeToFirstValueHistogram(
      recentUsers.map(({ id, createdAt }) => ({ id, createdAt })),
      firstActivities,
    ),
    signupsBySource: buildSignupSources(recentUsers),
  };

  const engagement: EngagementSummary = {
    activeUsers: buildActiveUserSummary(activityRecords, today),
    retentionCohorts: buildRetentionCohorts(cohortUsers, cohortActivities),
    returningUsers: buildReturningUsersLeaderboard(leaderboardActivities),
    sessions: computeSessionSummary(pageViews),
  };

  if (userIdsForLookup.size > 0) {
    const emailRecords = await prisma.user.findMany({
      where: { id: { in: Array.from(userIdsForLookup) } },
      select: { id: true, email: true },
    });
    for (const record of emailRecords) {
      userEmails.set(record.id, record.email);
    }
  }

  const metricCoverageCounts = await Promise.all(
    metricDefinitions.map((definition) =>
      prisma.metricResult.count({
        where: {
          metricDefinitionId: definition.id,
          activity: { startTime: { gte: thirtyDayWindowStart } },
        },
      }),
    ),
  );

  for (const user of cohortUsers) {
    const activation =
      activationEvents.get(user.id) ?? {
        signupAt: null,
        uploads: [],
        recomputes: [],
      };
    activation.signupAt = user.createdAt;
    activationEvents.set(user.id, activation);
  }

  const activityDetails = new Map<string, { title: string | null; owner: string }>();
  if (activityIdsForLookup.size > 0) {
    const activityRecords = await prisma.activity.findMany({
      where: { id: { in: Array.from(activityIdsForLookup) } },
      select: { id: true, name: true, user: { select: { email: true } } },
    });
    for (const activity of activityRecords) {
      activityDetails.set(activity.id, {
        title: activity.name ?? null,
        owner: activity.user?.email ?? 'unknown',
      });
    }
  }

  const uploadsPerDay: UploadsPerDay[] = [];
  for (let offset = 29; offset >= 0; offset -= 1) {
    const day = new Date(today.getTime() - offset * DAY_MS);
    const key = formatDay(day);
    const stats = uploadsPerDayMap.get(key) ?? { success: 0, failed: 0 };
    uploadsPerDay.push({ date: key, success: stats.success, failed: stats.failed });
  }

  const uploadsPerUser: UploadsPerUser[] = Array.from(uploadsPerUserMap.entries())
    .filter(([userId]) => userId !== 'anonymous')
    .map(([userId, stats]) => ({
      userId,
      email: userEmails.get(userId) ?? 'unknown',
      success: stats.success,
      failed: stats.failed,
    }))
    .sort((a, b) => b.success - a.success)
    .slice(0, 20);

  const recomputeDaily = Array.from(recomputeDailyMap.entries())
    .map(([date, stats]) => ({ date, count: stats.count, uniqueUsers: stats.users.size }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const recomputeTopUsers = Array.from(recomputeByUser.entries())
    .map(([userId, stats]) => ({
      userId,
      email: userEmails.get(userId) ?? 'unknown',
      count: stats.count,
      lastRunAt: stats.lastRunAt ? stats.lastRunAt.toISOString() : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topActivities: ActivityViewSummary[] = [];
  for (const [activityId, views] of activityViews7d.entries()) {
    const info = activityDetails.get(activityId) ?? { title: null, owner: 'unknown' };
    topActivities.push({
      activityId,
      title: info.title,
      owner: info.owner,
      views,
      window: '7d',
    });
  }
  for (const [activityId, views] of activityViews30d.entries()) {
    const info = activityDetails.get(activityId) ?? { title: null, owner: 'unknown' };
    topActivities.push({
      activityId,
      title: info.title,
      owner: info.owner,
      views,
      window: '30d',
    });
  }

  const metricCoverage: MetricCoverageRow[] = metricDefinitions.map((definition, index) => ({
    metricKey: definition.key,
    metricName: definition.name,
    coverage: totalActivities30d > 0 ? metricCoverageCounts[index]! / totalActivities30d : 0,
    totalActivities: totalActivities30d,
  }));

  const usage: UsageSummary = {
    uploadsPerDay,
    uploadsPerUser,
    recompute: {
      daily: recomputeDaily,
      topUsers: recomputeTopUsers,
    },
    topActivities: topActivities.sort((a, b) => b.views - a.views).slice(0, 20),
    metricCoverage,
  };

  const totalFailures = Array.from(failureCountsByCode.values()).reduce((sum, count) => sum + count, 0);
  const parseFailures: ParseFailureBreakdown[] = Array.from(failureCountsByCode.entries())
    .map(([errorCode, count]) => ({
      errorCode,
      count,
      percentage: totalFailures > 0 ? count / totalFailures : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const uploadLatencySeries = Array.from(uploadDurationsByDay.entries())
    .map(([date, durations]) => ({ date, p95: percentile(durations, 0.95) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const recomputeLatencySeries = Array.from(recomputeDurationsByDay.entries())
    .map(([date, durations]) => ({ date, p95: percentile(durations, 0.95) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const retryValues = Array.from(retryGroups.values());
  const retryRate = retryValues.length > 0 ? retryValues.filter((value) => value > 1).length / retryValues.length : 0;
  const meanRetries = retryValues.length > 0 ? retryValues.reduce((sum, value) => sum + value, 0) / retryValues.length : 0;

  const badData: BadDataUser[] = Array.from(badDataWindow.entries())
    .map(([userId, stats]) => {
      const total = stats.failed + stats.success;
      const rate = total > 0 ? stats.failed / total : 0;
      return {
        userId,
        email: userEmails.get(userId) ?? 'unknown',
        failureRate: rate,
        totalUploads: total,
      } satisfies BadDataUser;
    })
    .filter((entry) => entry.totalUploads >= 5 && entry.failureRate >= 0.2)
    .sort((a, b) => b.failureRate - a.failureRate)
    .slice(0, 20);

  const quality: QualitySummary = {
    parseFailures,
    latency: {
      upload: {
        p50: percentile(uploadDurations, 0.5),
        p95: percentile(uploadDurations, 0.95),
        p99: percentile(uploadDurations, 0.99),
        series: uploadLatencySeries,
      },
      recompute: {
        p50: percentile(recomputeDurations, 0.5),
        p95: percentile(recomputeDurations, 0.95),
        p99: percentile(recomputeDurations, 0.99),
        series: recomputeLatencySeries,
      },
    },
    retry: {
      retryRate,
      meanRetries,
      sampleSize: retryValues.length,
    },
    badData,
  };

  const endpointAggregates = new Map<
    string,
    {
      method: string;
      path: string;
      totalDuration: number;
      totalQueryDuration: number;
      queryCount: number;
      requestCount: number;
    }
  >();

  for (const metric of requestMetrics) {
    const key = `${metric.method.toUpperCase()} ${metric.path}`;
    if (!endpointAggregates.has(key)) {
      endpointAggregates.set(key, {
        method: metric.method.toUpperCase(),
        path: metric.path,
        totalDuration: 0,
        totalQueryDuration: 0,
        queryCount: 0,
        requestCount: 0,
      });
    }
    const aggregate = endpointAggregates.get(key)!;
    aggregate.totalDuration += metric.durationMs;
    aggregate.totalQueryDuration += metric.avgQueryDurationMs * metric.queryCount;
    aggregate.queryCount += metric.queryCount;
    aggregate.requestCount += 1;
  }

  const db: EndpointMetric[] = Array.from(endpointAggregates.values())
    .map((entry) => ({
      method: entry.method,
      path: entry.path,
      avgDurationMs: entry.requestCount > 0 ? entry.totalDuration / entry.requestCount : 0,
      avgQueryCount: entry.requestCount > 0 ? entry.queryCount / entry.requestCount : 0,
      avgQueryDurationMs: entry.queryCount > 0 ? entry.totalQueryDuration / entry.queryCount : 0,
      requestCount: entry.requestCount,
    }))
    .sort((a, b) => b.avgDurationMs - a.avgDurationMs)
    .slice(0, 20);

  const storageDailyTotals = [] as Array<{ date: string; bytes: number }>;
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today.getTime() - offset * DAY_MS);
    const key = formatDay(day);
    storageDailyTotals.push({ date: key, bytes: uploadSizeByDay.get(key) ?? 0 });
  }

  const sevenDaySlopeBytesPerDay = computeLinearRegressionSlope(
    storageDailyTotals.map((entry, index) => ({ x: index, y: entry.bytes })),
  );

  const uploadsDirBytes = await computeDirectorySize(env.UPLOAD_DIR);
  let postgresBytes: number | null = null;
  try {
    const sizeResult = (await prisma.$queryRawUnsafe<{ size: bigint }[]>(
      'SELECT pg_database_size(current_database())::bigint AS size',
    )) as { size: bigint }[];
    if (sizeResult?.[0]?.size != null) {
      postgresBytes = Number(sizeResult[0]!.size);
    }
  } catch {
    postgresBytes = null;
  }

  const recomputeDailyMinutes = Array.from(recomputeDurationsByDay.entries())
    .map(([date, durations]) => ({ date, minutes: durations.reduce((sum, value) => sum + value, 0) / (60 * 1000) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const totalRecomputeMinutes = recomputeDurations.reduce((sum, value) => sum + value, 0) / (60 * 1000);

  const performance: PerformanceSummary = {
    db,
    storage: {
      uploadsDirBytes,
      postgresBytes,
      sevenDaySlopeBytesPerDay,
      dailyTotals: storageDailyTotals,
    },
    recomputeCost: {
      totalMinutes: totalRecomputeMinutes,
      estimatedUsd: totalRecomputeMinutes * RECOMPUTE_COST_PER_MINUTE,
      dailyMinutes: recomputeDailyMinutes,
    },
  };

  const deviceShares: DeviceShare[] = [];
  const deviceTotals7d = deviceCounts7d.reduce((sum, entry) => sum + entry._count, 0) || 1;
  for (const entry of deviceCounts7d) {
    deviceShares.push({
      device: normalizeDeviceName(entry.source),
      count: entry._count,
      percentage: entry._count / deviceTotals7d,
      window: '7d',
    });
  }
  const deviceTotals30d = deviceCounts30d.reduce((sum, entry) => sum + entry._count, 0) || 1;
  for (const entry of deviceCounts30d) {
    deviceShares.push({
      device: normalizeDeviceName(entry.source),
      count: entry._count,
      percentage: entry._count / deviceTotals30d,
      window: '30d',
    });
  }

  const userSegments = computeUserSegments(Array.from(userUsageVectors.values()), userEmails);

  const geoCounts = new Map<string, number>();
  for (const profile of profileLocations) {
    const country = parseCountryFromLocation(profile.location);
    geoCounts.set(country, (geoCounts.get(country) ?? 0) + 1);
  }
  const geoTotal = Array.from(geoCounts.values()).reduce((sum, value) => sum + value, 0) || 1;
  const geo: GeoSummary[] = Array.from(geoCounts.entries())
    .map(([country, count]) => ({
      country,
      count,
      percentage: count / geoTotal,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const cohorts: CohortSegmentationSummary = {
    devices: deviceShares,
    userSegments,
    geo,
  };

  const activationByCohort = new Map<
    string,
    { cohortStart: Date; size: number; activated: number }
  >();

  for (const [userId, record] of activationEvents.entries()) {
    if (!record.signupAt) {
      continue;
    }
    const cohortStart = startOfWeekUtc(record.signupAt);
    const key = cohortStart.toISOString();
    if (!activationByCohort.has(key)) {
      activationByCohort.set(key, { cohortStart, size: 0, activated: 0 });
    }
    const aggregate = activationByCohort.get(key)!;
    aggregate.size += 1;
    const cutoff = new Date(record.signupAt.getTime() + 7 * DAY_MS);
    const uploadsWithin = record.uploads.filter((date) => date <= cutoff).length;
    const recomputesWithin = record.recomputes.filter((date) => date <= cutoff).length;
    if (uploadsWithin >= 3 && recomputesWithin >= 1) {
      aggregate.activated += 1;
    }
  }

  const activation: ActivationCohort[] = Array.from(activationByCohort.values())
    .sort((a, b) => a.cohortStart.getTime() - b.cohortStart.getTime())
    .map((entry) => ({
      cohort: entry.cohortStart.toISOString(),
      cohortSize: entry.size,
      activationRate: entry.size > 0 ? entry.activated / entry.size : 0,
    }))
    .slice(-12);

  const funnel: FunnelStep[] = [
    {
      step: 'Signup',
      currentCount: funnelCurrentWeek.signupUsers.size,
      previousWeekCount: funnelPreviousWeek.signupUsers.size,
    },
    {
      step: 'Upload',
      currentCount: funnelCurrentWeek.uploadUsers.size,
      previousWeekCount: funnelPreviousWeek.uploadUsers.size,
    },
    {
      step: 'View Metrics',
      currentCount: funnelCurrentWeek.metricViewUsers.size,
      previousWeekCount: funnelPreviousWeek.metricViewUsers.size,
    },
    {
      step: 'Export',
      currentCount: funnelCurrentWeek.exportUsers.size,
      previousWeekCount: funnelPreviousWeek.exportUsers.size,
    },
  ];

  const conversion: ConversionSummary = {
    funnel,
    activation,
  };

  const availabilityWindowStart = new Date(now.getTime() - DAY_MS);
  const availabilityBuckets = new Map<
    string,
    { total: number; errors: number }
  >();

  for (const metric of requestMetrics) {
    if (metric.timestamp < availabilityWindowStart) {
      continue;
    }
    const minute = new Date(Math.floor(metric.timestamp.getTime() / MINUTE_MS) * MINUTE_MS).toISOString();
    if (!availabilityBuckets.has(minute)) {
      availabilityBuckets.set(minute, { total: 0, errors: 0 });
    }
    const bucket = availabilityBuckets.get(minute)!;
    bucket.total += 1;
    if (metric.statusCode >= 500) {
      bucket.errors += 1;
    }
  }

  const availabilitySeries: AvailabilityPoint[] = Array.from(availabilityBuckets.entries())
    .map(([timestamp, bucket]) => ({
      timestamp,
      availability: bucket.total > 0 ? (bucket.total - bucket.errors) / bucket.total : 1,
      total: bucket.total,
      errors: bucket.errors,
    }))
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

  const totalRequests = availabilitySeries.reduce((sum, point) => sum + point.total, 0);
  const totalErrors = availabilitySeries.reduce((sum, point) => sum + point.errors, 0);
  const overallAvailability = totalRequests > 0 ? (totalRequests - totalErrors) / totalRequests : 1;
  const currentAvailability = availabilitySeries.length > 0 ? availabilitySeries[availabilitySeries.length - 1]!.availability : 1;
  const errorRatio = totalRequests > 0 ? totalErrors / totalRequests : 0;
  const burnRate = (1 - overallAvailability) / (1 - SLO_TARGET);

  const queueDepth = pendingJobs.length;
  const oldestMinutes = pendingJobs[0]
    ? Math.round((now.getTime() - pendingJobs[0]!.enqueuedAt.getTime()) / MINUTE_MS)
    : null;

  const exceptionAggregates = new Map<string, { count: number; stack: string | null }>();
  for (const exception of exceptionEvents) {
    const stackSnippet = typeof exception.stack === 'string' ? exception.stack.split('\n').slice(0, 5).join('\n') : null;
    const existing = exceptionAggregates.get(exception.name);
    if (existing) {
      existing.count += 1;
    } else {
      exceptionAggregates.set(exception.name, { count: 1, stack: stackSnippet });
    }
  }
  const exceptions = Array.from(exceptionAggregates.entries())
    .map(([name, data]) => ({ name, count: data.count, sampleStack: data.stack }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const reliability: ReliabilitySummary = {
    availability: {
      current: currentAvailability,
      errorRatio,
      burnRate,
      series: availabilitySeries,
    },
    queue: {
      depth: queueDepth,
      oldestMinutes,
    },
    exceptions,
  };

  const suspicious: SuspiciousUser[] = [];
  for (const [userId, timestamps] of suspiciousUploadWindows.entries()) {
    if (timestamps.length <= 50) {
      continue;
    }
    const sorted = timestamps.sort((a, b) => a.getTime() - b.getTime());
    let start = 0;
    for (let end = 0; end < sorted.length; end += 1) {
      while (sorted[end]!.getTime() - sorted[start]!.getTime() > 10 * MINUTE_MS) {
        start += 1;
      }
      const windowCount = end - start + 1;
      if (windowCount >= 50) {
        suspicious.push({
          userId,
          email: userEmails.get(userId) ?? 'unknown',
          uploads: windowCount,
          windowStart: sorted[start]!.toISOString(),
        });
        break;
      }
    }
  }

  let orphanCount = 0;
  try {
    const entries = await fs.readdir(env.UPLOAD_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        orphanCount += 1;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      throw error;
    }
  }

  const dbActivityCount = await prisma.activity.count();
  const safety: SafetySummary = {
    suspicious: suspicious.slice(0, 20),
    storage: {
      orphanCount,
      dbActivityCount,
      scannedAt: now.toISOString(),
    },
  };

  const totalFeatureClicks = Array.from(featureClickCounts.values()).reduce((sum, value) => sum + value, 0) || 1;
  const featureClicks: FeatureClickSummary[] = Array.from(featureClickCounts.entries())
    .map(([feature, count]) => ({
      feature,
      count,
      percentage: count / totalFeatureClicks,
    }))
    .sort((a, b) => b.count - a.count);

  const ux: UxSummary = {
    featureClicks,
    emptyStates: {
      rate: emptyStateCounters.total > 0 ? emptyStateCounters.empty / emptyStateCounters.total : 0,
      totalSessions: emptyStateCounters.total,
      emptySessions: emptyStateCounters.empty,
    },
  };

  const recentUploads = metricEvents.filter(
    (event) => event.type === 'upload' && event.createdAt >= tenMinutesAgo,
  );
  const recentUploadDurations = recentUploads
    .filter((event) => event.success && event.durationMs != null)
    .map((event) => event.durationMs ?? 0);
  const recentFailuresTotal = recentUploads.length;
  const recentFailed = recentUploads.filter((event) => event.success === false).length;
  const recentFailureRate = recentFailuresTotal > 0 ? recentFailed / recentFailuresTotal : 0;

  const alerts: AlertSummary = { banners: [] };
  if (recentUploadDurations.length > 0 && percentile(recentUploadDurations, 0.95) > 5000) {
    alerts.banners.push({
      type: 'latency',
      message: 'Upload latency p95 exceeded 5s in the last 10 minutes.',
    });
  }
  if (recentFailureRate > 0.08) {
    alerts.banners.push({
      type: 'quality',
      message: 'Parse failure rate exceeded 8% in the last 10 minutes.',
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    acquisition,
    engagement,
    usage,
    quality,
    performance,
    cohorts,
    conversion,
    reliability,
    safety,
    ux,
    alerts,
  };
}
