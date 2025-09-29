import React, { type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { DurabilityAnalysisResponse } from '../types/durability-analysis';
import { DurabilityAnalysisClient } from './durability-analysis-client';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { accessToken: 'token-1' }, status: 'authenticated' }),
}));

const mockData: DurabilityAnalysisResponse = {
  ftpWatts: 265,
  filters: {
    minDurationSec: 10800,
    startDate: undefined,
    endDate: undefined,
    discipline: undefined,
    keyword: undefined,
  },
  disciplines: ['outdoor', 'trainer'],
  rides: [
    {
      activityId: 'ride-1',
      startTime: '2024-03-01T10:00:00Z',
      source: 'outdoor',
      durationSec: 14400,
      ftpWatts: 265,
      normalizedPowerWatts: 250,
      normalizedPowerPctFtp: 94.3,
      averagePowerWatts: 210,
      averageHeartRateBpm: 142,
      totalKj: 750,
      tss: 210,
      heartRateDriftPct: 3.5,
      bestLateTwentyMinWatts: 280,
      bestLateTwentyMinPctFtp: 105.7,
      durabilityScore: 92,
      segments: {
        early: {
          label: 'early',
          startSec: 0,
          endSec: 4320,
          durationSec: 4320,
          normalizedPowerWatts: 255,
          normalizedPowerPctFtp: 96.2,
          averagePowerWatts: 220,
          averageHeartRateBpm: 138,
          heartRatePowerRatio: 0.627,
        },
        middle: {
          label: 'middle',
          startSec: 4320,
          endSec: 10080,
          durationSec: 5760,
          normalizedPowerWatts: 248,
          normalizedPowerPctFtp: 93.6,
          averagePowerWatts: 208,
          averageHeartRateBpm: 140,
          heartRatePowerRatio: 0.673,
        },
        late: {
          label: 'late',
          startSec: 10080,
          endSec: 14400,
          durationSec: 4320,
          normalizedPowerWatts: 245,
          normalizedPowerPctFtp: 92.5,
          averagePowerWatts: 205,
          averageHeartRateBpm: 146,
          heartRatePowerRatio: 0.712,
        },
      },
      timeSeries: Array.from({ length: 6 }).map((_, index) => ({
        t: index * 900,
        power: 200 + index * 6,
        heartRate: 132 + index,
      })),
    },
  ],
};

vi.mock('swr', () => ({
  __esModule: true,
  default: vi.fn(() => ({ data: mockData, isLoading: false, error: undefined })),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Area: () => <div data-testid="area" />,
  CartesianGrid: () => <div data-testid="grid" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceArea: () => <div data-testid="reference" />,
  Line: () => <div data-testid="line" />,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Bar: () => <div data-testid="bar" />,
  ScatterChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Scatter: () => <div data-testid="scatter" />,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Legend: () => <div data-testid="legend" />,
}));

describe('DurabilityAnalysisClient', () => {
  it('renders a durability analysis summary snapshot', () => {
    const html = renderToString(
      <DurabilityAnalysisClient initialData={mockData} defaultMinDurationMinutes={180} />,
    );

    expect(html).toContain('Candidate rides');
    expect(html).toContain('Durability score formula');
    expect(html).toMatchSnapshot();
  });
});
