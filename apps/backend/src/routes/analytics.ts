import express from 'express';
import asyncHandler from 'express-async-handler';

import { logger } from '../logger.js';
import { computeAdaptationEdges } from '../services/adaptationEdgesService.js';

export const analyticsRouter = express.Router();

analyticsRouter.get(
  '/adaptation-edges',
  asyncHandler(async (req, res) => {
    const userId = req.user?.id;

    try {
      const summary = await computeAdaptationEdges(userId);
      res.json(summary);
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to compute adaptation edges');
      throw error;
    }
  }),
);
