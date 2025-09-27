import type { RequestHandler } from 'express';

import { env } from '../env.js';
import { verifyAccessToken } from '../services/authService.js';

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!env.AUTH_ENABLED) {
    next();
    return;
  }

  const authorization = req.headers.authorization;
  if (!authorization || !authorization.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authorization.slice('Bearer '.length);

  try {
    const user = verifyAccessToken(token);
    req.user = user;
    next();
  } catch (_error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
