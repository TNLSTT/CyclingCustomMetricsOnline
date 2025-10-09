import type { NextFunction, Request, Response } from 'express';

import { recordPageView } from '../services/telemetryService.js';

const EXCLUDED_PREFIXES = ['/health', '/auth'];

export function pageViewMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'GET' && !EXCLUDED_PREFIXES.some((prefix) => req.path.startsWith(prefix))) {
    void recordPageView({
      userId: req.user?.id,
      path: req.originalUrl ?? req.path,
    });
  }
  next();
}
