declare module '@prisma/client' {
  export namespace Prisma {
    type JsonValue = unknown;
    // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
    interface JsonObject {
      [key: string]: JsonValue;
    }
    type InputJsonValue = JsonValue;
    type NullableJsonNullValueInput = null;
    const JsonNull: null;
    class PrismaClientKnownRequestError extends Error {
      code: string;
    }
    type ActivityWhereInput = Record<string, unknown>;
    type ActivityGetPayload<_T = unknown> = any;
    type ActivityCreateInput = any;
    type ActivitySampleCreateManyInput = any;
  }

  export type Activity = {
    id: string;
    userId: string | null;
    source: string;
    startTime: Date;
    durationSec: number;
    sampleRateHz: number | null;
    createdAt: Date;
  };

  export type Profile = {
    id: string;
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    primaryDiscipline: string | null;
    trainingFocus: string | null;
    weeklyGoalHours: number | null;
    ftpWatts: number | null;
    weightKg: number | null;
    hrMaxBpm: number | null;
    hrRestBpm: number | null;
    websiteUrl: string | null;
    instagramHandle: string | null;
    achievements: string | null;
    events: Record<string, unknown> | unknown[] | null;
    goals: Record<string, unknown> | unknown[] | null;
    strengths: string | null;
    weaknesses: string | null;
    goalTrainingAssessment: Record<string, unknown> | null;
    analytics: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
  };

  export class PrismaClient {
    constructor(...args: unknown[]);
    $transaction<T>(fn: (client: this) => Promise<T>): Promise<T>;
    $disconnect(): Promise<void>;
    activity: any;
    activitySample: any;
    metricDefinition: any;
    metricResult: any;
    profile: any;
    user: any;
  }
}
