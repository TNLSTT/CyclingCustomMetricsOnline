import { PrismaClient } from '@prisma/client';

import { env } from './env.js';
import { logger } from './logger.js';

export const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.debug('Prisma disconnected');
});
