import { z } from 'zod';

import { env } from '../env.js';
import { prisma } from '../prisma.js';
import { recordMetricEvent } from './telemetryService.js';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

const insightMetricSchema = z.object({
  label: z.string(),
  value: z.string(),
  insight: z.string(),
});

const insightReportSchema = z.object({
  overview: z.string(),
  goalProgress: z.string(),
  goalAlignment: z.string(),
  keyMetrics: z.array(insightMetricSchema).min(1).max(6),
  actionItems: z.array(z.string()).min(1).max(5),
});

const sessionOutlineSchema = z.object({
  title: z.string(),
  durationHours: z.number().nullable().optional(),
  intensity: z.string(),
  steps: z.array(z.string()).min(1).max(6),
});

const recommendationSchema = z.object({
  recommendation: z.string(),
  focus: z.string(),
  sessionOutline: sessionOutlineSchema,
  rationale: z.string(),
  reminders: z.array(z.string()).min(1).max(6),
});

const goalTrainingAssessmentSchema = z.object({
  primaryFocus: z.string().min(1).max(80),
  requirement: z.string().min(1).max(400),
  keyDrivers: z.string().min(1).max(400).nullable().optional(),
});

const goalTrainingAssessmentRecordSchema = goalTrainingAssessmentSchema.extend({
  generatedAt: z.string(),
  updatedAt: z.string(),
  modifiedByUser: z.boolean(),
});

const insightReportJsonSchema = {
  name: 'activity_insight_report',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['overview', 'goalProgress', 'goalAlignment', 'keyMetrics', 'actionItems'],
    properties: {
      overview: {
        type: 'string',
        description: 'High-level summary of how the activity went.',
      },
      goalProgress: {
        type: 'string',
        description: 'Explanation of how the ride contributed toward the athlete\'s goals.',
      },
      goalAlignment: {
        type: 'string',
        description: 'Assessment of alignment between current training load and the stated goals.',
      },
      keyMetrics: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['label', 'value', 'insight'],
          properties: {
            label: { type: 'string', description: 'Metric name.' },
            value: { type: 'string', description: 'Metric value with units.' },
            insight: { type: 'string', description: 'Interpretation of the metric.' },
          },
        },
      },
      actionItems: {
        type: 'array',
        minItems: 1,
        maxItems: 5,
        items: {
          type: 'string',
          description: 'Concrete follow-up actions for the athlete.',
        },
      },
    },
  },
} as const;

const recommendationJsonSchema = {
  name: 'activity_insight_recommendation',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['recommendation', 'focus', 'sessionOutline', 'rationale', 'reminders'],
    properties: {
      recommendation: {
        type: 'string',
        description: 'Overview of what the athlete should do tomorrow.',
      },
      focus: {
        type: 'string',
        description: 'Primary training focus for the next session.',
      },
      sessionOutline: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'intensity', 'steps'],
        properties: {
          title: { type: 'string', description: 'Name of the proposed session.' },
          durationHours: {
            type: ['number', 'null'],
            description: 'Approximate ride duration in hours.',
          },
          intensity: { type: 'string', description: 'Intensity anchor or power zone.' },
          steps: {
            type: 'array',
            minItems: 1,
            maxItems: 6,
            items: { type: 'string', description: 'Ordered steps for the workout.' },
          },
        },
      },
      rationale: {
        type: 'string',
        description: 'Reasoning behind the recommendation.',
      },
      reminders: {
        type: 'array',
        minItems: 1,
        maxItems: 6,
        items: {
          type: 'string',
          description: 'Additional tips, fueling notes, or recovery reminders.',
        },
      },
    },
  },
} as const;

const goalTrainingAssessmentJsonSchema = {
  name: 'goal_training_assessment',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['primaryFocus', 'requirement'],
    properties: {
      primaryFocus: {
        type: 'string',
        description: 'The primary training quality or system the athlete must develop for their goals.',
      },
      requirement: {
        type: 'string',
        description: 'One to two sentence summary that links the athlete\'s goals to the required training focus.',
      },
      keyDrivers: {
        type: ['string', 'null'],
        description:
          'Optional brief explanation of what most influences development of the required focus (sessions, intensities, or volume).',
      },
    },
  },
} as const;

