import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : 4000))
    .pipe(z.number().int().min(0)),
  DATABASE_URL: z.string(),
  AUTH_ENABLED: z
    .string()
    .optional()
    .transform((val) => (val ? val.toLowerCase() === 'true' : false)),
  NEXTAUTH_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  FRONTEND_URL: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

const jwtSecret = parsed.data.JWT_SECRET ?? parsed.data.NEXTAUTH_SECRET;

if (!jwtSecret) {
  throw new Error('JWT_SECRET or NEXTAUTH_SECRET must be provided');
}

export const env = {
  ...parsed.data,
  JWT_SECRET: jwtSecret,
};
