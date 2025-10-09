import express from 'express';
import asyncHandler from 'express-async-handler';
import { z } from 'zod';

import { env } from '../env.js';
import { authenticateUser, registerUser } from '../services/authService.js';

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const registerSchema = credentialsSchema.extend({
  utmSource: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export const authRouter = express.Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    if (!env.AUTH_ENABLED) {
      res.status(400).json({ error: 'Authentication is disabled' });
      return;
    }

    const parsedBody = registerSchema.parse(req.body);
    const fallbackSource =
      typeof req.query.utm_source === 'string' ? req.query.utm_source : undefined;
    const utmSource = parsedBody.utmSource ?? fallbackSource ?? req.header('x-utm-source') ?? undefined;
    try {
      const result = await registerUser(parsedBody.email.toLowerCase(), parsedBody.password, utmSource);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    if (!env.AUTH_ENABLED) {
      res.status(400).json({ error: 'Authentication is disabled' });
      return;
    }

    const { email, password } = credentialsSchema.parse(req.body);

    try {
      const result = await authenticateUser(email.toLowerCase(), password);
      res.status(200).json(result);
    } catch (error) {
      res.status(401).json({ error: (error as Error).message });
    }
  }),
);
