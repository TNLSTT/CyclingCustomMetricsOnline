'use client';

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

import type { IntervalEfficiencyHistoryPoint } from '../types/activity';

interface IntervalEfficiencyHistoryChartProps {
  points: IntervalEfficiencyHistoryPoint[];
}

export function IntervalEfficiencyHistoryChart({ points }: IntervalEfficiencyHistoryChartProps) {
  const data = points
    .map((point) => ({
      activityId: point.activityId,
      label: new Date(point.activityStartTime).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      fullDate: new Date(point.activityStartTime).toLocaleString(),
      average: point.averageWPerHr ?? null,
      first: point.firstIntervalWPerHr ?? null,
      last: point.lastIntervalWPerHr ?? null,
      intervalCount: point.intervalCount,
    }))
    .filter((entry) => entry.average != null || entry.first != null || entry.last != null);

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No interval efficiency metrics have been computed yet. Compute the metric for multiple rides
        to unlock the historical view.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 16, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="label" />
        <YAxis
          domain={['auto', 'auto']}
          label={{ value: 'Watts per bpm', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          formatter={(value: unknown, name) => {
            if (typeof value !== 'number') {
              return ['—', name];
            }
            return [value.toFixed(2), name];
          }}
          labelFormatter={(label, payload) => {
            const match = payload?.[0]?.payload;
            if (match && typeof match.fullDate === 'string') {
              return match.fullDate;
            }
            return String(label);
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="average"
          name="Average"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="first"
          name="First interval"
          stroke="hsl(var(--chart-2))"
          strokeWidth={1.5}
          dot={{ r: 2 }}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="last"
          name="Last interval"
          stroke="hsl(var(--chart-3))"
          strokeWidth={1.5}
          dot={{ r: 2 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
