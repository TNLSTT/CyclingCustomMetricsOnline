'use client';

import { useMemo, useState } from 'react';
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

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const TIMEFRAME_OPTIONS = [
  { label: 'Last 3 months', value: '90', days: 90 },
  { label: 'Last 6 months', value: '180', days: 180 },
  { label: 'Last year', value: '365', days: 365 },
  { label: 'Last 2 years', value: '730', days: 730 },
  { label: 'Full history', value: 'all', days: Number.POSITIVE_INFINITY },
] as const;

type ChartDatum = { date: number } & Record<string, number | null>;

type RollingAverageOptions = {
  ignoreNulls?: boolean;
};

const tooltipNumberFormatter = new Intl.NumberFormat('en', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const axisNumberFormatter = new Intl.NumberFormat('en', {
  maximumFractionDigits: 0,
});

function formatTooltipValue(value: unknown, unit: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${tooltipNumberFormatter.format(value)} ${unit}`;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return `${tooltipNumberFormatter.format(parsed)} ${unit}`;
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

  const [selectedTimeframe, setSelectedTimeframe] = useState<(typeof TIMEFRAME_OPTIONS)[number]['value']>('180');

  const filteredDays = useMemo(() => {
    if (sortedDays.length === 0) {
      return sortedDays;
    }

    const selection = TIMEFRAME_OPTIONS.find((option) => option.value === selectedTimeframe);
    if (!selection || selection.days === Number.POSITIVE_INFINITY) {
      return sortedDays;
    }

    const latestDate = new Date(sortedDays[sortedDays.length - 1]?.date ?? sortedDays[0]?.date).getTime();
    const cutoff = latestDate - selection.days * MS_PER_DAY;
    return sortedDays.filter((day) => new Date(day.date).getTime() >= cutoff);
  }, [selectedTimeframe, sortedDays]);

  const kjChartData = useMemo<ChartDatum[]>(() => {
    if (filteredDays.length === 0) {
      return [];
    }
    const totals = filteredDays.map((day) => day.totalKj ?? 0);
    const points: ChartDatum[] = filteredDays.map((day) => ({
      date: new Date(day.date).getTime(),
    }));

    DAILY_KJ_WINDOWS.forEach((window) => {
      const averages = computeRollingAverage(totals, window.windowDays);
      averages.forEach((value, index) => {
        points[index][`kj_${window.windowDays}`] = value;
      });
    });

    return points;
  }, [filteredDays]);

  const powerChartData = useMemo<ChartDatum[]>(() => {
    if (filteredDays.length === 0) {
      return [];
    }

    const points: ChartDatum[] = filteredDays.map((day) => ({
      date: new Date(day.date).getTime(),
    }));

    POWER_DURATIONS.forEach((duration) => {
      const series = filteredDays.map((day) => day.bestPower[duration.key] ?? null);
      const averages = computeRollingAverage(series, POWER_MOVING_AVERAGE_WINDOW, {
        ignoreNulls: true,
      });
      averages.forEach((value, index) => {
        points[index][`power_${duration.key}`] = value;
      });
    });

    return points;
  }, [filteredDays]);

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

  const timeframeLabel =
    TIMEFRAME_OPTIONS.find((option) => option.value === selectedTimeframe)?.label ?? 'Full history';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Timeframe</p>
          <p className="text-sm text-muted-foreground">
            Focus the charts on the most relevant part of your training history.
          </p>
        </div>
        <div className="flex w-full items-center justify-between gap-3 text-sm sm:w-auto">
          <label className="text-sm font-medium" htmlFor="moving-average-timeframe">
            Show
          </label>
          <select
            id="moving-average-timeframe"
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40"
            value={selectedTimeframe}
            onChange={(event) => setSelectedTimeframe(event.target.value as typeof selectedTimeframe)}
          >
            {TIMEFRAME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-1.5">
            <CardTitle className="text-base font-semibold">Daily energy moving averages</CardTitle>
            <CardDescription>
              Track how your training load evolves by comparing multi-month rolling averages of
              kilojoules burned each day.
            </CardDescription>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Showing: {timeframeLabel}
            </p>
          </div>
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
                tickMargin={8}
              />
              <YAxis tickFormatter={(value) => axisNumberFormatter.format(Number(value))} width={80} />
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Showing: {timeframeLabel}
          </p>
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
                tickMargin={8}
              />
              <YAxis tickFormatter={(value) => axisNumberFormatter.format(Number(value))} width={80} />
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
