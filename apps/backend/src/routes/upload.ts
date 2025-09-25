import fs from 'node:fs/promises';

import express from 'express';
import asyncHandler from 'express-async-handler';
import multer from 'multer';

import { env } from '../env.js';
import { logger } from '../logger.js';
import { ingestFitFile } from '../services/ingestService.js';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs
      .mkdir(env.UPLOAD_DIR, { recursive: true })
      .then(() => cb(null, env.UPLOAD_DIR))
      .catch((error: unknown) => cb(error as Error, env.UPLOAD_DIR));
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  },
});

function fitFileFilter(
  _req: express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  if (!file.originalname.toLowerCase().endsWith('.fit')) {
    cb(new Error('Only .fit files are supported'));
    return;
  }
  cb(null, true);
}

const upload = multer({ storage, fileFilter: fitFileFilter });

export const uploadRouter = express.Router();

uploadRouter.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'FIT file is required.' });
      return;
    }

    try {
      const { activity } = await ingestFitFile(file.path);
      res.status(201).json({ activityId: activity.id });
    } catch (error) {
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        logger.warn({ cleanupError }, 'Failed to remove uploaded file after error');
      }
      throw error;
    }
  }),
);
