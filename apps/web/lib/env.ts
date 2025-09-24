import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .url()
    .default('http://localhost:4000/api'),
  NEXT_INTERNAL_API_URL: z.string().url().optional(),
  NEXT_PUBLIC_AUTH_ENABLED: z
    .enum(['true', 'false'])
    .optional()
    .default('false'),
});

const parsed = envSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_INTERNAL_API_URL: process.env.NEXT_INTERNAL_API_URL,
  NEXT_PUBLIC_AUTH_ENABLED: process.env.NEXT_PUBLIC_AUTH_ENABLED,
});

export const env = {
  apiUrl: parsed.NEXT_PUBLIC_API_URL,
  internalApiUrl: parsed.NEXT_INTERNAL_API_URL ?? parsed.NEXT_PUBLIC_API_URL,
  authEnabled: parsed.NEXT_PUBLIC_AUTH_ENABLED === 'true',
};
