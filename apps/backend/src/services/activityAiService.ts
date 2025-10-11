import type { Prisma, Profile } from '@prisma/client';

import { env } from '../env.js';
import { logger } from '../logger.js';
import { prisma } from '../prisma.js';

const DEFAULT_MODEL = env.OPENAI_MODEL ?? 'gpt-4o-mini';

type ActivityWithMetrics = Prisma.ActivityGetPayload<{
  include: {
    metrics: {
      include: {
        metricDefinition: true;
      };
    };
  };
}>;

type JsonValue = Prisma.JsonValue;

export interface ActivityAiMessage {
  content: string;
  model?: string | null;
  usage?: {
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
  } | null;
}

export interface ActivityAiResult {
  activityId: string;
  generatedAt: Date;
  message: ActivityAiMessage;
}

export class MissingOpenAiKeyError extends Error {
  constructor() {
    super('OpenAI API key is not configured');
    this.name = 'MissingOpenAiKeyError';
  }
}

export class ActivityNotFoundError extends Error {
  constructor() {
    super('Activity not found');
    this.name = 'ActivityNotFoundError';
  }
}

type GenerationType = 'insight' | 'recommendation';

type SixWeekActivity = { startTime: Date; durationSec: number };

type ActivityContext = {
  currentActivity: ReturnType<typeof mapActivityForContext>;
  recentActivities: {
    summary: ReturnType<typeof summarizeDurations>;
    activities: ReturnType<typeof mapActivityForContext>[];
  };
  sixWeekSummary: ReturnType<typeof summarizeSixWeeks>;
  profile: ReturnType<typeof mapProfileForContext> | null;
};

function mapProfileForContext(profile: Profile | null): {
  trainingFocus?: string | null;
  primaryDiscipline?: string | null;
  weeklyGoalHours?: number | null;
  goals?: JsonValue | null;
  strengths?: string | null;
  weaknesses?: string | null;
} | null {
  if (!profile) {
    return null;
  }

  return {
    trainingFocus: profile.trainingFocus ?? null,
    primaryDiscipline: profile.primaryDiscipline ?? null,
    weeklyGoalHours: profile.weeklyGoalHours ?? null,
    goals: profile.goals ?? null,
    strengths: profile.strengths ?? null,
    weaknesses: profile.weaknesses ?? null,
  };
}

type ExtendedActivity = ActivityWithMetrics & {
  name?: string | null;
  distanceMeters?: number | null;
  totalElevationGain?: number | null;
  averagePower?: number | null;
  averageHeartRate?: number | null;
  averageCadence?: number | null;
};

function mapActivityForContext(activity: ActivityWithMetrics): {
  id: string;
  source: string;
  startTime: string;
  durationSec: number;
  sampleRateHz: number | null;
  name: string | null;
  distanceMeters: number | null;
  totalElevationGain: number | null;
  averagePower: number | null;
  averageHeartRate: number | null;
  averageCadence: number | null;
  metrics: Array<{
    key: string;
    name: string;
    version: number;
    units: string | null;
    description: string;
    computedAt: string;
    summary: JsonValue;
  }>;
} {
  const extended = activity as ExtendedActivity;
  return {
    id: activity.id,
    source: activity.source,
    startTime: activity.startTime.toISOString(),
    durationSec: activity.durationSec,
    sampleRateHz: activity.sampleRateHz ?? null,
    name: extended.name ?? null,
    distanceMeters: extended.distanceMeters ?? null,
    totalElevationGain: extended.totalElevationGain ?? null,
    averagePower: extended.averagePower ?? null,
    averageHeartRate: extended.averageHeartRate ?? null,
    averageCadence: extended.averageCadence ?? null,
    metrics: (activity.metrics ?? []).map((metric) => ({
      key: metric.metricDefinition.key,
      name: metric.metricDefinition.name,
      version: metric.metricDefinition.version,
      units: metric.metricDefinition.units ?? null,
      description: metric.metricDefinition.description,
      computedAt: metric.computedAt.toISOString(),
      summary: metric.summary,
    })),
  };
}

