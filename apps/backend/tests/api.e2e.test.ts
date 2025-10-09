import fs from 'node:fs/promises';

import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { env } from '../src/env.js';
import { createApp } from '../src/app.js';
import type { NormalizedActivity } from '../src/types.js';
import { db } from './setup';

function buildNormalizedActivity(): NormalizedActivity {
  const samples: NormalizedActivity['samples'] = [];
  const cadenceBuckets = [
    { cadence: 60, heartRate: 120 },
    { cadence: 80, heartRate: 130 },
    { cadence: 100, heartRate: 140 },
    { cadence: 120, heartRate: 150 },
  ];
  let t = 0;
  const baseLatitude = 47.6062;
  const baseLongitude = -122.3321;
  for (const bucket of cadenceBuckets) {
    for (let i = 0; i < 60; i += 1) {
      const latitude = Number.parseFloat((baseLatitude + t * 0.00005).toFixed(6));
      const longitude = Number.parseFloat((baseLongitude - t * 0.00005).toFixed(6));
      samples.push({
        t,
        cadence: bucket.cadence,
        heartRate: bucket.heartRate + (i % 3),
        power: 200 + bucket.cadence / 2 + (i % 5),
        speed: null,
        elevation: null,
        temperature: 25 + bucket.cadence / 100,
        latitude,
        longitude,
      });
      t += 1;
    }
  }

  return {
    source: 'garmin-fit',
    startTime: new Date('2024-01-01T00:00:00Z'),
    durationSec: samples[samples.length - 1]?.t ?? 0,
    sampleRateHz: 1,
    samples,
  };
}

vi.mock('../src/services/ingestService.js', () => ({
  ingestFitFile: vi.fn(async (_filePath: string, userId?: string) => {
    const { saveActivity } = await import('../src/services/activityService.js');
    const normalized = buildNormalizedActivity();
    const activity = await saveActivity(normalized, userId);
    return { activity, normalized };
  }),
}));

const app = createApp();
const fixturePath = new URL('./fixtures/mock.fit', import.meta.url).pathname;
const authToken = jwt.sign(
  { sub: 'test-user', email: 'test@example.com', role: 'USER' },
  process.env.JWT_SECRET ?? 'test-secret',
);

describe('Activities API flow', () => {
  let unlinkSpy: MockInstance<Parameters<typeof fs.unlink>, ReturnType<typeof fs.unlink>>;

  beforeEach(() => {
    vi.clearAllMocks();
    unlinkSpy = vi.spyOn(fs, 'unlink').mockResolvedValue(undefined);
  });

  afterEach(() => {
    unlinkSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('ingests, computes metrics, and retrieves results', async () => {
    expect(env.AUTH_ENABLED).toBe(true);

    const uploadResponse = await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${authToken}`)
      .attach('files', fixturePath)
      .attach('files', fixturePath);

    expect(uploadResponse.status).toBe(201);
    expect(Array.isArray(uploadResponse.body.uploads)).toBe(true);
    expect(uploadResponse.body.uploads).toHaveLength(1);
    expect(Array.isArray(uploadResponse.body.failures)).toBe(true);
    expect(uploadResponse.body.failures).toHaveLength(1);
    expect(uploadResponse.body.failures[0]?.error).toContain('same start time and duration');

    const activityId = uploadResponse.body.uploads[0]?.activityId;
    expect(activityId).toBeDefined();
    const savedActivity = db.activities.get(activityId!);
    expect(savedActivity?.userId).toBe('test-user');

    const computeResponse = await request(app)
      .post(`/api/activities/${activityId}/compute`)
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(computeResponse.status, `Compute failed: ${JSON.stringify(computeResponse.body)}`).toBe(200);
    expect(computeResponse.body.results.hcsr).toBeDefined();
    expect(computeResponse.body.results['interval-efficiency']).toBeDefined();

    const detailResponse = await request(app)
      .get(`/api/activities/${activityId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.metrics.length).toBeGreaterThan(0);

    const metricResponse = await request(app)
      .get(`/api/activities/${activityId}/metrics/hcsr`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(metricResponse.status).toBe(200);
    expect(metricResponse.body.summary.slope_bpm_per_rpm).toBeGreaterThan(0);
    expect(Array.isArray(metricResponse.body.series)).toBe(true);

    const intervalResponse = await request(app)
      .get(`/api/activities/${activityId}/metrics/interval-efficiency`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(intervalResponse.status).toBe(200);
    expect(Array.isArray(intervalResponse.body.intervals)).toBe(true);
    expect(intervalResponse.body.intervals.length).toBeGreaterThan(0);

    const powerStreamResponse = await request(app)
      .get(`/api/activities/${activityId}/streams/power`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(powerStreamResponse.status).toBe(200);
    expect(Array.isArray(powerStreamResponse.body.samples)).toBe(true);
    expect(powerStreamResponse.body.samples.length).toBeGreaterThan(0);

    const historyResponse = await request(app)
      .get('/api/metrics/interval-efficiency/history')
      .set('Authorization', `Bearer ${authToken}`);
    expect(historyResponse.status).toBe(200);
    expect(Array.isArray(historyResponse.body.points)).toBe(true);
    expect(historyResponse.body.points.length).toBeGreaterThan(0);

    const adaptationResponse = await request(app)
      .get('/api/metrics/adaptation-edges/deepest-blocks')
      .set('Authorization', `Bearer ${authToken}`);
    expect(adaptationResponse.status).toBe(200);
    expect(Array.isArray(adaptationResponse.body.windowSummaries)).toBe(true);

    const trackResponse = await request(app)
      .get(`/api/activities/${activityId}/track`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(trackResponse.status).toBe(200);
    expect(Array.isArray(trackResponse.body.points)).toBe(true);
    expect(trackResponse.body.points.length).toBeGreaterThan(0);
    expect(trackResponse.body.points[0]).toHaveProperty('lat');
    expect(trackResponse.body.points[0]).toHaveProperty('lon');
    const { bounds } = trackResponse.body;
    expect(bounds).toBeDefined();
    expect(bounds.minLatitude).toBeLessThanOrEqual(bounds.maxLatitude);
    expect(bounds.minLongitude).toBeLessThanOrEqual(bounds.maxLongitude);

    expect(unlinkSpy).toHaveBeenCalledTimes(2);
  });
});
