import type { NextFunction, Request, Response } from 'express';

import { logger } from '../logger.js';
import { recordExceptionEvent } from '../services/telemetryService.js';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const status = (err as { status?: number }).status ?? 500;
  const message =
    (err as { message?: string }).message ?? 'Unexpected server error occurred.';

  if (status >= 500) {
    logger.error({ err }, 'Unhandled error');
  } else {
    logger.warn({ err }, 'Request error');
  }

  void recordExceptionEvent({
    name: err instanceof Error ? err.name : 'Error',
    message,
    stack: err instanceof Error ? err.stack ?? null : null,
    statusCode: status,
    path: req.originalUrl,
    userId: req.user?.id,
  });

  res.status(status).json({ error: message });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found' });
}
