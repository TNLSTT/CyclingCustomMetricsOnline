import express from 'express';

import { listMetricDefinitions } from '../metrics/registry.js';

export const metricsRouter = express.Router();

metricsRouter.get('/', (_req, res) => {
  res.json({ definitions: listMetricDefinitions() });
});
