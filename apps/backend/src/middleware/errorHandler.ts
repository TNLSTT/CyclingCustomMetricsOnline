import type { NextFunction, Request, Response } from 'express';

import { logger } from '../logger.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const status = (err as { status?: number }).status ?? 500;
  const message =
    (err as { message?: string }).message ?? 'Unexpected server error occurred.';

  if (status >= 500) {
    logger.error({ err }, 'Unhandled error');
  } else {
    logger.warn({ err }, 'Request error');
  }

  res.status(status).json({ error: message });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' });
}
