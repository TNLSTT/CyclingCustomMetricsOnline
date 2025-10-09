// apps/backend/src/prisma.ts
import { PrismaClient } from '@prisma/client';

import { env } from './env.js';
import { logger } from './logger.js';
import { incrementQuery } from './services/requestContext.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

prisma.$use(async (params, next) => {
  const start = Date.now();
  const result = await next(params);
  incrementQuery(Date.now() - start);
  return result;
});

// Replace the old beforeExit handler with this:
process.on('exit', () => {
  // Let Prisma clean up on process exit; don't await here
  prisma.$disconnect().catch(() => {});
  logger.debug('Prisma disconnected');
});
