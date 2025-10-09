import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

import { recordApiRequestMetric } from '../services/telemetryService.js';
import { runWithRequestContext } from '../services/requestContext.js';

export function requestMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const context = {
    id: randomUUID(),
    path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
    method: req.method,
    userId: req.user?.id,
    startedAt: Date.now(),
    queryCount: 0,
    totalQueryDurationMs: 0,
  };

  runWithRequestContext(context, () => {
    res.on('finish', () => {
      const duration = Date.now() - context.startedAt;
      const avgQueryDuration = context.queryCount > 0 ? context.totalQueryDurationMs / context.queryCount : 0;
      void recordApiRequestMetric({
        method: context.method,
        path: context.path,
        statusCode: res.statusCode,
        durationMs: duration,
        queryCount: context.queryCount,
        avgQueryDurationMs: avgQueryDuration,
        userId: context.userId,
      });
    });
    next();
  });
}
