import fs from 'node:fs/promises';

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { createApp } from '../src/app.js';
import type { NormalizedActivity } from '../src/types.js';

function buildNormalizedActivity(): NormalizedActivity {
  const samples: NormalizedActivity['samples'] = [];
  const cadenceBuckets = [
    { cadence: 60, heartRate: 120 },
    { cadence: 80, heartRate: 130 },
    { cadence: 100, heartRate: 140 },
    { cadence: 120, heartRate: 150 },
  ];
  let t = 0;
  for (const bucket of cadenceBuckets) {
    for (let i = 0; i < 60; i += 1) {
      samples.push({
        t,
        cadence: bucket.cadence,
        heartRate: bucket.heartRate + (i % 3),
        power: 200 + bucket.cadence / 2 + (i % 5),
        speed: null,
        elevation: null,
        temperature: 25 + bucket.cadence / 100,
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
  ingestFitFile: vi.fn(async () => {
    const { saveActivity } = await import('../src/services/activityService.js');
    const normalized = buildNormalizedActivity();
    const activity = await saveActivity(normalized);
    return { activity, normalized };
  }),
}));

const app = createApp();
const fixturePath = new URL('./fixtures/mock.fit', import.meta.url).pathname;

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
    const uploadResponse = await request(app)
      .post('/api/upload')
      .attach('files', fixturePath)
      .attach('files', fixturePath);

    expect(uploadResponse.status).toBe(201);
    expect(Array.isArray(uploadResponse.body.uploads)).toBe(true);
    expect(uploadResponse.body.uploads.length).toBeGreaterThan(0);
    const activityId = uploadResponse.body.uploads[0]?.activityId;
    expect(activityId).toBeDefined();

    const computeResponse = await request(app)
      .post(`/api/activities/${activityId}/compute`)
      .send();

    expect(computeResponse.status).toBe(200);
    expect(computeResponse.body.results.hcsr).toBeDefined();
    expect(computeResponse.body.results['interval-efficiency']).toBeDefined();

    const detailResponse = await request(app).get(`/api/activities/${activityId}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.metrics.length).toBeGreaterThan(0);

    const metricResponse = await request(app).get(
      `/api/activities/${activityId}/metrics/hcsr`,
    );
    expect(metricResponse.status).toBe(200);
    expect(metricResponse.body.summary.slope_bpm_per_rpm).toBeGreaterThan(0);
    expect(Array.isArray(metricResponse.body.series)).toBe(true);

    const intervalResponse = await request(app).get(
      `/api/activities/${activityId}/metrics/interval-efficiency`,
    );
    expect(intervalResponse.status).toBe(200);
    expect(Array.isArray(intervalResponse.body.intervals)).toBe(true);
    expect(intervalResponse.body.intervals.length).toBeGreaterThan(0);

    const historyResponse = await request(app).get(
      '/api/metrics/interval-efficiency/history',
    );
    expect(historyResponse.status).toBe(200);
    expect(Array.isArray(historyResponse.body.points)).toBe(true);
    expect(historyResponse.body.points.length).toBeGreaterThan(0);

    const adaptationResponse = await request(app).get(
      '/api/metrics/adaptation-edges/deepest-blocks',
    );
    expect(adaptationResponse.status).toBe(200);
    expect(Array.isArray(adaptationResponse.body.windowSummaries)).toBe(true);

    expect(unlinkSpy).toHaveBeenCalledTimes(2);
  });
});
