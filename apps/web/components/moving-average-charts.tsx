'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { MovingAverageDay, PeakPowerDurationKey } from '../types/moving-averages';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const DAILY_KJ_WINDOWS = [
  { windowDays: 45, label: '45-day' },
  { windowDays: 90, label: '90-day' },
  { windowDays: 180, label: '180-day' },
  { windowDays: 365, label: '1-year' },
  { windowDays: 730, label: '2-year' },
  { windowDays: 1095, label: '3-year' },
] as const;

const POWER_DURATIONS: Array<{ key: PeakPowerDurationKey; label: string }> = [
  { key: '60', label: '1-minute' },
  { key: '300', label: '5-minute' },
  { key: '1200', label: '20-minute' },
  { key: '3600', label: '60-minute' },
];

const POWER_MOVING_AVERAGE_WINDOW = 45;

const KJ_COLORS = ['#0ea5e9', '#22c55e', '#6366f1', '#f97316', '#9333ea', '#64748b'];
const POWER_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#6366f1'];

type ChartDatum = { date: number } & Record<string, number | null>;

type RollingAverageOptions = {
  ignoreNulls?: boolean;
};

function formatTooltipValue(value: unknown, unit: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value.toFixed(1)} ${unit}`;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return `${parsed.toFixed(1)} ${unit}`;
    }
  }
  return '—';
}

function computeRollingAverage(
  values: Array<number | null>,
  windowSize: number,
  options: RollingAverageOptions = {},
): Array<number | null> {
  const { ignoreNulls = false } = options;
  if (windowSize <= 0) {
    return values.map(() => null);
  }

  const result: Array<number | null> = values.map(() => null);
  const window: Array<number | null> = [];
  let sum = 0;
  let nonNullCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    window.push(value);
    sum += value ?? 0;
    if (value != null) {
      nonNullCount += 1;
    }

    if (window.length > windowSize) {
      const removed = window.shift();
      sum -= removed ?? 0;
      if (removed != null) {
        nonNullCount -= 1;
      }
    }

    if (index >= windowSize - 1) {
      const divisor = ignoreNulls ? nonNullCount : windowSize;
      if (divisor > 0) {
        result[index] = Number.parseFloat((sum / divisor).toFixed(1));
      } else {
        result[index] = null;
      }
    }
  }

  return result;
}

interface MovingAverageChartsProps {
  days: MovingAverageDay[];
}

export function MovingAverageCharts({ days }: MovingAverageChartsProps) {
  const sortedDays = useMemo(
    () =>
      [...days].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [days],
  );

  const kjChartData = useMemo<ChartDatum[]>(() => {
    if (sortedDays.length === 0) {
      return [];
    }
    const totals = sortedDays.map((day) => day.totalKj ?? 0);
    const points: ChartDatum[] = sortedDays.map((day) => ({
      date: new Date(day.date).getTime(),
    }));

    DAILY_KJ_WINDOWS.forEach((window) => {
      const averages = computeRollingAverage(totals, window.windowDays);
      averages.forEach((value, index) => {
        points[index][`kj_${window.windowDays}`] = value;
      });
    });

    return points;
  }, [sortedDays]);

  const powerChartData = useMemo<ChartDatum[]>(() => {
    if (sortedDays.length === 0) {
      return [];
    }

    const points: ChartDatum[] = sortedDays.map((day) => ({
      date: new Date(day.date).getTime(),
    }));

    POWER_DURATIONS.forEach((duration) => {
      const series = sortedDays.map((day) => day.bestPower[duration.key] ?? null);
      const averages = computeRollingAverage(series, POWER_MOVING_AVERAGE_WINDOW, {
        ignoreNulls: true,
      });
      averages.forEach((value, index) => {
        points[index][`power_${duration.key}`] = value;
      });
    });

    return points;
  }, [sortedDays]);

  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  const fullDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    [],
  );

  if (sortedDays.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Daily energy moving averages</CardTitle>
          <CardDescription>
            Track how your training load evolves by comparing multi-month rolling averages of
            kilojoules burned each day.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kjChartData} margin={{ left: 12, right: 16, top: 12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => shortDateFormatter.format(new Date(value))}
                type="number"
                domain={['auto', 'auto']}
              />
              <YAxis tickFormatter={(value) => `${value}`} />
              <Tooltip
                labelFormatter={(value) => fullDateFormatter.format(new Date(value))}
                formatter={(value) => [formatTooltipValue(value, 'kJ'), 'Average']}
              />
              <Legend />
              {DAILY_KJ_WINDOWS.map((window, index) => (
                <Line
                  key={window.windowDays}
                  type="monotone"
                  dataKey={`kj_${window.windowDays}`}
                  stroke={KJ_COLORS[index % KJ_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={`${window.label} average`}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Peak power moving averages</CardTitle>
          <CardDescription>
            Smooth daily best efforts to monitor long-term trends in your 1, 5, 20, and 60-minute
            power.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={powerChartData} margin={{ left: 12, right: 16, top: 12, bottom: 12 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => shortDateFormatter.format(new Date(value))}
                type="number"
                domain={['auto', 'auto']}
              />
              <YAxis tickFormatter={(value) => `${value}`} />
              <Tooltip
                labelFormatter={(value) => fullDateFormatter.format(new Date(value))}
                formatter={(value) => [formatTooltipValue(value, 'W'), 'Average peak']}
              />
              <Legend />
              {POWER_DURATIONS.map((duration, index) => (
                <Line
                  key={duration.key}
                  type="monotone"
                  dataKey={`power_${duration.key}`}
                  stroke={POWER_COLORS[index % POWER_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  name={`${duration.label} (45-day)`}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
