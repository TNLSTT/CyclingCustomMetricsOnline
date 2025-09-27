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
  upload.any(),
  asyncHandler(async (req, res) => {
    if (env.AUTH_ENABLED && !req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const uploadedFiles = Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : [];
    const fitFiles = uploadedFiles.filter((file) =>
      ['file', 'files'].includes(file.fieldname.toLowerCase()),
    );

    if (fitFiles.length === 0) {
      res.status(400).json({ error: 'At least one FIT file is required.' });
      return;
    }

    const uploads: Array<{ activityId: string; fileName: string }> = [];
    const failures: Array<{ fileName: string; error: string }> = [];

    for (const file of fitFiles) {
      const filePath = file.path;
      try {
        const { activity } = await ingestFitFile(filePath, req.user?.id);
        uploads.push({ activityId: activity.id, fileName: file.originalname });
      } catch (error) {
        failures.push({
          fileName: file.originalname,
          error: error instanceof Error ? error.message : 'Failed to ingest FIT file.',
        });
      } finally {
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          const nodeError = cleanupError as NodeJS.ErrnoException;
          if (nodeError?.code !== 'ENOENT') {
            logger.warn({ cleanupError }, 'Failed to remove uploaded file after processing');
          }
        }
      }
    }

    const statusCode = uploads.length > 0 ? 201 : 400;
    res.status(statusCode).json({ uploads, failures });
  }),
);
