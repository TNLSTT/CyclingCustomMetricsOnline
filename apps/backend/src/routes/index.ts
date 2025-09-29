import express from 'express';

import { requireAuth } from '../middleware/auth.js';

import { activitiesRouter } from './activities.js';
import { authRouter } from './auth.js';
import { metricsRouter } from './metrics.js';
import { profileRouter } from './profile.js';
import { uploadRouter } from './upload.js';
import { durabilityAnalysisRouter } from './durabilityAnalysis.js';

export const apiRouter = express.Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/upload', requireAuth, uploadRouter);
apiRouter.use('/activities', requireAuth, activitiesRouter);
apiRouter.use('/metrics', requireAuth, metricsRouter);
apiRouter.use('/profile', requireAuth, profileRouter);
apiRouter.use('/durability-analysis', requireAuth, durabilityAnalysisRouter);
