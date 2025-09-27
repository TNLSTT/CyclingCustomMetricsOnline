import express from 'express';

import { activitiesRouter } from './activities.js';
import { authRouter } from './auth.js';
import { metricsRouter } from './metrics.js';
import { uploadRouter } from './upload.js';
import { requireAuth } from '../middleware/auth.js';

export const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/upload', requireAuth, uploadRouter);
apiRouter.use('/activities', requireAuth, activitiesRouter);
apiRouter.use('/metrics', requireAuth, metricsRouter);
