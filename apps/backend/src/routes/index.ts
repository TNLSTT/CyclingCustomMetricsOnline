import express from 'express';

import { activitiesRouter } from './activities.js';
import { metricsRouter } from './metrics.js';
import { uploadRouter } from './upload.js';

export const apiRouter = express.Router();

apiRouter.use('/upload', uploadRouter);
apiRouter.use('/activities', activitiesRouter);
apiRouter.use('/metrics', metricsRouter);