export class ActivityInsightError extends Error {}

export class MissingOpenAiKeyError extends ActivityInsightError {
  constructor() {
    super('OpenAI API key is not configured on the server.');
  }
}

export class ActivityInsightNotFoundError extends ActivityInsightError {
  constructor() {
    super('Activity not found');
  }
}

export type ActivityInsightReport = z.infer<typeof insightReportSchema>;
export type ActivityInsightRecommendation = z.infer<typeof recommendationSchema>;
type GoalTrainingAssessmentSummary = z.infer<typeof goalTrainingAssessmentSchema>;
export type GoalTrainingAssessmentRecord = z.infer<typeof goalTrainingAssessmentRecordSchema>;

interface ActivityInsightContext {
  activity: {
    id: string;
    name: string | null;
    startTime: string;
    durationMinutes: number;
    distanceKm: number | null;
    averagePower: number | null;
    averageHeartRate: number | null;
    averageCadence: number | null;
    metrics: Array<{ key: string; name: string; summary: unknown }>;
  };
  recentRides: Array<{
    id: string;
    startTime: string;
    durationMinutes: number;
    distanceKm: number | null;
    averagePower: number | null;
    averageHeartRate: number | null;
    averageCadence: number | null;
  }>;
  sixWeekSummary: {
    totalRides: number;
    totalDurationHours: number;
    totalDistanceKm: number;
    averageWeeklyDurationHours: number;
    weekly: Array<{
      weekStart: string;
      rides: number;
      durationHours: number;
      distanceKm: number;
    }>;
  };
  goals: Array<Record<string, unknown>>;
  goalTrainingAssessment: GoalTrainingAssessmentRecord | null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toKm(value: unknown): number | null {
  if (isNumber(value)) {
    return Number((value / 1000).toFixed(2));
  }
  return null;
}

function minutesFromSeconds(value: unknown): number {
  if (isNumber(value)) {
    return Number((value / 60).toFixed(2));
  }
  return 0;
}

function hoursFromSeconds(value: number): number {
  return Number((value / 3600).toFixed(2));
}

function sanitizeGoalList(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => entry);
}

export function parseGoalTrainingAssessment(value: unknown): GoalTrainingAssessmentRecord | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const parsed = goalTrainingAssessmentRecordSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  return {
    primaryFocus: parsed.data.primaryFocus,
    requirement: parsed.data.requirement,
    keyDrivers: parsed.data.keyDrivers ?? null,
    generatedAt: parsed.data.generatedAt,
    updatedAt: parsed.data.updatedAt,
    modifiedByUser: parsed.data.modifiedByUser,
  } satisfies GoalTrainingAssessmentRecord;
}

