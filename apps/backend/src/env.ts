import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform((val: string | undefined) => (val ? Number.parseInt(val, 10) : 4000))
    .pipe(z.number().int().min(0)),
  DATABASE_URL: z.string(),
  AUTH_ENABLED: z
    .string()
    .optional()
    .transform((val: string | undefined) => (val ? val.toLowerCase() === 'true' : false)),
  NEXTAUTH_SECRET: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  FRONTEND_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
