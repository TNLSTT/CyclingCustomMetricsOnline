import express from 'express';
import asyncHandler from 'express-async-handler';

import { getTrainingFrontiers } from '../services/trainingFrontiersService.js';

export const trainingFrontiersRouter = express.Router();

trainingFrontiersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const windowParam = req.query.windowDays;
    const windowDays = typeof windowParam === 'string' ? Number(windowParam) : undefined;

    const response = await getTrainingFrontiers(req.user.id, windowDays);
    res.json(response);
  }),
);