function startOfIsoWeek(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = result.getUTCDay();
  const isoDay = day === 0 ? 7 : day;
  result.setUTCDate(result.getUTCDate() - (isoDay - 1));
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

async function buildInsightContext(activityId: string, userId?: string): Promise<ActivityInsightContext> {
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
    throw new ActivityInsightNotFoundError();
  }

  const targetUserId = activity.userId ?? userId ?? undefined;

  const [recentRides, sixWeekRides, profile] = await Promise.all([
    prisma.activity.findMany({
      where: targetUserId ? { userId: targetUserId } : { userId: activity.userId },
      orderBy: { startTime: 'desc' },
      take: 10,
      select: {
        id: true,
        startTime: true,
        durationSec: true,
        distanceMeters: true,
        averagePower: true,
        averageHeartRate: true,
        averageCadence: true,
      },
    }),
    prisma.activity.findMany({
      where: {
        ...(targetUserId ? { userId: targetUserId } : { userId: activity.userId }),
        startTime: {
          gte: new Date(activity.startTime.getTime() - 1000 * 60 * 60 * 24 * 7 * 6),
          lte: activity.startTime,
        },
      },
      select: {
        id: true,
        startTime: true,
        durationSec: true,
        distanceMeters: true,
      },
    }),
    activity.userId
      ? prisma.profile.findUnique({
          where: { userId: activity.userId },
          select: { goals: true, goalTrainingAssessment: true },
        })
      : null,
  ]);

  const weeklyMap = new Map<string, { rides: number; durationSec: number; distanceMeters: number }>();
  let totalDurationSec = 0;
  let totalDistanceMeters = 0;

  for (const ride of sixWeekRides) {
    const weekStart = startOfIsoWeek(ride.startTime).toISOString();
    const existing = weeklyMap.get(weekStart) ?? { rides: 0, durationSec: 0, distanceMeters: 0 };
    existing.rides += 1;
    if (isNumber(ride.durationSec)) {
      existing.durationSec += ride.durationSec;
      totalDurationSec += ride.durationSec;
    }
    if (isNumber(ride.distanceMeters)) {
      existing.distanceMeters += ride.distanceMeters;
      totalDistanceMeters += ride.distanceMeters;
    }
    weeklyMap.set(weekStart, existing);
  }

  const weekly = Array.from(weeklyMap.entries())
    .map(([weekStart, data]) => ({
      weekStart,
      rides: data.rides,
      durationHours: hoursFromSeconds(data.durationSec),
      distanceKm: Number((data.distanceMeters / 1000).toFixed(2)),
    }))
    .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());

  const weeksCovered = Math.max(weekly.length, 1);

  const recentRidesContext = recentRides.map((ride) => ({
    id: ride.id,
    startTime: ride.startTime.toISOString(),
    durationMinutes: minutesFromSeconds(ride.durationSec),
    distanceKm: toKm(ride.distanceMeters),
    averagePower: isNumber(ride.averagePower) ? Number(ride.averagePower.toFixed(0)) : null,
    averageHeartRate: isNumber(ride.averageHeartRate)
      ? Number(ride.averageHeartRate.toFixed(0))
      : null,
    averageCadence: isNumber(ride.averageCadence) ? Number(ride.averageCadence.toFixed(0)) : null,
  }));

  const sanitizedGoals = sanitizeGoalList(profile?.goals ?? []);
  let goalTrainingAssessment = parseGoalTrainingAssessment(profile?.goalTrainingAssessment ?? null);

  if (!goalTrainingAssessment && activity.userId && sanitizedGoals.length > 0) {
    goalTrainingAssessment = await generateGoalTrainingAssessment({
      userId: activity.userId,
      goals: sanitizedGoals,
    });
  }

  return {
    activity: {
      id: activity.id,
      name: typeof activity.name === 'string' ? activity.name : null,
      startTime: activity.startTime.toISOString(),
      durationMinutes: minutesFromSeconds(activity.durationSec),
      distanceKm: toKm(activity.distanceMeters),
      averagePower: isNumber(activity.averagePower) ? Number(activity.averagePower.toFixed(0)) : null,
      averageHeartRate: isNumber(activity.averageHeartRate)
        ? Number(activity.averageHeartRate.toFixed(0))
        : null,
      averageCadence: isNumber(activity.averageCadence) ? Number(activity.averageCadence.toFixed(0)) : null,
      metrics: activity.metrics.map((metric) => ({
        key: metric.metricDefinition.key,
        name: metric.metricDefinition.name,
        summary: metric.summary,
      })),
    },
    recentRides: recentRidesContext,
    sixWeekSummary: {
      totalRides: sixWeekRides.length,
      totalDurationHours: hoursFromSeconds(totalDurationSec),
      totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(2)),
      averageWeeklyDurationHours: Number((hoursFromSeconds(totalDurationSec) / weeksCovered).toFixed(2)),
      weekly,
    },
    goals: sanitizedGoals,
    goalTrainingAssessment,
  } satisfies ActivityInsightContext;
}

