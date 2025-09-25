import { Prisma } from '@prisma/client';

export function normalizeNullableJson(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

export function normalizeSummaryJson(summary: Record<string, unknown>): Prisma.JsonObject {
  return summary as Prisma.JsonObject;
}