function summarizeDurations(durations: number[]): {
  count: number;
  totalDurationSec: number;
  averageDurationSec: number | null;
  medianDurationSec: number | null;
  longestDurationSec: number | null;
  shortestDurationSec: number | null;
} {
  if (durations.length === 0) {
    return {
      count: 0,
      totalDurationSec: 0,
      averageDurationSec: null,
      medianDurationSec: null,
      longestDurationSec: null,
      shortestDurationSec: null,
    };
  }

  const totalDurationSec = durations.reduce((sum, value) => sum + value, 0);
  const sorted = [...durations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianDurationSec =
    sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;

  return {
    count: durations.length,
    totalDurationSec,
    averageDurationSec: totalDurationSec / durations.length,
    medianDurationSec,
    longestDurationSec: sorted[sorted.length - 1] ?? null,
    shortestDurationSec: sorted[0] ?? null,
  };
}

function summarizeSixWeeks(activities: SixWeekActivity[], reference: ActivityWithMetrics) {
  const sixWeeksAgo = new Date(reference.startTime.getTime());
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

  const relevant = activities.filter((activity) => activity.startTime >= sixWeeksAgo);
  const durations = relevant.map((activity) => activity.durationSec);
  const durationSummary = summarizeDurations(durations);
  const totalHours = durationSummary.totalDurationSec / 3600;
  const averageWeeklyHours = totalHours / 6;

  return {
    windowStart: sixWeeksAgo.toISOString(),
    windowEnd: reference.startTime.toISOString(),
    ...durationSummary,
    totalHours,
    averageWeeklyHours,
  };
}

function buildContext(
  activity: ActivityWithMetrics,
  recentActivities: ActivityWithMetrics[],
  sixWeekActivities: SixWeekActivity[],
  profile: Profile | null,
): ActivityContext {
  const durations = recentActivities.map((entry) => entry.durationSec);
  const recentSummary = summarizeDurations(durations);

  return {
    currentActivity: mapActivityForContext(activity),
    recentActivities: {
      summary: recentSummary,
      activities: recentActivities.map((entry) => mapActivityForContext(entry)),
    },
    sixWeekSummary: summarizeSixWeeks(sixWeekActivities, activity),
    profile: mapProfileForContext(profile),
  };
}

function buildPrompt(context: ActivityContext, type: GenerationType): string {
  const sharedInstructions = `You are an experienced cycling coach and physiologist who specialises in endurance training and translating power and heart-rate analytics into athlete-friendly feedback. Use ONLY the provided data to draw conclusions. When you reference a number, cite whether it comes from the current ride, the recent ride summary, or the six-week aggregate. Avoid speculating beyond the supplied information.`;

  const task =
    type === 'insight'
      ? `Explain how the latest ride supports or hinders the athlete's stated goals. Connect the ride metrics to the 6-week training load and highlight trends from the last 10 rides. Provide:
- A short summary paragraph focused on goal progress.
- 3 concise bullet points calling out specific metrics or comparisons.
- One practical focus item for the next ride that is grounded in the data.
If the profile includes goals or weekly hour targets, explicitly mention whether the athlete is on track.`
      : `Recommend what the athlete should focus on tomorrow to stay aligned with their goals. Consider fatigue risk from the six-week workload, any gaps relative to weekly hour goals, and notable trends from recent rides. Provide:
- A headline recommendation.
- 3 bullet points describing suggested intensity, duration, or skills, each backed by data.
- A cautionary note if the data signals potential overreaching or undertraining.`;

  const formatting =
    type === 'insight'
      ? 'Format the response in Markdown with a level-3 heading "Ride Insight" followed by the summary paragraph, a bullet list titled "Key Takeaways", and finish with a bolded "Next Focus" line.'
      : 'Format the response in Markdown with a level-3 heading "Tomorrow\'s Plan", followed by the headline recommendation in bold, a bullet list titled "Action Items", and finish with an italicized cautionary or encouragement sentence.';

  return [
    sharedInstructions,
    task,
    formatting,
    'Context JSON:',
    JSON.stringify(context, null, 2),
  ].join('\n\n');
}

async function callOpenAi(prompt: string, type: GenerationType) {
  if (!env.OPENAI_API_KEY) {
    throw new MissingOpenAiKeyError();
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'You are a precise cycling coach assistant. Stick to provided data and respond in Markdown.',
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      temperature: type === 'recommendation' ? 0.7 : 0.4,
    }),
  });

  let payload: {
    model?: string;
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
    error?: { message?: string };
  };

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error('Failed to parse OpenAI response');
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  let content = typeof payload.output_text === 'string' ? payload.output_text : '';

  if (!content && Array.isArray(payload.output)) {
    for (const entry of payload.output) {
      if (!entry?.content) {
        continue;
      }
      for (const part of entry.content) {
        if (typeof part?.text === 'string' && part.text.trim().length > 0) {
          content += part.text;
        }
      }
    }
  }

  if (!content || !content.trim()) {
    throw new Error('OpenAI returned an empty response');
  }

  const usage = payload.usage
    ? {
        promptTokens: payload.usage.prompt_tokens ?? null,
        completionTokens: payload.usage.completion_tokens ?? null,
        totalTokens: payload.usage.total_tokens ?? null,
      }
    : null;

  return {
    content,
    model: payload.model ?? DEFAULT_MODEL,
    usage,
  } satisfies ActivityAiMessage;
}