async function generateGoalTrainingAssessment({
  userId,
  goals,
}: {
  userId: string;
  goals: Array<Record<string, unknown>>;
}): Promise<GoalTrainingAssessmentRecord | null> {
  if (goals.length === 0) {
    return null;
  }

  const prompt =
    'Analyze the athlete\'s stated goals. Identify the primary training focus required to excel and summarize why that focus matters. Keep the tone like a coach. Return concise statements.';

  const content = await callOpenAi({
    prompt,
    context: { goals },
    schema: goalTrainingAssessmentJsonSchema,
  });

  const parsed = goalTrainingAssessmentSchema.parse(JSON.parse(content)) as GoalTrainingAssessmentSummary;
  const timestamp = new Date().toISOString();

  const record: GoalTrainingAssessmentRecord = {
    primaryFocus: parsed.primaryFocus,
    requirement: parsed.requirement,
    keyDrivers: parsed.keyDrivers ?? null,
    generatedAt: timestamp,
    updatedAt: timestamp,
    modifiedByUser: false,
  } satisfies GoalTrainingAssessmentRecord;

  await prisma.profile.update({
    where: { userId },
    data: { goalTrainingAssessment: record },
  });

  return record;
}

async function callOpenAi({
  prompt,
  context,
  schema,
}: {
  prompt: string;
  context: unknown;
  schema:
    | typeof insightReportJsonSchema
    | typeof recommendationJsonSchema
    | typeof goalTrainingAssessmentJsonSchema;
}): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new MissingOpenAiKeyError();
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_API_MODEL ?? 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_schema', json_schema: schema },
      messages: [
        {
          role: 'system',
          content:
            'You are a performance cycling coach. Provide clear, concise insights and actionable recommendations grounded in the supplied data.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `${prompt}\n\nContext JSON:\n${JSON.stringify(context, null, 2)}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = typeof error?.error?.message === 'string' ? error.error.message : 'OpenAI request failed';
    throw new ActivityInsightError(message);
  }

  const completion = await response.json();
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new ActivityInsightError('OpenAI response did not include content.');
  }
  return content;
}

export async function generateActivityInsightReport(activityId: string, userId?: string) {
  const context = await buildInsightContext(activityId, userId);

  const prompt =
    'Create a post-ride insight report. Summarize the ride, highlight how it contributed toward the athlete\'s stated goals, and call out the most relevant metrics from the activity and recent training. Provide concise, coach-like guidance.';

  const content = await callOpenAi({ prompt, context, schema: insightReportJsonSchema });
  const parsed = insightReportSchema.parse(JSON.parse(content));
  const generatedAt = new Date();

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      insightReport: parsed,
      insightReportGeneratedAt: generatedAt,
    },
    select: {
      id: true,
      insightReport: true,
      insightReportGeneratedAt: true,
    },
  });

  await recordMetricEvent({
    type: 'activity_insight_report',
    userId,
    activityId,
    success: true,
  });

  return {
    activityId: updated.id,
    report: parsed,
    goalTrainingAssessment: context.goalTrainingAssessment ?? null,
    generatedAt: updated.insightReportGeneratedAt?.toISOString() ?? generatedAt.toISOString(),
  };
}

export async function generateActivityRecommendation(activityId: string, userId?: string) {
  const context = await buildInsightContext(activityId, userId);

  const prompt =
    'Recommend what the athlete should focus on tomorrow. Suggest a session that best advances their goals given the recent workload, highlighting the key focus, structure, and rationale.';

  const content = await callOpenAi({ prompt, context, schema: recommendationJsonSchema });
  const parsed = recommendationSchema.parse(JSON.parse(content));
  const generatedAt = new Date();

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      insightRecommendation: parsed,
      insightRecommendationGeneratedAt: generatedAt,
    },
    select: {
      id: true,
      insightRecommendation: true,
      insightRecommendationGeneratedAt: true,
    },
  });

  await recordMetricEvent({
    type: 'activity_insight_recommendation',
    userId,
    activityId,
    success: true,
  });

  return {
    activityId: updated.id,
    recommendation: parsed,
    generatedAt: updated.insightRecommendationGeneratedAt?.toISOString() ?? generatedAt.toISOString(),
  };
}

