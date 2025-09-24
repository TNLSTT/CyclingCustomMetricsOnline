import { parseFitFile } from '../parsers/fit.js';
import { saveActivity } from './activityService.js';

export async function ingestFitFile(filePath: string, userId?: string) {
  const normalized = await parseFitFile(filePath);
  const activity = await saveActivity(normalized, userId);

  return { activity, normalized };
}
