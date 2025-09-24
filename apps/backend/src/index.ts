import fs from 'node:fs';
import path from 'node:path';

import { env } from './env.js';
import { createApp } from './app.js';
import { logger } from './logger.js';

const app = createApp();

const uploadDir = path.resolve(env.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT}`);
});