async function fetchActivityWithContext(activityId: string, userId?: string | null) {
  const activity = await prisma.activity.findFirst({
    where: { id: activityId, ...(userId ? { userId } : {}) },
    include: {
      metrics: {
        include: { metricDefinition: true },
        orderBy: { computedAt: 'desc' },
      },
    },
  });

  if (!activity) {
    throw new ActivityNotFoundError();
  }

  const userProfile = activity.userId
    ? await prisma.profile.findUnique({ where: { userId: activity.userId } })
    : null;

  const recentActivities = activity.userId
    ? await prisma.activity.findMany({
        where: { userId: activity.userId },
        orderBy: { startTime: 'desc' },
        take: 10,
        include: {
          metrics: {
            include: { metricDefinition: true },
            orderBy: { computedAt: 'desc' },
          },
        },
      })
    : [activity];

  const sixWeeksAgo = new Date(activity.startTime.getTime());
  sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

  const sixWeekActivities: SixWeekActivity[] = activity.userId
    ? await prisma.activity.findMany({
        where: { userId: activity.userId, startTime: { gte: sixWeeksAgo } },
        orderBy: { startTime: 'desc' },
        select: { startTime: true, durationSec: true },
      })
    : [
        {
          startTime: activity.startTime,
          durationSec: activity.durationSec,
        },
      ];

  if (!recentActivities.some((entry) => entry.id === activity.id)) {
    recentActivities.push(activity);
  }

  return { activity, profile: userProfile, recentActivities, sixWeekActivities };
}

async function persistResult(
  activityId: string,
  type: GenerationType,
  message: ActivityAiMessage,
) {
  const data: Prisma.ActivityUpdateInput =
    type === 'insight'
      ? {
          aiInsight: message,
          aiInsightGeneratedAt: new Date(),
        }
      : {
          aiRecommendation: message,
          aiRecommendationGeneratedAt: new Date(),
        };

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data,
    select: {
      id: true,
      aiInsight: true,
      aiInsightGeneratedAt: true,
      aiRecommendation: true,
      aiRecommendationGeneratedAt: true,
    },
  });

  const generatedAt =
    type === 'insight' ? updated.aiInsightGeneratedAt : updated.aiRecommendationGeneratedAt;

  return {
    activityId,
    generatedAt: generatedAt ?? new Date(),
    message,
  } satisfies ActivityAiResult;
}

export async function generateActivityNarrative(
  activityId: string,
  type: GenerationType,
  userId?: string | null,
): Promise<ActivityAiResult> {
  if (!env.OPENAI_API_KEY) {
    throw new MissingOpenAiKeyError();
  }

  const { activity, profile, recentActivities, sixWeekActivities } = await fetchActivityWithContext(
    activityId,
    userId,
  );
  const context = buildContext(activity, recentActivities, sixWeekActivities, profile);
  const prompt = buildPrompt(context, type);

  const start = Date.now();
  try {
    const message = await callOpenAi(prompt, type);
    const result = await persistResult(activityId, type, message);
    logger.info(
      {
        activityId,
        type,
        durationMs: Date.now() - start,
        model: message.model,
        promptTokens: message.usage?.promptTokens ?? null,
        completionTokens: message.usage?.completionTokens ?? null,
      },
      'Generated activity AI narrative',
    );
    return result;
  } catch (error) {
    logger.error({ err: error, activityId, type }, 'Failed to generate activity AI narrative');
    throw error;
  }
}
