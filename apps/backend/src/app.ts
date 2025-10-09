import cors from 'cors';
import express from 'express';

import { env } from './env.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { requestMetricsMiddleware } from './middleware/requestMetrics.js';
import { pageViewMiddleware } from './middleware/pageView.js';
import { authRouter } from './routes/auth.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL ?? true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestMetricsMiddleware);
  app.use(pageViewMiddleware);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter);
  app.use('/api', apiRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
